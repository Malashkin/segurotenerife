#!/usr/bin/env python3
"""
Позиции без самообмана: разложение сдвига средней позиции на движение и смену микса.

Зачем отдельный инструмент. «Средняя позиция» в Search Console — это среднее по
показам за период. Если меняется набор запросов, по которым нас показывают, среднее
уезжает, даже когда ни одна страница никуда не сдвинулась. На нашем объёме это
происходит постоянно: одна новая статья, зацепившая хвост на 80-й позиции, ухудшает
«среднюю по сайту» сильнее, чем реальный рост остальных её улучшает.

Отсюда правило и этот скрипт: сравнивать позиции можно только на фиксированной
корзине запросов — тех, что были в обоих периодах, с весами базового периода
(индекс Ласпейреса). Тогда сдвиг корзины — это движение выдачи, а остаток до
«официальной» дельты — вклад смены микса.

Чего скрипт принципиально не делает: не ходит в поиск сам. Ручная проверка позиции
в браузере даёт персонализированную выдачу (история, гео, устройство) и вдобавок
портит единственный честный источник — свой же показ в Search Console.

Запуск:
    python3 scripts/analytics/positions.py --days 28              # разложение сдвига
    python3 scripts/analytics/positions.py --days 28 --segment device
    python3 scripts/analytics/positions.py --query "seguro dnv"   # срез по одному запросу
    python3 scripts/analytics/positions.py --page /es/blog/pet-insurance-spain/
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import load_config, post_json, gsc_access_token  # noqa: E402

API = "https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"

# Пороги значимости контура: ниже — шум, а не вывод.
MIN_IMPRESSIONS = 10
MIN_POSITION_SHIFT = 3.0


class DataUnavailable(RuntimeError):
    """GSC не отдала данные. Отдельный тип, чтобы пустой ответ не выглядел как «нулей нет»."""


def query(token: str, site: str, start: date, end: date, dimensions: list,
          filters: list | None = None) -> list:
    """Строки Search Console. На 5xx/429 — три попытки, дальше исключение.

    Молча вернуть пустой список нельзя: ноль показов и недоступные данные — разные
    вещи, а перепутать их означает соврать читателю отчёта."""
    url = API.format(site=urllib.parse.quote(site, safe=""))
    rows, start_row = [], 0
    while True:
        payload = {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": dimensions,
            "rowLimit": 25000,
            "startRow": start_row,
        }
        if filters:
            payload["dimensionFilterGroups"] = [{"filters": filters}]
        batch = None
        for attempt in range(3):
            try:
                batch = post_json(url, payload, {"Authorization": f"Bearer {token}"}).get("rows", [])
                break
            except urllib.error.HTTPError as e:
                detail = e.read()[:160].decode(errors="replace").replace("\n", " ")
                if e.code in (429, 500, 502, 503) and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise DataUnavailable(f"HTTP {e.code} на срезе {dimensions or 'итог'}: {detail}")
        rows += batch
        if len(batch) < 25000:
            return rows
        start_row += 25000


def weighted(rows: list) -> tuple[float, int]:
    """Средняя позиция, взвешенная по показам, и сумма показов."""
    imp = sum(r["impressions"] for r in rows)
    if not imp:
        return 0.0, 0
    return sum(r["position"] * r["impressions"] for r in rows) / imp, imp


def decompose(cur: list, prev: list, label: str) -> dict:
    """Раскладывает сдвиг позиции на движение выдачи и смену микса запросов."""
    cur_map = {r["keys"][0]: r for r in cur}
    prev_map = {r["keys"][0]: r for r in prev}
    basket = sorted(set(cur_map) & set(prev_map))

    pos_cur, imp_cur = weighted(cur)
    pos_prev, imp_prev = weighted(prev)

    w = {q: prev_map[q]["impressions"] for q in basket}
    wsum = sum(w.values())
    if wsum:
        fixed_cur = sum(w[q] * cur_map[q]["position"] for q in basket) / wsum
        fixed_prev = sum(w[q] * prev_map[q]["position"] for q in basket) / wsum
    else:
        fixed_cur = fixed_prev = 0.0

    movement = fixed_cur - fixed_prev
    total = pos_cur - pos_prev
    coverage = sum(cur_map[q]["impressions"] for q in basket) / imp_cur if imp_cur else 0

    print(f"\n=== {label} ===")
    print(f"  показы: {imp_prev} → {imp_cur}")
    print(f"  «официальная» средняя позиция: {pos_prev:.1f} → {pos_cur:.1f} ({total:+.1f})")
    if len(basket) < 3 or wsum < MIN_IMPRESSIONS:
        print(f"  корзина: {len(basket)} запр., {wsum} показов — мало для разложения, вывод не делается")
        return {"basket": len(basket), "movement": None, "mix": None}
    print(f"  корзина (запросы в обоих периодах): {len(basket)} запр., "
          f"покрытие текущих показов {coverage * 100:.0f}%")
    print(f"  позиция на фиксированной корзине: {fixed_prev:.1f} → {fixed_cur:.1f} "
          f"({movement:+.1f}) ← движение выдачи")
    print(f"  вклад смены микса: {total - movement:+.1f}")
    verdict = ("движения нет" if abs(movement) < MIN_POSITION_SHIFT
               else ("выдача выросла" if movement < 0 else "выдача просела"))
    print(f"  вывод: {verdict} (порог значимости — {MIN_POSITION_SHIFT:.0f} пункта)")

    movers = []
    for q in basket:
        c, p = cur_map[q], prev_map[q]
        if min(c["impressions"], p["impressions"]) < MIN_IMPRESSIONS:
            continue
        d = c["position"] - p["position"]
        if abs(d) >= MIN_POSITION_SHIFT:
            movers.append((d, q, p, c))
    if movers:
        print(f"\n  Сдвинулись значимо (≥ {MIN_IMPRESSIONS} показов в обоих периодах, "
              f"≥ {MIN_POSITION_SHIFT:.0f} пункта):")
        for d, q, p, c in sorted(movers):
            print(f"    {p['position']:>5.1f} → {c['position']:>5.1f} ({d:+5.1f})  "
                  f"{p['impressions']:>4}→{c['impressions']:<4} пок.  {q}")
    else:
        print(f"\n  Значимых сдвигов нет: ни один запрос не набрал {MIN_IMPRESSIONS} показов "
              f"в обоих периодах при сдвиге ≥ {MIN_POSITION_SHIFT:.0f} пункта.")
    return {"basket": len(basket), "coverage": coverage, "movement": movement,
            "mix": total - movement, "total": total,
            "movers": [{"query": q, "prev": p["position"], "cur": c["position"]} for _, q, p, c in movers]}


def pinned(token: str, site: str, start: date, end: date, dim_filter: list, title: str) -> dict:
    """Срез по одному запросу или странице: позиции по устройствам и странам отдельно.

    Среднее по смешанным сегментам не печатается сознательно — именно оно и врёт.
    Зато печатается покрытие: любой разрез по device/country/query теряет показы,
    которые Google анонимизировал, и на маленькой странице потеря доходит до 80%."""
    out = {"title": title}
    print(f"\n=== {title} · {start} — {end} ===")
    total = query(token, site, start, end, [], dim_filter)
    total_imp = total[0]["impressions"] if total else 0
    total_pos = total[0]["position"] if total else 0.0
    out["total"] = {"impressions": total_imp, "position": total_pos,
                    "clicks": total[0]["clicks"] if total else 0}
    if not total_imp:
        print("  Показов за период нет.")
        return out
    print(f"  Всего: {total_imp} пок., {out['total']['clicks']} кл., поз. {total_pos:.1f}"
          + ("" if total_imp >= MIN_IMPRESSIONS else "   ← ниже порога значимости"))
    for dim, human in (("device", "устройствам"), ("country", "странам")):
        rows = query(token, site, start, end, [dim], dim_filter)
        rows.sort(key=lambda r: -r["impressions"])
        out[dim] = rows
        seg_imp = sum(r["impressions"] for r in rows)
        share = seg_imp / total_imp
        print(f"\n  По {human} (покрытие {seg_imp}/{total_imp} = {share * 100:.0f}%"
              + ("):" if share >= 0.5 else " — остальное Google анонимизировал):"))
        if not rows:
            print("    (нет данных)")
            continue
        for r in rows:
            mark = "" if r["impressions"] >= MIN_IMPRESSIONS else "   ← шум, вывода не делать"
            print(f"    {r['keys'][0]:8} {r['impressions']:>5} пок. {r['clicks']:>3} кл. "
                  f"поз. {r['position']:>5.1f}{mark}")
        if share < 0.5:
            print(f"    ⚠ виден меньше половины спроса — сегментные позиции здесь "
                  f"ориентир, а не измерение")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Позиции Search Console без искажения миксом")
    ap.add_argument("--days", type=int, default=28, help="длина периода (по умолчанию 28)")
    ap.add_argument("--segment", choices=("device", "country"),
                    help="разложить отдельно внутри каждого сегмента")
    ap.add_argument("--query", help="срез по одному запросу")
    ap.add_argument("--page", help="срез по одной странице (путь или полный URL)")
    ap.add_argument("--json", dest="json_path", help="сохранить результат в JSON")
    args = ap.parse_args()

    cfg = load_config()
    site = cfg.get("GSC_SITE_URL")
    if not site:
        print("Нет GSC_SITE_URL в конфигурации", file=sys.stderr)
        return 1
    try:
        token = gsc_access_token()
    except urllib.error.HTTPError as e:
        print(f"Search Console: токен не обновился (HTTP {e.code}). "
              f"Если приложение в статусе Testing — refresh живёт 7 дней, "
              f"перезапустите gsc_auth.py.", file=sys.stderr)
        return 1
    if not token:
        print("Нет токена Search Console — сначала gsc_auth.py", file=sys.stderr)
        return 1

    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=args.days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=args.days - 1)
    out: dict = {"generated": date.today().isoformat(),
                 "period": [start.isoformat(), end.isoformat()],
                 "prev_period": [prev_start.isoformat(), prev_end.isoformat()]}

    try:
        return run(args, token, site, start, end, prev_start, prev_end, out)
    except DataUnavailable as e:
        print(f"\nДАННЫЕ НЕ ПОЛУЧЕНЫ: {e}", file=sys.stderr)
        print("Отчёт не строится. Ноль показов и недоступные данные — разные вещи, "
              "и выдавать одно за другое нельзя.", file=sys.stderr)
        return 2


def run(args, token, site, start, end, prev_start, prev_end, out) -> int:
    if args.query or args.page:
        if args.query:
            f = [{"dimension": "query", "operator": "equals", "expression": args.query}]
            title = f"Запрос «{args.query}»"
        else:
            url = args.page if args.page.startswith("http") else \
                "https://segurotenerife.com" + args.page
            f = [{"dimension": "page", "operator": "equals", "expression": url}]
            title = f"Страница {url}"
        out["pinned"] = pinned(token, site, start, end, f, title)
        out["pinned_prev"] = pinned(token, site, prev_start, prev_end, f, title + " · предыдущий период")
        print("\nСреднее по смешанным сегментам не выводится намеренно: "
              "сравнивать позиции можно только внутри сегмента.")
    else:
        print(f"Период: {start} — {end}   ·   предыдущий: {prev_start} — {prev_end}")
        cur = query(token, site, start, end, ["query"])
        prev = query(token, site, prev_start, prev_end, ["query"])
        out["site"] = decompose(cur, prev, "Весь сайт")

        if args.segment:
            values = {r["keys"][0] for r in query(token, site, start, end, [args.segment])}
            out["segments"] = {}
            for v in sorted(values):
                f = [{"dimension": args.segment, "operator": "equals", "expression": v}]
                c = query(token, site, start, end, ["query"], f)
                p = query(token, site, prev_start, prev_end, ["query"], f)
                out["segments"][v] = decompose(c, p, f"{args.segment}: {v}")

        print("\nОграничения, о которых нужно помнить при чтении:")
        print("  · часть запросов Google анонимизирует — сумма по запросам меньше суммы по сайту")
        print("    (на нашем объёме теряется около трети показов);")
        print("  · позиция внутри запроса тоже усредняется по странам и устройствам —")
        print("    для точной проверки берите --query/--page или --segment;")
        print("  · ручная проверка позиции в браузере не является измерением: она "
              "персонализирована\n    и создаёт лишний показ в тех же данных.")

    if args.json_path:
        Path(args.json_path).write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"\nСырые данные: {args.json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
