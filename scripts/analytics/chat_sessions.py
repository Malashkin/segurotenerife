#!/usr/bin/env python3
"""
Разбор живых диалогов с чат-агентом: что спросили и не сломалось ли что-нибудь.

Зачем нужен отдельно от report.py: report.py считает трафик пачками («сколько
сессий за неделю»). Диалог с агентом — событие штучное (за первые два с
половиной месяца их было три), и ценность в нём не в количестве, а в разборе
конкретного захода: дошёл ли ответ, за сколько секунд, распозналась ли тема,
довели ли до менеджера и на каком шаге человек ушёл.

Что считается находкой: сессия, в которой есть `chat_opened` или
`question_asked`. Именно так, а не по `chat_started` — то событие шлётся один
раз при монтировании виджета и проходит через согласие на куки, поэтому у
посетителя, который согласился позже монтирования, оно теряется (так пропала из
всех отчётов сессия 2026-09-02 с двумя настоящими вопросами). `chat_opened` без
единого вопроса тоже находка: открыл чат и ничего не спросил — это ровно тот
случай, где может быть поломка, а не отсутствие интереса.

Вердикт по сессии — одно из трёх:
  BROKEN  вопрос без ответа / agent_fallback / задержка выше порога /
          тема не распозналась / язык ответа разошёлся с языком вопроса
  DROPPED механика цела, человек ушёл — с указанием шага
  HEALTHY все вопросы отвечены, дошёл до заявки

Тексты вопросов и ответов PostHog не хранит намеренно (`trackEvent` шлёт только
язык). Они есть в Langfuse: ключи берутся из `.env` репозитория (там же, где их
читает backend) или из ~/.config/segurotenerife/langfuse.env. Без ключей скрипт
работает и пропускает тексты — судит только об исправности механики, о чём
честно пишет в отчёте.

Связка трейса с сессией — по времени, а не по `sessionId`: у Langfuse свой
идентификатор сессии (фронт шлёт в `/api/chat` собственный `getSessionId()`), и
с `$session_id` в PostHog он не совпадает. Склейка по идентификатору молча
возвращает пустоту на любой сессии.

Запуск:
    python3 scripts/analytics/chat_sessions.py                # новое с прошлого раза
    python3 scripts/analytics/chat_sessions.py --days 120     # окно вручную
    python3 scripts/analytics/chat_sessions.py --all          # и уже разобранные тоже
    python3 scripts/analytics/chat_sessions.py --session <id> # одна конкретная
    python3 scripts/analytics/chat_sessions.py --no-state     # ничего не запоминать
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
# Отдельный файл с ключами Langfuse — для машины, где репозитория нет.
LANGFUSE_FALLBACK = Path.home() / ".config" / "segurotenerife" / "langfuse.env"


def langfuse_config_paths() -> list[Path]:
    """
    Где искать ключи Langfuse: `.env` репозитория, затем отдельный файл.

    Ищем `.env` вверх по дереву и от самого скрипта, и от рабочей директории.
    Второе не перестраховка: автопилот берёт скрипт из невлитой ветки через
    `git show` и запускает копию из /tmp — тогда `__file__` указывает мимо
    репозитория, и разбор молча остаётся без текстов вопросов.
    """
    paths, seen = [], set()
    for start in (Path(__file__).resolve().parent, Path.cwd().resolve()):
        for d in [start, *start.parents]:
            candidate = d / ".env"
            if candidate not in seen:
                seen.add(candidate)
                paths.append(candidate)
    paths.append(LANGFUSE_FALLBACK)
    return paths


STATE = Path.home() / ".config" / "segurotenerife" / "chat-sessions-seen.json"

# События воронки чата. Порядок важен только для чтения таймлайна.
CHAT_EVENTS = [
    "chat_opened", "chat_started", "question_asked", "answer_received",
    "agent_fallback", "chat_handoff_offered", "chat_completed",
    "handoff_clicked", "lead_submitted", "tg_message_copied",
    "insurance_intent_selected", "lang_switched",
]
# Сессия попадает в разбор, если есть хоть одно из этих событий.
TRIGGER_EVENTS = ["chat_opened", "question_asked"]

# Ответ дольше этого — деградация, а не норма (по факту на живых сессиях 3–9 с).
SLOW_ANSWER_S = 20.0
# Дольше этого ответ считается не пришедшим вовсе.
LOST_ANSWER_S = 60.0


def load_env(path: Path) -> dict:
    cfg = {}
    if path.is_file():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    return cfg


# ── PostHog ──────────────────────────────────────────────────────────────────

def hogql(cfg: dict, sql: str) -> list:
    """Выполнить HogQL-запрос. Ключу достаточно scope Query Read."""
    host = cfg.get("POSTHOG_HOST", "https://eu.posthog.com").rstrip("/")
    # @current вместо числового id: ключ привязан к проекту, /api/projects/ отдаёт 403.
    url = f"{host}/api/projects/@current/query/"
    body = json.dumps({"query": {"kind": "HogQLQuery", "query": sql}}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {cfg['POSTHOG_PERSONAL_API_KEY']}")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r).get("results", [])
    except urllib.error.HTTPError as e:
        detail = e.read()[:300].decode(errors="replace")
        print(f"PostHog: HTTP {e.code} — {detail}", file=sys.stderr)
        return []


def find_sessions(cfg: dict, days: int) -> list[dict]:
    """Сессии окна, в которых человек вообще дошёл до чата."""
    quoted = ", ".join(f"'{e}'" for e in TRIGGER_EVENTS)
    rows = hogql(cfg, f"""
        select properties.$session_id as sid,
               min(timestamp) as first_seen,
               max(timestamp) as last_seen
        from events
        where timestamp > now() - interval {days} day
          and event in ({quoted})
          and coalesce(properties.$session_id, '') != ''
        group by sid
        order by first_seen
    """)
    return [{"sid": r[0], "first_seen": r[1], "last_seen": r[2]} for r in rows]


def session_events(cfg: dict, sid: str) -> list[dict]:
    """
    Полный таймлайн сессии: воронка чата + вход/уход + клики.

    Срез `elements_chain` в 120 символов — не косметика: на 400 PostHog отдаёт
    HTTP 500 на сессиях с длинными цепочками классов. 120 хватает, чтобы
    опознать элемент по первым атрибутам, а подпись клика берётся из `$el_text`.
    """
    quoted = ", ".join(f"'{e}'" for e in CHAT_EVENTS)
    rows = hogql(cfg, f"""
        select timestamp, event,
               properties.lang, properties.topic, properties.handoff,
               properties.source, properties.$pathname, properties.$event_type,
               properties.$el_text, substring(coalesce(elements_chain, ''), 1, 120)
        from events
        where properties.$session_id = '{sid}'
          and (event in ({quoted}) or event in ('$pageview', '$pageleave', '$autocapture'))
        order by timestamp
    """)
    keys = ["ts", "event", "lang", "topic", "handoff", "source", "path",
            "click_type", "el_text", "chain"]
    return [dict(zip(keys, r)) for r in rows]


def session_context(cfg: dict, sid: str) -> dict:
    rows = hogql(cfg, f"""
        select any(properties.$referring_domain), any(properties.traffic_channel),
               any(properties.ai_engine), any(properties.$geoip_city_name),
               any(properties.$geoip_country_name), any(properties.$device_type),
               any(properties.$browser), any(properties.$os),
               any(properties.$session_entry_pathname)
        from events where properties.$session_id = '{sid}'
    """)
    keys = ["referrer", "channel", "ai_engine", "city", "country", "device", "browser", "os", "entry"]
    return dict(zip(keys, rows[0])) if rows else {}


def session_recording(cfg: dict, sid: str) -> dict | None:
    """
    Метаданные записи сессии: сколько человек был активен, сколько кликал и
    печатал. Ключу нужен scope `session_recording:read` — без него PostHog
    отдаёт 403, и разбор просто идёт дальше.

    404 означает не «не было записи», а «запись истекла»: retention 30 дней,
    и сессия старше месяца уже недоступна. Разница важна — отсутствие записи не
    должно читаться как отсутствие активности.
    """
    host = cfg.get("POSTHOG_HOST", "https://eu.posthog.com").rstrip("/")
    req = urllib.request.Request(f"{host}/api/projects/@current/session_recordings/{sid}/")
    req.add_header("Authorization", f"Bearer {cfg['POSTHOG_PERSONAL_API_KEY']}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"__expired__": True}
        if e.code == 403:
            return {"__no_scope__": True}
        return None
    except Exception:
        return None


# ── Langfuse (опционально) ───────────────────────────────────────────────────

def langfuse_creds() -> dict | None:
    for path in langfuse_config_paths():
        cfg = load_env(path)
        if cfg.get("LANGFUSE_PUBLIC_KEY") and cfg.get("LANGFUSE_SECRET_KEY"):
            return cfg
    return None


def langfuse_dialogue(events: list[dict]) -> list[dict] | None:
    """
    Тексты вопросов и ответов по сессии. None — ключей нет (это не ошибка).

    Связываем по ВРЕМЕНИ, а не по идентификатору сессии. Казалось бы, у трейса
    есть `sessionId` — но это не тот же идентификатор, что `$session_id` в
    PostHog: фронт шлёт в `/api/chat` свой `getSessionId()`, и PostHog о нём не
    знает. Склейка по sessionId молча даёт пустой результат на любой сессии.

    Окно берём по таймлайну сессии с запасом в минуту: трейс пишется в момент
    ответа агента, то есть всегда внутри него.
    """
    cfg = langfuse_creds()
    if cfg is None:
        return None
    base = cfg.get("LANGFUSE_BASE_URL", "https://cloud.langfuse.com").rstrip("/")
    first, last = parse_ts(events[0]["ts"]), parse_ts(events[-1]["ts"])
    query = urllib.parse.urlencode({
        "fromTimestamp": (first - timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
        "toTimestamp": (last + timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
        "limit": 100,
    })
    req = urllib.request.Request(f"{base}/api/public/traces?{query}")
    token = base64.b64encode(
        f"{cfg['LANGFUSE_PUBLIC_KEY']}:{cfg['LANGFUSE_SECRET_KEY']}".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r).get("data", [])
    except urllib.error.HTTPError as e:
        print(f"Langfuse: HTTP {e.code} — тексты пропускаю", file=sys.stderr)
        return None
    except Exception as e:  # сеть, DNS, таймаут — не повод ронять разбор
        print(f"Langfuse: {e} — тексты пропускаю", file=sys.stderr)
        return None
    out = []
    for t in sorted(data, key=lambda x: x.get("timestamp") or ""):
        meta = t.get("metadata") or {}
        out.append({
            "ts": t.get("timestamp"),
            "question": t.get("input"),
            "answer": t.get("output"),
            "retrieved": meta.get("retrieved") or [],
            "brand_leaked": meta.get("brand_leaked"),
            "latency": t.get("latency"),
            "cost": t.get("totalCost"),
        })
    return out


# ── Разбор ───────────────────────────────────────────────────────────────────

# Крестик закрытия чата — иконка X (lucide/feather): её `path` виден в самом
# начале цепочки, поэтому опознаётся и по короткому срезу.
CLOSE_ICON = "M18 6 6 18M6 6l12 12"


def is_close(e: dict) -> bool:
    return e["click_type"] == "click" and CLOSE_ICON in (e.get("chain") or "")


def parse_ts(v) -> datetime:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def analyse(events: list[dict], dialogue: list[dict] | None = None,
            rec: dict | None = None) -> dict:
    """Вердикт и список замечаний по таймлайну одной сессии."""
    broken: list[str] = []
    dropped: list[str] = []
    notes: list[str] = []

    questions = [e for e in events if e["event"] == "question_asked"]
    answers = [e for e in events if e["event"] == "answer_received"]
    fallbacks = [e for e in events if e["event"] == "agent_fallback"]

    # 1. Каждому вопросу — свой ответ. Пара по порядку: событий без id, но и
    #    параллельных вопросов в одном чате быть не может.
    used = set()
    for q in questions:
        qt = parse_ts(q["ts"])
        match = None
        for i, a in enumerate(answers):
            if i in used:
                continue
            dt = (parse_ts(a["ts"]) - qt).total_seconds()
            if 0 <= dt <= LOST_ANSWER_S:
                match, used = a, used | {i}
                break
        if match is None:
            broken.append(f"вопрос в {qt:%H:%M:%S} остался без ответа")
            continue
        dt = (parse_ts(match["ts"]) - qt).total_seconds()
        if dt > SLOW_ANSWER_S:
            broken.append(f"ответ на вопрос в {qt:%H:%M:%S} шёл {dt:.0f} с")
        else:
            notes.append(f"вопрос {qt:%H:%M:%S} → ответ за {dt:.0f} с, тема `{match['topic'] or '—'}`")
        # 2. Тема должна распознаться: null = корпус не поднял ни одного документа.
        if not match["topic"]:
            broken.append(f"тема вопроса в {qt:%H:%M:%S} не распозналась (мимо корпуса)")
        # 3. Язык ответа не должен расходиться с языком вопроса.
        if q["lang"] and match["lang"] and q["lang"] != match["lang"]:
            broken.append(f"язык поехал: спросили на {q['lang']}, ответили на {match['lang']}")

    # 4. Утечка бренда страховщика в ответ — видна только в трейсах Langfuse.
    for t in (dialogue or []):
        if t.get("brand_leaked"):
            broken.append(f"в ответе {str(t['ts'])[11:19]} утёк бренд страховщика")

    # 5. Агент падал или был выключен.
    for f in fallbacks:
        broken.append(f"agent_fallback в {parse_ts(f['ts']):%H:%M:%S} — агент не ответил")

    # 6. Открыл чат и ничего не спросил.
    opened = [e for e in events if e["event"] in ("chat_opened", "chat_started")]
    if opened and not questions:
        dropped.append("открыл чат и не задал ни одного вопроса")

    # 7. Недописанный вопрос. Если есть и запись, и тексты — судим по числу
    #    нажатий клавиш против длины отправленного: это точнее, чем считать
    #    change/submit. Запас в полтора раза плюс 20 — на опечатки и правки.
    keys = (rec or {}).get("keypress_count")
    sent = sum(len(t.get("question") or "") for t in (dialogue or []))
    if questions and keys is not None and sent:
        # Сильный сигнал: нажатий клавиш против длины отправленного. Если он
        # есть, слабый (change без submit) не озвучиваем вовсе — `change`
        # срабатывает и на программной очистке поля, и на blur, и тогда
        # «начал печатать и не отправил» — выдумка поверх данных, которые её
        # опровергают.
        if keys > sent * 1.5 + 20:
            dropped.append(f"печатал заметно больше, чем отправил "
                           f"({keys} нажатий клавиш против {sent} отправленных символов) — "
                           f"вопрос остался недописанным")
    elif questions:
        changes = sum(1 for e in events
                      if e["event"] == "$autocapture" and e["click_type"] == "change")
        submits = sum(1 for e in events
                      if e["event"] == "$autocapture" and e["click_type"] == "submit")
        if changes > submits:
            dropped.append(f"начал печатать и не отправил "
                           f"({changes} правок поля на {submits} отправок, "
                           f"записи сессии нет — судить точнее нечем)")

    # Открыл чат и не притронулся к клавиатуре — это не «сломалось», это уход.
    if opened and not questions and keys == 0:
        notes.append("к клавиатуре не притронулся ни разу")

    # 8. Закрыл чат руками — это не то же самое, что просто уйти со страницы.
    closes = [e for e in events if e["event"] == "$autocapture" and is_close(e)]
    if closes:
        dropped.append(f"закрыл чат крестиком в {parse_ts(closes[-1]['ts']):%H:%M:%S}")

    # 9. Довели ли до менеджера и где сорвалось.
    offers = {e["source"] for e in events if e["event"] == "chat_handoff_offered"}
    clicked = any(e["event"] == "handoff_clicked" for e in events)
    lead = any(e["event"] == "lead_submitted" for e in events)
    if offers:
        notes.append("карточка менеджера предложена: " + ", ".join(sorted(x or "—" for x in offers)))
    if "agent" in offers and not clicked:
        dropped.append("агент сам распознал намерение, но кнопку менеджера не нажали")
    elif offers and not clicked:
        dropped.append("карточка менеджера показана, переход в мессенджер не сделан")
    if clicked and not lead:
        dropped.append("перешёл в мессенджер, но заявку не оставил")

    verdict = "BROKEN" if broken else ("HEALTHY" if lead else "DROPPED")
    return {"verdict": verdict, "broken": broken, "dropped": dropped, "notes": notes,
            "questions": len(questions), "answers": len(answers), "lead": lead}


# ── Отчёт ────────────────────────────────────────────────────────────────────

MARK = {"BROKEN": "СЛОМАНО", "DROPPED": "СОРВАЛСЯ", "HEALTHY": "ЗДОРОВ"}


def render(sid: str, ctx: dict, events: list[dict], verdict: dict, dialogue,
           rec: dict | None = None) -> str:
    first = parse_ts(events[0]["ts"]) if events else None
    out = [f"### Сессия `{sid}` — {MARK[verdict['verdict']]}"]
    if first:
        out.append(f"{first:%Y-%m-%d %H:%M} UTC · вопросов: {verdict['questions']} · "
                   f"ответов: {verdict['answers']} · заявка: {'да' if verdict['lead'] else 'нет'}")
    out.append("")
    out.append(f"**Кто:** {ctx.get('city') or '—'}, {ctx.get('country') or '—'} · "
               f"{ctx.get('device') or '—'}, {ctx.get('browser') or '—'}/{ctx.get('os') or '—'} · "
               f"канал `{ctx.get('channel') or '—'}`"
               + (f" ({ctx['ai_engine']})" if ctx.get("ai_engine") else "")
               + f" · реферер {ctx.get('referrer') or '—'}")
    out.append(f"**Вход:** `{ctx.get('entry') or '—'}`")
    out.append("")

    if verdict["broken"]:
        out.append("**Сломано:**")
        out += [f"- {x}" for x in verdict["broken"]]
        out.append("")
    if verdict["dropped"]:
        out.append("**Где сорвалось:**")
        out += [f"- {x}" for x in verdict["dropped"]]
        out.append("")
    if verdict["notes"]:
        out.append("**Механика:**")
        out += [f"- {x}" for x in verdict["notes"]]
        out.append("")

    if dialogue is None:
        out.append("_Тексты вопросов недоступны: ключей Langfuse нет ни в `.env` репозитория, "
                   "ни в `~/.config/segurotenerife/langfuse.env`. Судим только об исправности._")
    elif not dialogue:
        out.append("_Langfuse подключён, но трейсов за это время нет — либо агент тогда ещё "
                   "не трассировался, либо вопросов в сессии не было._")
    else:
        out.append("**Диалог:**")
        for t in dialogue:
            q = (t.get("question") or "").strip()
            a = (t.get("answer") or "").strip()
            out.append("")
            out.append(f"**В:** {q}")
            out.append("")
            out.append(f"**О:** {a}")
            docs = ", ".join(f"`{d}`" for d in t.get("retrieved") or []) or "—"
            out.append("")
            out.append(f"_подняты документы: {docs} · {t.get('latency') or 0:.1f} с_")
        cost = sum(t.get("cost") or 0 for t in dialogue)
        if cost:
            out.append("")
            out.append(f"_разговор стоил ${cost:.4f}_")
    out.append("")
    out.append("**Таймлайн:**")
    out.append("")
    out.append("| Время | Событие | Детали |")
    out.append("|---|---|---|")
    for e in events:
        if e["event"] == "$autocapture" and e["click_type"] not in ("change", "submit"):
            # клики показываем только опознаваемые: с текстом на элементе или
            # по крестику закрытия (иконка X — её path видно в начале цепочки).
            if not e["el_text"] and not is_close(e):
                continue
        detail = " ".join(x for x in [
            f"«{e['el_text']}»" if e["el_text"] else ("закрыл крестиком" if is_close(e) else ""),
            f"тема `{e['topic']}`" if e["topic"] else "",
            "→ менеджер" if e["handoff"] else "",
            f"источник `{e['source']}`" if e["source"] else "",
            f"`{e['click_type']}`" if e["click_type"] else "",
        ] if x)
        out.append(f"| {parse_ts(e['ts']):%H:%M:%S} | `{e['event']}` | {detail} |")
    out.append("")
    out.append(render_recording(sid, rec))
    return "\n".join(out)


def render_recording(sid: str, rec: dict | None) -> str:
    """Блок про запись сессии — с честной разницей между «нет» и «истекла»."""
    link = f"https://eu.posthog.com/replay/{sid}"
    if rec is None:
        return f"Запись сессии: {link}"
    if rec.get("__no_scope__"):
        return (f"Запись сессии: {link}\n\n_Цифры по записи недоступны: ключу PostHog нужен "
                f"scope `session_recording:read`._")
    if rec.get("__expired__"):
        return (f"Запись сессии: {link}\n\n_Записи уже нет — retention 30 дней. "
                f"Это не «не записалась», а «истекла»._")
    total = rec.get("recording_duration") or 0
    active = rec.get("active_seconds") or 0
    ttl = rec.get("recording_ttl")
    lines = [f"Запись сессии: {link}", ""]
    lines.append(f"**По записи:** на странице {total // 60} мин {total % 60} с, "
                 f"из них активно {active} с · кликов {rec.get('click_count', 0)} · "
                 f"нажатий клавиш {rec.get('keypress_count', 0)} · "
                 f"движений мыши {rec.get('mouse_activity_count', 0)}")
    if isinstance(ttl, int) and ttl <= 7:
        lines.append("")
        lines.append(f"⚠️ Запись удалится через {ttl} дн. — если смотреть, то сейчас.")
    return "\n".join(lines)


# ── Состояние ────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE.is_file():
        try:
            return json.loads(STATE.read_text())
        except json.JSONDecodeError:
            pass
    return {"seen": [], "last_run": None}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False))
    STATE.chmod(0o600)


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(description="Разбор живых диалогов с чат-агентом")
    p.add_argument("--days", type=int, default=7, help="окно поиска в днях (по умолчанию 7)")
    p.add_argument("--all", action="store_true", help="и уже разобранные сессии тоже")
    p.add_argument("--session", help="разобрать одну конкретную сессию")
    p.add_argument("--no-state", action="store_true", help="не запоминать разобранное")
    args = p.parse_args()

    cfg = load_env(CONFIG)
    if not cfg.get("POSTHOG_PERSONAL_API_KEY"):
        print(f"Нет POSTHOG_PERSONAL_API_KEY в {CONFIG} — разбирать нечем.", file=sys.stderr)
        return 2

    state = load_state()
    seen = set(state.get("seen", []))

    if args.session:
        targets = [args.session]
    else:
        found = find_sessions(cfg, args.days)
        targets = [s["sid"] for s in found if args.all or s["sid"] not in seen]

    if not targets:
        print(f"Новых заходов в чат за {args.days} дн. нет.")
        if not args.no_state:
            state["last_run"] = datetime.now(timezone.utc).isoformat()
            save_state(state)
        return 0

    reports, broken_count = [], 0
    for sid in targets:
        events = session_events(cfg, sid)
        if not events:
            continue
        dialogue = langfuse_dialogue(events)
        rec = session_recording(cfg, sid)
        verdict = analyse(events, dialogue, rec)
        broken_count += verdict["verdict"] == "BROKEN"
        reports.append(render(sid, session_context(cfg, sid), events, verdict, dialogue, rec))
        seen.add(sid)

    print(f"## Заходы в чат: {len(reports)}"
          + (f", из них сломанных: {broken_count}" if broken_count else ", поломок нет"))
    print()
    print("\n\n---\n\n".join(reports))

    if not args.no_state:
        state["seen"] = sorted(seen)
        state["last_run"] = datetime.now(timezone.utc).isoformat()
        save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
