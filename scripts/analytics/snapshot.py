#!/usr/bin/env python3
"""
Дневной срез метрик Search Console в историю и отчёты по этой истории.

Зачем нужен, если есть report.py: report.py отвечает на вопрос «что сейчас» и
сравнивает окно с предыдущим. Он не хранит ничего. Вопрос «росли ли мы восемь
недель подряд или это отскок после провала» по нему не решается — а именно он
отделяет тренд от шума на нашем объёме трафика.

Поэтому история копится в `docs/seo/metrics.csv` — по строке на день, в
репозитории, рядом с журналом решений. Файл маленький (десятки байт на день) и
версионируется вместе с правками, ради которых он и ведётся.

Данные всегда перечитываются из Search Console за окно `--days`, а не
дописываются одной строкой: показатели последних дней Google уточняет задним
числом, и пропущенный запуск не должен оставлять дыру.

Запуск:
    python3 scripts/analytics/snapshot.py                  # обновить историю за 30 дней
    python3 scripts/analytics/snapshot.py --days 480       # первичный бэкфилл (GSC хранит 16 мес.)
    python3 scripts/analytics/snapshot.py --report daily   # + таблица последних 14 дней
    python3 scripts/analytics/snapshot.py --report weekly  # + 8 недель понедельными итогами
    python3 scripts/analytics/snapshot.py --no-write --report weekly   # только прочитать
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
GSC_TOKEN = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"
INDEX_STATE = Path.home() / ".config" / "segurotenerife" / "indexation.json"
METRICS = Path(__file__).resolve().parents[2] / "docs" / "seo" / "metrics.csv"

FIELDS = ["date", "clicks", "impressions", "ctr", "position", "indexed", "sitemap_urls"]


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
    t = json.loads(GSC_TOKEN.read_text())
    data = urllib.parse.urlencode({
        "client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        t.get("token_uri", "https://oauth2.googleapis.com/token"), data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def gsc_by_date(token: str, site: str, days: int) -> list[dict]:
    end = date.today()
    start = end - timedelta(days=days)
    url = ("https://www.googleapis.com/webmasters/v3/sites/"
           f"{urllib.parse.quote(site, safe='')}/searchAnalytics/query")
    body = json.dumps({"startDate": start.isoformat(), "endDate": end.isoformat(),
                       "dimensions": ["date"], "rowLimit": 25000}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r).get("rows", [])


def indexation_counts() -> tuple[int, int] | tuple[None, None]:
    """Сколько URL кэш считает проиндексированными. Срез на момент запуска —
    в отличие от метрик поиска, у него нет «своей» даты, поэтому он
    проставляется только самой свежей строке истории."""
    if not INDEX_STATE.is_file():
        return None, None
    state = json.loads(INDEX_STATE.read_text())
    if not state:
        return None, None
    indexed = sum(1 for v in state.values() if v.get("verdict") == "PASS")
    return indexed, len(state)


def read_history() -> dict[str, dict]:
    if not METRICS.is_file():
        return {}
    with METRICS.open(newline="", encoding="utf-8") as f:
        return {row["date"]: row for row in csv.DictReader(f) if row.get("date")}


def write_history(hist: dict[str, dict]) -> None:
    METRICS.parent.mkdir(parents=True, exist_ok=True)
    with METRICS.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for d in sorted(hist):
            w.writerow({k: hist[d].get(k, "") for k in FIELDS})


def update_history(rows: list[dict], hist: dict[str, dict]) -> tuple[int, int]:
    """Апсерт по дате: метрики поиска всегда перезаписываются свежими
    (Google уточняет их несколько суток), уже записанная индексация — нет."""
    added = updated = 0
    for r in rows:
        d = r["keys"][0]
        prev = hist.get(d)
        row = dict(prev) if prev else {"date": d}
        row.update({
            "clicks": int(r["clicks"]),
            "impressions": int(r["impressions"]),
            "ctr": f"{r['ctr']:.5f}",
            "position": f"{r['position']:.2f}",
        })
        hist[d] = row
        if prev is None:
            added += 1
        elif prev != row:
            updated += 1
    return added, updated


def stamp_indexation(hist: dict[str, dict]) -> None:
    indexed, total = indexation_counts()
    if indexed is None or not hist:
        return
    latest = max(hist)
    hist[latest]["indexed"] = indexed
    hist[latest]["sitemap_urls"] = total


# ── Отчёты по истории ────────────────────────────────────────────────────────

def num(row: dict, key: str, default: float = 0.0) -> float:
    v = row.get(key, "")
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def aggregate(rows: list[dict]) -> dict:
    """Средняя позиция взвешивается по показам: день с двумя показами не должен
    весить столько же, сколько день с двумя сотнями."""
    clicks = sum(num(r, "clicks") for r in rows)
    impr = sum(num(r, "impressions") for r in rows)
    pos = (sum(num(r, "position") * num(r, "impressions") for r in rows) / impr) if impr else 0.0
    return {"clicks": int(clicks), "impressions": int(impr),
            "ctr": (clicks / impr * 100) if impr else 0.0, "position": pos,
            "days": len(rows)}


def fmt_delta(cur: float, prev: float, digits: int = 0) -> str:
    if prev == 0:
        return "новое" if cur else "—"
    d = cur - prev
    if abs(d) < (0.05 if digits else 0.5):
        return "="
    return f"{d:+.{digits}f}"


def report_daily(hist: dict[str, dict], n: int = 14) -> None:
    days = sorted(hist)[-n:]
    if not days:
        print("История пуста.")
        return
    print(f"=== Дни ({days[0]} — {days[-1]}) ===")
    print(f"  {'дата':<12}{'клики':>7}{'показы':>9}{'CTR':>8}{'позиция':>9}")
    for d in days:
        r = hist[d]
        ctr = num(r, "ctr") * 100
        print(f"  {d:<12}{int(num(r, 'clicks')):>7}{int(num(r, 'impressions')):>9}"
              f"{ctr:>7.2f}%{num(r, 'position'):>9.1f}")


def report_weekly(hist: dict[str, dict], weeks: int = 8) -> None:
    """Неделя = понедельник–воскресенье. Незакрытая текущая неделя показывается
    отдельно и в сравнение не идёт: сравнивать три дня с семью бессмысленно."""
    if not hist:
        print("История пуста.")
        return
    buckets: dict[str, list[dict]] = {}
    for d in sorted(hist):
        day = date.fromisoformat(d)
        monday = (day - timedelta(days=day.weekday())).isoformat()
        buckets.setdefault(monday, []).append(hist[d])

    keys = sorted(buckets)[-weeks:]
    print(f"=== Недели (последние {len(keys)}) ===")
    print(f"  {'неделя с':<12}{'дней':>5}{'клики':>8}{'показы':>9}{'CTR':>8}"
          f"{'позиция':>9}   {'к прошлой':<20}")
    prev_agg = None
    for k in keys:
        agg = aggregate(buckets[k])
        cmp_txt = ""
        if prev_agg and agg["days"] == 7 and prev_agg["days"] == 7:
            cmp_txt = (f"пок. {fmt_delta(agg['impressions'], prev_agg['impressions'])}, "
                       f"поз. {fmt_delta(agg['position'], prev_agg['position'], 1)}")
        mark = "" if agg["days"] == 7 else f" (неполная)"
        print(f"  {k:<12}{agg['days']:>5}{agg['clicks']:>8}{agg['impressions']:>9}"
              f"{agg['ctr']:>7.2f}%{agg['position']:>9.1f}   {cmp_txt:<20}{mark}")
        prev_agg = agg

    # Индексация: показываем только те дни, где срез вообще записан.
    idx = [(d, hist[d]) for d in sorted(hist) if hist[d].get("indexed")]
    if idx:
        print("\n  Индексация (срезы):")
        for d, r in idx[-5:]:
            print(f"    {d}  {r['indexed']}/{r.get('sitemap_urls', '?')} в индексе")


def main() -> int:
    ap = argparse.ArgumentParser(description="История метрик Search Console")
    ap.add_argument("--days", type=int, default=30,
                    help="глубина перечитывания из GSC (по умолчанию 30)")
    ap.add_argument("--report", choices=("daily", "weekly", "none"), default="none")
    ap.add_argument("--no-write", action="store_true",
                    help="не обращаться к GSC и не менять историю — только отчёт")
    args = ap.parse_args()

    hist = read_history()

    if not args.no_write:
        cfg = load_config()
        site = cfg.get("GSC_SITE_URL")
        if not site or not GSC_TOKEN.is_file():
            print("Нужны GSC_SITE_URL и токен (gsc_auth.py).", file=sys.stderr)
            return 1
        try:
            token = access_token()
            rows = gsc_by_date(token, site, args.days)
        except urllib.error.HTTPError as e:
            print(f"Search Console: HTTP {e.code} — {e.read()[:200].decode(errors='replace')}",
                  file=sys.stderr)
            print("Если приложение в статусе Testing, refresh-токен живёт 7 дней.",
                  file=sys.stderr)
            return 1
        added, updated = update_history(rows, hist)
        stamp_indexation(hist)
        write_history(hist)
        print(f"История {METRICS}: всего дней {len(hist)}, "
              f"добавлено {added}, уточнено {updated}.\n")

    if args.report == "daily":
        report_daily(hist)
    elif args.report == "weekly":
        report_weekly(hist)
    return 0


if __name__ == "__main__":
    sys.exit(main())
