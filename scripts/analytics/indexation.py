#!/usr/bin/env python3
"""
Контроль индексации страниц через Search Console URL Inspection API.

Зачем отдельно от report.py: Search Analytics показывает только те страницы,
которые УЖЕ получают показы. Страница, которую Google не увидел, в нём просто
отсутствует — и молчание неотличимо от «плохо ранжируется». URL Inspection
отвечает на другой вопрос: знает ли Google про этот URL вообще.

Квоты Google: 2000 запросов в сутки и 600 в минуту на ресурс. Поэтому:
  - результаты кэшируются в ~/.config/segurotenerife/indexation.json;
  - проиндексированные URL перепроверяются раз в 7 дней, проблемные — каждый
    запуск (их состояние меняется, и именно оно нас интересует).

Запуск:
    python3 scripts/analytics/indexation.py            # все URL из sitemap
    python3 scripts/analytics/indexation.py --limit 30 # ограничить расход квоты
    python3 scripts/analytics/indexation.py --force    # игнорировать кэш
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
TOKEN = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"
STATE = Path.home() / ".config" / "segurotenerife" / "indexation.json"
SITEMAP = "https://segurotenerife.com/sitemap-0.xml"
RECHECK_OK_DAYS = 7  # проиндексированные перепроверяем раз в неделю


def load_config() -> dict:
    cfg = {}
    if CONFIG.is_file():
        for line in CONFIG.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


def access_token() -> str:
    t = json.loads(TOKEN.read_text())
    data = urllib.parse.urlencode({
        "client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(t.get("token_uri", "https://oauth2.googleapis.com/token"),
                                 data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def sitemap_urls() -> list[str]:
    """URL из sitemap. Берём <loc>, alternate-ссылки игнорируем — они дублируют
    те же страницы и сожгли бы квоту впятеро."""
    # Без User-Agent Cloudflare перед сайтом отвечает 403.
    req = urllib.request.Request(SITEMAP, headers={"User-Agent": "seguro-tenerife-indexation/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml = r.read().decode()
    return re.findall(r"<loc>(.*?)</loc>", xml)


def inspect(token: str, site: str, url: str) -> dict:
    body = {"inspectionUrl": url, "siteUrl": site, "languageCode": "ru"}
    req = urllib.request.Request("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                                 data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)["inspectionResult"]["indexStatusResult"]
    return {
        "verdict": res.get("verdict"),
        "coverage": res.get("coverageState"),
        "last_crawl": res.get("lastCrawlTime"),
        "checked": date.today().isoformat(),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Контроль индексации страниц")
    ap.add_argument("--limit", type=int, default=200, help="максимум проверок за запуск")
    ap.add_argument("--force", action="store_true", help="игнорировать кэш")
    args = ap.parse_args()

    cfg = load_config()
    site = cfg.get("GSC_SITE_URL")
    if not site or not TOKEN.is_file():
        print("Нужны GSC_SITE_URL и токен (gsc_auth.py).", file=sys.stderr)
        return 1

    state = json.loads(STATE.read_text()) if STATE.is_file() else {}
    try:
        token = access_token()
    except urllib.error.HTTPError as e:
        print(f"Не удалось обновить токен (HTTP {e.code}). Если приложение в статусе "
              f"Testing — refresh-токен живёт 7 дней.", file=sys.stderr)
        return 1

    try:
        urls = sitemap_urls()
    except urllib.error.URLError as e:
        print(f"Sitemap недоступен: {e}", file=sys.stderr)
        return 1

    cutoff = (date.today() - timedelta(days=RECHECK_OK_DAYS)).isoformat()
    todo = []
    for u in urls:
        prev = state.get(u)
        if args.force or prev is None:
            todo.append(u)
        elif prev.get("verdict") != "PASS":
            todo.append(u)          # проблемные — каждый запуск
        elif prev.get("checked", "") < cutoff:
            todo.append(u)          # успешные — раз в неделю
    todo = todo[: args.limit]

    print(f"В sitemap: {len(urls)} URL. К проверке: {len(todo)} "
          f"(остальные проверены недавно и проиндексированы).")

    for i, u in enumerate(todo, 1):
        try:
            state[u] = inspect(token, site, u)
        except urllib.error.HTTPError as e:
            detail = e.read()[:150].decode(errors="replace")
            print(f"  [{i}/{len(todo)}] HTTP {e.code} на {u}: {detail}")
            if e.code == 429:
                print("  Квота исчерпана — сохраняю то, что успел, и выхожу.")
                break
            continue
        time.sleep(0.15)  # держимся ниже лимита 600 запросов в минуту

    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

    # Сводка по всем известным URL, а не только по проверенным в этот раз.
    buckets: dict[str, list[str]] = {}
    for u in urls:
        v = state.get(u)
        key = "не проверялся" if not v else (v.get("coverage") or v.get("verdict") or "?")
        buckets.setdefault(key, []).append(u)

    print("\n=== Индексация ===")
    for key in sorted(buckets, key=lambda k: -len(buckets[k])):
        print(f"  {len(buckets[key]):>4}  {key}")

    problems = [u for u in urls
                if state.get(u) and state[u].get("verdict") != "PASS"]
    if problems:
        print(f"\n  Не в индексе ({len(problems)}):")
        for u in problems[:25]:
            print(f"    {state[u].get('coverage', '?')}  {u}")
        if len(problems) > 25:
            print(f"    … и ещё {len(problems) - 25}")
    print(f"\nСостояние: {STATE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
