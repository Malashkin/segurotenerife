#!/usr/bin/env python3
"""
Отчёт по трафику: PostHog (поведение на сайте) + Google Search Console (поиск).

Зависимостей нет — только стандартная библиотека. Токен GSC, полученный
через gsc_auth.py, обновляется здесь вручную (refresh_token → access_token),
чтобы не тянуть google-auth ради одного HTTP-запроса.

Конфигурация — ~/.config/segurotenerife/analytics.env (chmod 600):
    POSTHOG_HOST=https://eu.posthog.com
    POSTHOG_PERSONAL_API_KEY=phx_...
    GSC_SITE_URL=sc-domain:segurotenerife.com

Запуск:
    python3 scripts/analytics/report.py [--days 7]

Каждая секция необязательна: нет ключа PostHog — пропускается PostHog,
нет токена GSC — пропускается поиск. Это позволяет начать с одного источника.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
GSC_TOKEN = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"

# Служебные события: заходы менеджера в админку. Без этого фильтра свои же
# визиты составляют большую часть выборки и метрики врут в нашу пользу.
INTERNAL_EVENTS = ("admin_opened",)


def load_config() -> dict:
    cfg = {}
    if CONFIG.is_file():
        for line in CONFIG.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


def post_json(url: str, payload: dict, headers: dict) -> dict:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def rows(result: dict) -> list:
    return result.get("results", [])


# ── PostHog ──────────────────────────────────────────────────────────────────

def posthog_section(cfg: dict, days: int, out: dict) -> None:
    key = cfg.get("POSTHOG_PERSONAL_API_KEY")
    if not key:
        print("PostHog: ключ не задан — пропускаю.\n")
        return
    host = cfg.get("POSTHOG_HOST", "https://eu.posthog.com").rstrip("/")
    # @current вместо числового id: ключ привязан к проекту, и project-based
    # эндпоинты работают, а /api/projects/ отдаёт 403.
    url = f"{host}/api/projects/@current/query/"
    hdr = {"Authorization": f"Bearer {key}"}
    skip = ", ".join(f"'{e}'" for e in INTERNAL_EVENTS)
    since = f"timestamp > now() - interval {days} day"

    def hogql(sql: str) -> list:
        try:
            return rows(post_json(url, {"query": {"kind": "HogQLQuery", "query": sql}}, hdr))
        except urllib.error.HTTPError as e:
            print(f"  PostHog: HTTP {e.code} — {e.read()[:200].decode(errors='replace')}")
            return []

    print(f"=== PostHog · последние {days} дн. (без {skip}) ===")

    totals = hogql(
        f"select count() as events, count(distinct properties.$session_id) as sessions "
        f"from events where {since} and event not in ({skip})"
    )
    if totals:
        ev, ses = totals[0]
        out['posthog'] = {'events': ev, 'sessions': ses}
        print(f"  событий: {ev}   сессий: {ses}")

    print("\n  Страницы:")
    for path, n in hogql(
        f"select replaceRegexpOne(properties.$current_url, '^https?://[^/]+', '') as path, "
        f"count() as n from events where {since} and event = '$pageview' "
        f"group by path order by n desc limit 15"
    ) or [("(нет данных)", "")]:
        print(f"    {n:>5}  {path}")

    print("\n  Каналы:")
    for ch, ai, n in hogql(
        f"select coalesce(properties.traffic_channel, '(не задан)') as ch, "
        f"coalesce(properties.ai_engine, '') as ai, count() as n from events "
        f"where {since} and event = '$pageview' group by ch, ai order by n desc"
    ) or [("(нет данных)", "", "")]:
        label = f"{ch} / {ai}" if ai else ch
        print(f"    {n:>5}  {label}")

    print("\n  Воронка чата:")
    funnel = ["chat_started", "question_asked", "answer_received",
              "chat_handoff_offered", "handoff_clicked", "lead_submitted"]
    counts = dict(hogql(
        f"select event, count() as n from events where {since} and event in "
        f"({', '.join(repr(e) for e in funnel)}) group by event"
    ))
    first = counts.get(funnel[0], 0)
    for step in funnel:
        n = counts.get(step, 0)
        share = f"{n / first * 100:.0f}%" if first else "—"
        print(f"    {n:>5}  {step:<22} {share:>5}")
    print()


# ── Google Search Console ────────────────────────────────────────────────────

def gsc_access_token() -> str | None:
    if not GSC_TOKEN.is_file():
        return None
    t = json.loads(GSC_TOKEN.read_text())
    data = urllib.parse.urlencode({
        "client_id": t["client_id"],
        "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"],
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        t.get("token_uri", "https://oauth2.googleapis.com/token"), data=data, method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)["access_token"]


def gsc_query(token: str, site: str, start: date, end: date,
              dimensions: list, limit: int = 25) -> list:
    payload = {"startDate": start.isoformat(), "endDate": end.isoformat(), "rowLimit": limit}
    if dimensions:
        payload["dimensions"] = dimensions
    url = ("https://www.googleapis.com/webmasters/v3/sites/"
           f"{urllib.parse.quote(site, safe='')}/searchAnalytics/query")
    try:
        return post_json(url, payload, {"Authorization": f"Bearer {token}"}).get("rows", [])
    except urllib.error.HTTPError as e:
        print(f"  GSC: HTTP {e.code} — {e.read()[:200].decode(errors='replace')}")
        return []


def delta(cur: float, prev: float) -> str:
    """Читаемая дельта. Позиция — чем меньше, тем лучше, знак не инвертируем:
    интерпретацию оставляем читателю, чтобы не прятать смысл в форматировании."""
    if prev == 0:
        return "новое" if cur else "—"
    d = cur - prev
    if abs(d) < 0.05:
        return "="
    return f"{d:+.1f}" if isinstance(cur, float) and cur != int(cur) else f"{d:+.0f}"


def gsc_section(cfg: dict, days: int, compare: bool, out: dict) -> None:
    site = cfg.get("GSC_SITE_URL")
    if not site:
        print("Search Console: GSC_SITE_URL не задан — пропускаю.\n")
        return
    try:
        token = gsc_access_token()
    except urllib.error.HTTPError as e:
        detail = e.read()[:200].decode(errors="replace")
        print(f"Search Console: не удалось обновить токен (HTTP {e.code}): {detail}")
        print("  Если приложение осталось в статусе Testing, refresh-токен живёт 7 дней.")
        print("  Переведите его In production и выполните gsc_auth.py заново.\n")
        return
    if not token:
        print(f"Search Console: нет токена ({GSC_TOKEN}) — сначала gsc_auth.py.\n")
        return

    # Данные финализируются с задержкой ~2 суток; берём только полные.
    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)

    print(f"=== Search Console · {start} — {end} (финальные данные) ===")
    tot = gsc_query(token, site, start, end, [], 1)
    cur = tot[0] if tot else {"clicks": 0, "impressions": 0, "ctr": 0, "position": 0}
    out["gsc"] = {"period": [start.isoformat(), end.isoformat()], "totals": cur}

    if compare:
        ptot = gsc_query(token, site, prev_start, prev_end, [], 1)
        prev = ptot[0] if ptot else {"clicks": 0, "impressions": 0, "ctr": 0, "position": 0}
        out["gsc"]["prev_period"] = [prev_start.isoformat(), prev_end.isoformat()]
        out["gsc"]["prev_totals"] = prev
        print(f"  клики: {cur['clicks']} ({delta(cur['clicks'], prev['clicks'])})   "
              f"показы: {cur['impressions']} ({delta(cur['impressions'], prev['impressions'])})   "
              f"CTR: {cur['ctr'] * 100:.2f}%   "
              f"позиция: {cur['position']:.1f} ({delta(cur['position'], prev['position'])})")
        print(f"  предыдущий период: {prev_start} — {prev_end}")
    else:
        print(f"  клики: {cur['clicks']}   показы: {cur['impressions']}   "
              f"CTR: {cur['ctr'] * 100:.2f}%   позиция: {cur['position']:.1f}")

    for dim, title in (("query", "Запросы"), ("page", "Страницы")):
        rows_cur = gsc_query(token, site, start, end, [dim], 200)
        out["gsc"][dim] = rows_cur
        rows_cur.sort(key=lambda r: -r["impressions"])
        prev_map = {}
        if compare:
            prev_rows = gsc_query(token, site, prev_start, prev_end, [dim], 200)
            out["gsc"][f"prev_{dim}"] = prev_rows
            prev_map = {r["keys"][0]: r for r in prev_rows}

        print(f"\n  {title} (топ по показам):")
        if not rows_cur:
            print("    (нет данных)")
            continue
        for r in rows_cur[:15]:
            k = r["keys"][0]
            line = (f"    {r['clicks']:>4} кл. {r['impressions']:>6} пок. "
                    f"поз. {r['position']:>5.1f}  {k}")
            if compare:
                p = prev_map.get(k)
                if p is None:
                    line += "   [новое]"
                else:
                    line += (f"   [пок. {delta(r['impressions'], p['impressions'])}, "
                             f"поз. {delta(r['position'], p['position'])}]")
            print(line)

        # На расстоянии удара: позиции 5–20 — там доработка title/description
        # даёт клики быстрее, чем любая новая статья.
        striking = [r for r in rows_cur if 5 <= r["position"] <= 20]
        if striking:
            striking.sort(key=lambda r: -r["impressions"])
            out["gsc"][f"striking_{dim}"] = striking
            print(f"\n  {title} на расстоянии удара (позиции 5–20):")
            for r in striking[:10]:
                print(f"    {r['clicks']:>4} кл. {r['impressions']:>6} пок. "
                      f"поз. {r['position']:>5.1f}  {r['keys'][0]}")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description="Отчёт по трафику Seguro Tenerife")
    ap.add_argument("--days", type=int, default=7, help="глубина отчёта в днях (по умолчанию 7)")
    ap.add_argument("--compare", action="store_true",
                    help="сравнить с предыдущим периодом такой же длины")
    ap.add_argument("--json", dest="json_path",
                    help="дополнительно сохранить сырые данные в JSON по этому пути")
    args = ap.parse_args()

    cfg = load_config()
    if not cfg:
        print(f"Нет конфигурации: {CONFIG}", file=sys.stderr)
        return 1

    out: dict = {"generated": date.today().isoformat(), "days": args.days}
    posthog_section(cfg, args.days, out)
    gsc_section(cfg, args.days, args.compare, out)

    if args.json_path:
        Path(args.json_path).write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"Сырые данные: {args.json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
