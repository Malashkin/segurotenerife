#!/usr/bin/env python3
"""
Внешний съём позиций (Rush Analytics) по фиксированному списку фраз.

Зачем он нужен рядом с Search Console. GSC — единственный честный журнал того,
что видели живые люди, и правило `docs/seo/measuring-positions.md` («позицию не
проверяют глазами») этим инструментом не отменяется. Но у GSC есть дыра, которую
он не закрывает по своей природе: по фразе, по которой нас **ни разу не
показали**, ноль показов неотличим от «нас там нет». Rush ходит в поиск со своей
инфраструктуры — наш собственный показ не тратится, статистика не пачкается,
ряд сравним во времени.

Что этот файл делает и чего не делает:

    делает   съём позиций по 40 фразам из docs/seo/target-queries.csv
    не делает индексацию, частотность, подсказки, топ-10, упоминания в ИИ —
             у сервиса под это есть свои ручки, но каждая стоит отдельных денег
             и заводится отдельным решением

Зависимостей нет — только стандартная библиотека: регулярный прогон, который
ломается на окружении из-за pip, не регулярный.

Конфигурация — ~/.config/segurotenerife/analytics.env (chmod 600):
    RUSH_API_KEY=...
    RUSH_API_BASE=https://app.rush-analytics.ru/apiv2

**Ключ не печатается никуда.** Ни в лог, ни в вывод, ни в сообщение об ошибке:
сервис принимает его query-параметром, а ответ ручки /status/ содержит ключ
прямо внутри ссылки на результат — поэтому такой ответ целиком не печатается,
из него берётся только поле статуса.

Запуск:
    python3 scripts/analytics/rush.py balance            # остаток лимитов
    python3 scripts/analytics/rush.py setup --trial      # пробный проект, 5 фраз
    python3 scripts/analytics/rush.py setup              # боевой проект, 40 фраз
    python3 scripts/analytics/rush.py snapshot --trial   # забрать пробный срез
    python3 scripts/analytics/rush.py snapshot           # записать снимок недели
    python3 scripts/analytics/rush.py compare            # два последних снимка
    python3 scripts/analytics/rush.py selftest           # проверка отбраковки
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import load_config  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TARGETS = ROOT / "docs" / "seo" / "target-queries.csv"
SNAPSHOTS = ROOT / "docs" / "seo" / "positions"

SITE = "segurotenerife.com"

# Регион и движок — константы, а не аргументы командной строки. Ряд позиций
# сравним во времени только тогда, когда снимается в одном и том же месте:
# переданный руками регион однажды будет передан другой, и история порвётся.
#
# Значения взяты из справочника сервиса (app.rush-analytics.ru/apiRegionsGoogle.php),
# а не угаданы: 1005465 — Санта-Крус-де-Тенерифе, 2724 — Испания целиком.
# Язык интерфейса один на проект — испанский: это то, что стоит по умолчанию у
# человека, физически находящегося на Тенерифе. Ограничение отсюда честное и
# записано в measuring-positions.md: русские, украинские и английские фразы
# снимаются с испанским интерфейсом.
REGION = {"type": ".es", "id": 1005465, "lang": "es", "device": 0}
REGION_HUMAN = "Google, Санта-Крус-де-Тенерифе (Испания), десктоп, интерфейс es"

# Только Google. Яндекс не заводим: рынок — Испания, доля Яндекса там
# пренебрежимая, а каждый движок стоит отдельного проекта и отдельных денег.
# Решение пересматривается, когда появится причина, а не «на всякий случай».
DEPTH = 100          # глубина съёма; она же — отсечка, по которой ловится болванка
TYPE_ID = 3          # тип задания «проверка позиций» в номенклатуре сервиса

PROJECT_NAME = f"{SITE} — google — Santa Cruz de Tenerife (40)"
TRIAL_NAME = f"{SITE} — google — Santa Cruz de Tenerife — проба (5)"

# Пробный прогон: пять фраз, две из них — контрольные. `seguro dnv` стоит в GSC
# на 4.3, `what is a public health charge in tenerife` — на 5.6. Если внешний
# съём покажет их вне топ-10, дело в регионе, а не в выдаче, и боевой прогон
# запускать нельзя.
TRIAL_QUERIES = [
    "seguro dnv",
    "what is a public health charge in tenerife",
    "tenerife travel insurance",
    "похоронная страховка испания",
    "туристична страховка на рік",
]

RATE_LIMIT_SEC = 1.1   # не чаще 1 запроса в секунду — иначе временная блокировка IP
BUSY_RETRIES = 6       # «No more free API threads» — занято чужим проектом на общем ключе
BUSY_RETRY_SEC = 45
POLL_SEC = 30
DONE_STATES = {"done", "complete", "completed", "finished"}
FAILED_STATES = {"error", "failed", "canceled", "cancelled", "stopped"}
POLL_TIMEOUT_SEC = 1800   # первый сбор у свежего проекта — около четверти часа

_last_call = 0.0


class RushError(RuntimeError):
    """Сервис не отдал данные. Отдельный тип, чтобы пустой ответ не выглядел как «нулей нет»."""


class SnapshotRejected(RushError):
    """Снимок получен, но доверять ему нельзя. Не записывается."""


# ── транспорт ────────────────────────────────────────────────────────────────

def _creds() -> tuple[str, str]:
    cfg = load_config()
    key, base = cfg.get("RUSH_API_KEY"), cfg.get("RUSH_API_BASE")
    if not key or not base:
        raise RushError("нет RUSH_API_KEY / RUSH_API_BASE в ~/.config/segurotenerife/analytics.env")
    return key, base.rstrip("/")


def _throttle() -> None:
    global _last_call
    delta = time.monotonic() - _last_call
    if delta < RATE_LIMIT_SEC:
        time.sleep(RATE_LIMIT_SEC - delta)
    _last_call = time.monotonic()


def _call(path: str, payload: dict | None = None, *, params: dict | None = None):
    """Запрос к сервису. Ни URL, ни тело, ни ответ целиком наружу не печатаются:
    ключ живёт и в query-параметре, и внутри ссылок в ответе /status/."""
    key, base = _creds()
    _throttle()
    q = dict(params or {})
    q["apikey"] = key
    url = f"{base}/{path.lstrip('/')}?{urllib.parse.urlencode(q)}"
    data = None
    if payload is not None:
        data = json.dumps({**payload, "apikey": key}).encode()
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    if data:
        req.add_header("Content-Type", "application/json")
    for attempt in range(BUSY_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode(errors="replace")
            break
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:200].replace(key, "<KEY>")
            # Ключ общий с 28 чужими проектами, и очередь исполнителей у сервиса
            # тоже общая: «No more free API threads» — это занято соседом, а не
            # наша ошибка. Отказываться по ней сразу означало бы ронять недельную
            # рутину из-за чужого прогона.
            if e.code == 403 and "free API threads" in detail and attempt < BUSY_RETRIES - 1:
                time.sleep(BUSY_RETRY_SEC)
                _throttle()
                continue
            raise RushError(f"HTTP {e.code} на {path}: {detail}") from None
        except urllib.error.URLError as e:
            raise RushError(f"сеть недоступна на {path}: {e.reason}") from None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw.strip().replace(key, "<KEY>")


# ── ручки ────────────────────────────────────────────────────────────────────

def balance() -> float:
    v = _call("/balance/")
    try:
        return float(v if not isinstance(v, dict) else v.get("balance", v))
    except (TypeError, ValueError):
        raise RushError("сервис вернул остаток в непонятном виде") from None


def find_project(name: str) -> int | None:
    """Проект ищется **по имени**: повторный вызов возвращает существующий, а не
    заводит близнеца. Иначе через три месяца непонятно, какой из проектов отчётный."""
    data = _call("/projectids/", params={"typeid": TYPE_ID})
    items = data.get(str(TYPE_ID), []) if isinstance(data, dict) else []
    for p in items:
        if p.get("name") == name:
            return int(p["id"])
    return None


def create_project(name: str, targets: list[dict]) -> int:
    payload = {
        "name": name,
        "url": SITE,
        "depth": DEPTH,
        "competitors": [],
        # 1 — еженедельно. Съём привязан к недельному слою: по нашему замеру за
        # неделю не двигается около трёх четвертей фраз, дневной съём даёт
        # вчетверо больше расходов и ту же информацию.
        "dataCollectionFrequency": {"frequency": 1},
        "expertOptions": {"exactUrl": False, "exactDomain": True, "includeYandex": False},
        "yandexRegions": [],
        "googleRegions": [REGION],
        "keywords": [{"keyword": t["query"],
                      "targeturl": f"https://{SITE}{t['landing']}"} for t in targets],
    }
    _call("/create/ranktracker/", payload)
    # Идентификатор из ответа создания **не берём**. Проверено 2026-09-23: ответ
    # вернул id 1241421, а заведённый проект получил 1241422 — по первому же
    # номеру ручка /status/ бодро отвечала «Parsing», то есть мы бы неделями
    # снимали позиции чужого проекта и не заметили. Единственный надёжный
    # идентификатор — тот, под которым проект виден в перечне по своему имени.
    pid = find_project(name)
    if not pid:
        raise RushError(f"проект «{name}» создан, но в перечне не появился — "
                        f"снимать нечего, пока он не виден по имени")
    return pid


def ensure_project(name: str, targets: list[dict]) -> tuple[int, bool]:
    pid = find_project(name)
    if pid:
        return pid, False
    return create_project(name, targets), True


def project_status(pid: int) -> str:
    """Готовность задания. Из ответа берётся **только** поле статуса: у части
    ручек сервиса ответ содержит ключ прямо внутри ссылки на результат, и
    привычка печатать ответ целиком однажды вынесет ключ в лог."""
    res = _call(f"/status/{TYPE_ID}/{pid}/")
    if isinstance(res, dict) and "status" in res:
        return str(res["status"])
    raise RushError("сервис не сообщил статус задания")


def fetch_rows(pid: int) -> list[dict]:
    """Последний столбец истории позиций: фраза, позиция, найденный адрес."""
    rows, page = [], 1
    while True:
        res = _call(f"/result/ranktracker/positions_history/{pid}/{page}")
        chunk = _extract_rows(res)
        if not chunk:
            break
        rows += chunk
        page += 1
        if page > 50:
            raise RushError("история позиций не кончается — обрыв на 50-й странице")
    return rows


def _extract_rows(res) -> list[dict]:
    """Форма ответа у сервиса плавает между `{...: [...]}` и голым списком.
    Разбираем обе, но молча пустой список не возвращаем — это делает вызывающий."""
    if isinstance(res, list):
        return res
    if isinstance(res, dict):
        for k in ("data", "rows", "result", "keywords", "positions"):
            v = res.get(k)
            if isinstance(v, list):
                return v
            if isinstance(v, dict) and all(isinstance(x, dict) for x in v.values()):
                return list(v.values())
        if all(isinstance(x, dict) for x in res.values()) and res:
            return list(res.values())
    return []


def normalize(raw: list[dict]) -> list[dict]:
    """Приводит строку сервиса к нашей форме. Позиция вне глубины — DEPTH."""
    out = []
    for r in raw:
        q = _first(r, ("keyword", "query", "phrase", "kw", "name"))
        if q is None:
            continue
        pos = _last_position(r)
        url = _first(r, ("url", "found_url", "relevantUrl", "relevant_url", "landing")) or ""
        out.append({"query": str(q), "position": pos, "url": str(url).strip()})
    return out


def _first(r: dict, keys: tuple):
    for k in keys:
        if k in r and r[k] not in (None, ""):
            return r[k]
    return None


def _last_position(r: dict):
    """Берём самый свежий столбец истории. Ноль и «>100» сервиса — это «не найдено»,
    а не первая позиция: приводим их к отсечке глубины."""
    val = None
    for k in ("position", "pos", "value"):
        if k in r:
            val = r[k]
            break
    if val is None:
        hist = r.get("positions") or r.get("history") or r.get("dynamic")
        if isinstance(hist, dict) and hist:
            val = hist[sorted(hist)[-1]]
        elif isinstance(hist, list) and hist:
            last = hist[-1]
            val = last.get("position") if isinstance(last, dict) else last
    if isinstance(val, dict):
        val = _first(val, ("position", "pos", "value"))
    try:
        n = int(float(val))
    except (TypeError, ValueError):
        return DEPTH
    return DEPTH if n <= 0 or n > DEPTH else n


# ── отбраковка: до записи файла, а не после ─────────────────────────────────

def validate(rows: list[dict], targets: list[dict]) -> list[dict]:
    """Соединяет снимок со списком и отклоняет снимок, которому нельзя верить.

    Три состояния приводят к отказу, а не к записи:

    1. **Болванка свежесозданного проекта** — полный комплект строк, позиция
       ровно на отсечке глубины, посадочные адреса пустые. Неотличима от «мы
       нигде не видны», и записанная однажды, она навсегда останется в ряду
       как провал, которого не было.
    2. **Неполный снимок** — число строк не совпало с числом фраз.
    3. **Фраза из списка не нашлась в снимке.** Сервис возвращает фразы в своём
       регистре: прямое сравнение строк теряет их молча, и при этом проверка
       «число строк совпало» проходит. Поэтому соединяем по нижнему регистру.
    """
    if not rows:
        raise SnapshotRejected("сервис вернул пустой срез — ни одной строки")

    if len(rows) != len(targets):
        raise SnapshotRejected(
            f"неполный снимок: строк {len(rows)}, фраз в списке {len(targets)}. "
            f"Лучше «источник не отдал срез, повторим завтра», чем таблица, "
            f"где половина фраз молча пропала")

    if all(r["position"] >= DEPTH and not r["url"] for r in rows):
        raise SnapshotRejected(
            f"болванка свежесозданного проекта: все {len(rows)} строк на отсечке "
            f"глубины ({DEPTH}) и без посадочных адресов. Первый настоящий сбор — "
            f"примерно через четверть часа после создания проекта")

    by_key = {r["query"].strip().lower(): r for r in rows}
    if len(by_key) != len(rows):
        raise SnapshotRejected("в снимке есть повторяющиеся фразы — соединение неоднозначно")

    joined, missing = [], []
    for t in targets:
        r = by_key.get(t["query"].strip().lower())
        if r is None:
            missing.append(t["query"])
            continue
        joined.append({**t, "position": r["position"], "found_url": r["url"]})
    if missing:
        raise SnapshotRejected(
            f"{len(missing)} фраз из списка не нашлись в снимке (сравнение по нижнему "
            f"регистру): {', '.join(missing[:5])}"
            + (" …" if len(missing) > 5 else ""))
    return joined


# ── снимки ───────────────────────────────────────────────────────────────────

def read_targets(trial: bool) -> list[dict]:
    if not TARGETS.is_file():
        raise RushError(f"нет целевого списка: {TARGETS}")
    with TARGETS.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if trial:
        idx = {r["query"]: r for r in rows}
        picked = [idx[q] for q in TRIAL_QUERIES if q in idx]
        if len(picked) != len(TRIAL_QUERIES):
            raise RushError("пробные фразы должны быть из целевого списка, иначе проба "
                            "проверяет не то, что поедет в бой")
        return picked
    return rows


def write_snapshot(joined: list[dict], day: date) -> Path:
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOTS / f"{day.isoformat()}.csv"
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["query", "locale", "landing", "position", "found_url", "landing_matches"])
        for r in sorted(joined, key=lambda x: (x["locale"], x["position"])):
            found = r["found_url"]
            match = "" if not found else ("да" if r["landing"].rstrip("/") in found.rstrip("/") else "нет")
            w.writerow([r["query"], r["locale"], r["landing"], r["position"], found, match])
    return path


def load_snapshot(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return {r["query"].strip().lower(): r for r in csv.DictReader(f)}


def snapshots() -> list[Path]:
    return sorted(SNAPSHOTS.glob("20??-??-??.csv")) if SNAPSHOTS.is_dir() else []


# Порог недельного слоя: сдвиг меньше 2 пунктов — не сигнал.
MIN_SHIFT = 2


def compare(prev_path: Path, cur_path: Path) -> None:
    prev, cur = load_snapshot(prev_path), load_snapshot(cur_path)
    print(f"Позиции (Rush, {REGION_HUMAN})")
    print(f"  {prev_path.stem} → {cur_path.stem}\n")
    common = [q for q in cur if q in prev]
    gone = [q for q in prev if q not in cur]
    if not common:
        print("  Общих фраз нет — сравнивать нечего.")
        return
    top10 = sum(1 for q in common if int(cur[q]["position"]) <= 10)
    top20 = sum(1 for q in common if int(cur[q]["position"]) <= 20)
    out = sum(1 for q in common if int(cur[q]["position"]) >= DEPTH)
    prev_top20 = sum(1 for q in common if int(prev[q]["position"]) <= 20)
    print(f"  фраз в сравнении: {len(common)}"
          + (f" (в прошлом снимке было ещё {len(gone)}, теперь их нет)" if gone else ""))
    print(f"  в топ-10: {top10} · в топ-20: {top20} (было {prev_top20}) · "
          f"вне топ-{DEPTH}: {out}")
    movers = []
    for q in common:
        p, c = int(prev[q]["position"]), int(cur[q]["position"])
        if abs(c - p) >= MIN_SHIFT:
            movers.append((c - p, q, p, c))
    if not movers:
        print(f"\n  Значимых сдвигов нет: ни одна фраза не сдвинулась на "
              f"{MIN_SHIFT}+ пункта. Это нормальный результат недели.")
        return
    print(f"\n  Сдвинулись на {MIN_SHIFT}+ пункта ({len(movers)} из {len(common)}):")
    for d, q, p, c in sorted(movers):
        arrow = "↑" if d < 0 else "↓"
        print(f"    {p:>3} → {c:>3} ({d:+3}) {arrow}  {cur[q]['locale']}  {q}")


# ── команды ──────────────────────────────────────────────────────────────────

def cmd_balance(_args) -> int:
    print(f"Остаток лимитов Rush: {balance():.2f}")
    print("Баланс общий с чужими проектами на этом ключе — каждый наш прогон "
          "тратит в том числе их лимиты.")
    return 0


def cmd_setup(args) -> int:
    name = TRIAL_NAME if args.trial else PROJECT_NAME
    targets = read_targets(args.trial)
    before = balance()
    print(f"Остаток до: {before:.2f}")
    pid, created = ensure_project(name, targets)
    if created:
        print(f"Проект создан: id {pid}, {len(targets)} фраз, {REGION_HUMAN}")
        print("Первый настоящий сбор — примерно через четверть часа. До него "
              "сервис отдаёт болванку, и snapshot её отклонит.")
    else:
        print(f"Проект уже есть: id {pid}. Создание идемпотентно по имени — "
              f"близнец не заведён.")
    after = balance()
    print(f"Остаток после: {after:.2f} (списано {before - after:.2f})")
    return 0


def cmd_snapshot(args) -> int:
    name = TRIAL_NAME if args.trial else PROJECT_NAME
    targets = read_targets(args.trial)
    pid = find_project(name)
    if not pid:
        print(f"Проекта «{name}» нет — сначала `rush.py setup"
              f"{' --trial' if args.trial else ''}`", file=sys.stderr)
        return 1
    before = balance()
    print(f"Проект id {pid} · фраз {len(targets)} · остаток до: {before:.2f}")

    deadline = time.monotonic() + args.timeout
    while True:
        status = project_status(pid)
        if status.lower() in DONE_STATES:
            break
        if status.lower() in FAILED_STATES:
            raise RushError(f"сервис завершил задание со статусом «{status}» — среза не будет")
        left = int(deadline - time.monotonic())
        if left <= 0:
            raise SnapshotRejected(
                f"за {args.timeout // 60} мин. задание не дошло до готовности "
                f"(последний статус «{status}»). Снимок не записан: пустая "
                f"таблица хуже её отсутствия")
        print(f"  статус «{status}», ждём (осталось {left // 60} мин. {left % 60} с.)")
        time.sleep(min(POLL_SEC, max(1, left)))

    # Отбраковка идёт **до** записи файла. Записанная болванка навсегда остаётся
    # в ряду как провал, которого не было, и отличить её потом нечем.
    joined = validate(normalize(fetch_rows(pid)), targets)

    after = balance()
    if args.trial:
        print(f"\nПробный срез ({len(joined)} фраз), остаток после: {after:.2f} "
              f"(списано {before - after:.2f})\n")
        for r in sorted(joined, key=lambda x: x["position"]):
            print(f"  поз. {r['position']:>3}  {r['locale']}  {r['query']}")
            print(f"           {r['found_url'] or '— посадочная не найдена —'}")
        filled = sum(1 for r in joined if r["found_url"])
        print(f"\n  посадочные адреса заполнены у {filled} из {len(joined)} фраз")
        if not filled:
            print("  Полный съём запускать нельзя: пустые адреса у всех фраз — "
                  "признак того, что сбор ещё не прошёл.", file=sys.stderr)
            return 2
        return 0

    path = write_snapshot(joined, args.date or date.today())
    print(f"\nСнимок записан: {path.relative_to(ROOT)} "
          f"(остаток после: {after:.2f}, списано {before - after:.2f})")
    prior = [p for p in snapshots() if p != path]
    if prior:
        print()
        compare(prior[-1], path)
    else:
        print("Предыдущего снимка нет — сравнивать будет со следующей недели.")
    return 0


def cmd_compare(args) -> int:
    snaps = snapshots()
    if len(snaps) < 2:
        print(f"Снимков {len(snaps)} — для сравнения нужно два.", file=sys.stderr)
        return 1
    compare(snaps[-2], snaps[-1])
    return 0


def cmd_selftest(_args) -> int:
    """Проверка отбраковки на синтетических ответах: важно не то, что проверка
    написана, а то, что она срабатывает."""
    targets = [{"query": "Seguro DNV", "locale": "es", "landing": "/es/x/"},
               {"query": "tenerife travel insurance", "locale": "en", "landing": "/en/y/"}]
    cases = [
        ("болванка свежесозданного проекта",
         [{"query": "seguro dnv", "position": DEPTH, "url": ""},
          {"query": "tenerife travel insurance", "position": DEPTH, "url": ""}]),
        ("неполный снимок",
         [{"query": "seguro dnv", "position": 4, "url": "https://segurotenerife.com/es/x/"}]),
        ("подмена фразы при совпавшем числе строк",
         [{"query": "seguro dnv", "position": 4, "url": "https://segurotenerife.com/es/x/"},
          {"query": "seguro de viaje tenerife", "position": 61, "url": "https://segurotenerife.com/"}]),
        ("пустой срез", []),
        ("дубль фразы в снимке",
         [{"query": "seguro dnv", "position": 4, "url": "https://segurotenerife.com/es/x/"},
          {"query": "SEGURO DNV", "position": 9, "url": "https://segurotenerife.com/es/x/"}]),
    ]
    ok = True
    for label, rows in cases:
        try:
            validate(rows, targets)
            print(f"  ПРОВАЛ    {label}: снимок принят, а должен был быть отклонён")
            ok = False
        except SnapshotRejected as e:
            print(f"  отклонён  {label}\n            → {e.args[0][:110]}")

    # Обратная сторона той же проверки: сервис отдаёт фразы в своём регистре, и
    # снимок, который наивное сравнение строк потеряло бы молча, обязан приниматься.
    mixed = [{"query": "SEGURO DNV", "position": 4, "url": "https://segurotenerife.com/es/x/"},
             {"query": "Tenerife Travel Insurance ", "position": 61, "url": "https://segurotenerife.com/"}]
    naive = len({r["query"] for r in mixed} & {t["query"] for t in targets})
    try:
        joined = validate(mixed, targets)
        print(f"  принят    снимок в чужом регистре ({len(joined)} фразы соединены; "
              f"прямое сравнение строк нашло бы {naive} и молча потеряло остальные)")
    except SnapshotRejected as e:
        print(f"  ПРОВАЛ    годный снимок отклонён: {e}")
        ok = False
    print("\nОтбраковка работает." if ok else "\nОтбраковка НЕ работает.")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Внешний съём позиций (Rush Analytics)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("balance").set_defaults(fn=cmd_balance)
    p = sub.add_parser("setup", help="завести проект (идемпотентно по имени)")
    p.add_argument("--trial", action="store_true", help="пробный проект на 5 фразах")
    p.set_defaults(fn=cmd_setup)
    p = sub.add_parser("snapshot", help="забрать срез и записать снимок")
    p.add_argument("--trial", action="store_true")
    p.add_argument("--timeout", type=int, default=POLL_TIMEOUT_SEC)
    p.add_argument("--date", type=date.fromisoformat, help="дата снимка (по умолчанию сегодня)")
    p.set_defaults(fn=cmd_snapshot)
    sub.add_parser("compare", help="два последних снимка").set_defaults(fn=cmd_compare)
    sub.add_parser("selftest", help="проверить, что отбраковка срабатывает").set_defaults(fn=cmd_selftest)
    args = ap.parse_args()
    try:
        return args.fn(args)
    except SnapshotRejected as e:
        print(f"\nСНИМОК ОТКЛОНЁН: {e}", file=sys.stderr)
        return 3
    except RushError as e:
        print(f"\nRUSH НЕДОСТУПЕН: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
