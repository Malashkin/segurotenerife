#!/usr/bin/env python3
"""
Разбор странового спроса по интенту, а не по объёму.

Зачем. «Великобритания — крупнейшая страна сайта по показам» — утверждение об
объёме, и из него ничего не следует: 2 800 показов туристу, который покупает
полис дома, стоят ровно ноль. Ответ даёт только разложение запросов страны по
интенту — кто из них может стать нашим лидом, а кто нет. Руками это делается
один раз и потом не воспроизводится; отсюда скрипт.

Что делает:

  * тянет срез Search Console с фильтром по стране (`query`, `query × page`);
  * раскладывает запросы по вёдрам интента правилами из INTENT_RULES;
  * считает по каждому ведру показы, клики и позицию, а при `--compare` —
    сдвиг по **фиксированной корзине** (та же логика, что в `positions.py`:
    средняя по меняющемуся набору запросов ничего не значит);
  * при `--pages` показывает, какая страница ловит каждый запрос ведра, и
    отдельно — запросы, которые ловит больше одной страницы.

Чего принципиально не делает: не решает, целевой ли лид. Классификатор
отвечает «про что запрос», а не «наш ли он» — второе проверяется условием 2
правил отбора (`docs/seo/backlog.md`): продукт, драйвер, канал, экономика лида.

Честность важнее полноты в двух местах. Search Console анонимизирует часть
запросов: сумма по `query` меньше итога по стране, и разница выводится
отдельной строкой, а не растворяется в вёдрах. И запрос без явного маркера
попадает в `undetermined`, а не в ближайшее по смыслу ведро: ведро, набитое
догадками, выглядит убедительнее, чем есть.

Запуск:
    python3 scripts/analytics/intent.py --country gbr --days 28 --compare
    python3 scripts/analytics/intent.py --country gbr --days 90 --pages
    python3 scripts/analytics/intent.py --country esp --days 28 --path /en/
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import load_config, gsc_access_token  # noqa: E402
from positions import query as gsc_rows, DataUnavailable, MIN_IMPRESSIONS, MIN_POSITION_SHIFT  # noqa: E402

# Порядок важен: первое совпавшее правило выигрывает. Поэтому сверху стоят
# исключения, которые иначе утонули бы в широком правиле ниже, — «expat annual
# multi-trip» это travel insurance, но искатель уже живёт в Испании.
INTENT_RULES: list[tuple[str, list[str]]] = [
    # Резидент, который путешествует: продукт из линии viaje, аудитория — наша.
    ("expat_travel", [
        r"multi.?trip", r"expat annual", r"family annual travel", r"seguro de viaje anual",
        r"travel insurance (for )?expats", r"long term travel insurance",
    ]),
    # Информационные запросы про устройство здравоохранения: без маркера
    # «переезжаю» или «турист» отнести их некуда, и догадываться мы не будем.
    ("undetermined", [
        r"healthcare system", r"medical centres", r"healthcare free", r"public health charge",
        r"^insurance tenerife$", r"^private health ?care$", r"private healthcare in spain",
    ]),
    # Живёт или собирается жить: виза, ВНЖ, частная медицина, семья, переезд.
    ("resident", [
        r"\bdnv\b", r"digital nomad", r"non.?lucrative", r"\bnlv\b",
        r"student (visa|insurance|health)", r"health insurance (for )?(spain )?student",
        r"family reunion", r"family member visa", r"\bexpat", r"retiring", r"how to move",
        r"reimbursement", r"reembolso", r"private healthcare", r"private health insurance",
        r"residency", r"visa insurance", r"convenio especial",
        r"life insurance", r"funeral insurance", r"pet insurance", r"accident cover",
        r"pre.?existing", r"cuadro medico", r"carencia", r"copay",
    ]),
    # Турист: приехал ненадолго, полис купит дома (разбор — SEGU-37).
    ("tourist", [
        r"travel insurance", r"holiday insurance", r"cruise", r"\btravel cover\b",
    ]),
]

BUCKETS = ["tourist", "resident", "expat_travel", "undetermined"]
TITLES = {
    "tourist": "турист",
    "resident": "резидент / релокант",
    "expat_travel": "резидент в поездке (viaje)",
    "undetermined": "не определён",
}


def classify(q: str) -> str:
    """Ведро интента по тексту запроса. Без совпадений — `undetermined`."""
    low = q.lower()
    for bucket, patterns in INTENT_RULES:
        if any(re.search(p, low) for p in patterns):
            return bucket
    return "undetermined"


def fetch(token: str, site: str, start: date, end: date,
          country: str, path: str | None) -> dict:
    filters = [{"dimension": "country", "operator": "equals", "expression": country}]
    if path:
        filters.append({"dimension": "page", "operator": "contains", "expression": path})
    return {
        "total": gsc_rows(token, site, start, end, [], filters),
        "queries": gsc_rows(token, site, start, end, ["query"], filters),
        "query_page": gsc_rows(token, site, start, end, ["query", "page"], filters),
    }


def split(rows: list) -> dict:
    out: dict[str, list] = defaultdict(list)
    for r in rows:
        out[classify(r["keys"][0])].append(r)
    return out


def weighted_position(rows: list) -> float:
    imp = sum(r["impressions"] for r in rows)
    return sum(r["position"] * r["impressions"] for r in rows) / imp if imp else 0.0


def print_buckets(data: dict, label: str) -> dict:
    rows = data["queries"]
    named = sum(r["impressions"] for r in rows)
    total = data["total"][0]["impressions"] if data["total"] else 0
    hidden = total - named

    print(f"\n===== {label} =====")
    print(f"  итог по стране: {total} показов, "
          f"{data['total'][0]['clicks'] if data['total'] else 0} кликов")
    print(f"  разложимо по запросам: {named} ({named / total * 100:.1f}%)" if total else "")
    if hidden > 0:
        print(f"  анонимизировано Search Console: {hidden} "
              f"({hidden / total * 100:.1f}%) — по вёдрам не раскладывается")

    buckets = split(rows)
    for b in BUCKETS:
        rs = sorted(buckets.get(b, []), key=lambda r: -r["impressions"])
        imp = sum(r["impressions"] for r in rs)
        clicks = sum(r["clicks"] for r in rs)
        share = imp / named * 100 if named else 0
        over = [r for r in rs if r["impressions"] >= MIN_IMPRESSIONS]
        print(f"\n  -- {b} ({TITLES[b]}): {imp} пок. = {share:.1f}% разложимого, "
              f"{clicks} кл., поз. {weighted_position(rs):.1f}")
        print(f"     запросов {len(rs)}, из них выше порога {MIN_IMPRESSIONS} показов: {len(over)}")
        for r in rs:
            # Точка слева — запрос ниже порога значимости: в выводы не идёт.
            mark = " " if r["impressions"] >= MIN_IMPRESSIONS else "."
            print(f"    {mark}{r['impressions']:5.0f} пок. {r['clicks']:3.0f} кл. "
                  f"поз. {r['position']:6.1f}  {r['keys'][0]}")
    return {b: {r["keys"][0]: r for r in rs} for b, rs in buckets.items()}


def print_compare(cur: dict, prev: dict) -> None:
    """Сдвиг позиции по фиксированной корзине внутри каждого ведра."""
    print("\n\n===== Сдвиг по фиксированной корзине (веса базового периода) =====")
    for b in BUCKETS:
        c, p = cur.get(b, {}), prev.get(b, {})
        basket = sorted(set(c) & set(p))
        weights = {q: p[q]["impressions"] for q in basket}
        base = sum(weights.values())
        if base < MIN_IMPRESSIONS or len(basket) < 3:
            print(f"\n  -- {b}: корзина {len(basket)} запр. / {base} показов — "
                  f"ниже порога, вывод не делается")
            continue
        now = sum(weights[q] * c[q]["position"] for q in basket) / base
        was = sum(weights[q] * p[q]["position"] for q in basket) / base
        shift = now - was
        verdict = ("СИГНАЛ" if abs(shift) >= MIN_POSITION_SHIFT
                   else f"ниже порога {MIN_POSITION_SHIFT:.0f} п. — не сигнал")
        print(f"\n  -- {b}: корзина {len(basket)} запр. ({base} пок. в базе)")
        print(f"     позиция: {was:.1f} → {now:.1f} ({shift:+.1f}) — {verdict}")
        print(f"     показы по корзине: {base} → "
              f"{sum(c[q]['impressions'] for q in basket)}")


def print_pages(data: dict, only: set[str]) -> None:
    """Какая страница ловит запрос — и не ловят ли его сразу несколько."""
    by_query: dict[str, list] = defaultdict(list)
    for r in data["query_page"]:
        if classify(r["keys"][0]) in only:
            by_query[r["keys"][0]].append(r)

    print(f"\n\n===== Покрытие страницами: вёдра {', '.join(sorted(only))} =====")
    for q, rs in sorted(by_query.items(), key=lambda kv: -sum(x["impressions"] for x in kv[1])):
        imp = sum(r["impressions"] for r in rs)
        mark = " " if imp >= MIN_IMPRESSIONS else "."
        print(f"  {mark}{imp:5.0f} пок.  {q}")
        for r in sorted(rs, key=lambda r: -r["impressions"]):
            page = r["keys"][1].replace("https://segurotenerife.com", "")
            print(f"          {r['impressions']:5.0f} поз. {r['position']:6.1f}  {page}")
        if len(rs) > 1:
            print("          ^^ запрос делят несколько страниц — каннибализация")


def main() -> int:
    ap = argparse.ArgumentParser(description="Страновой спрос в разрезе интента")
    ap.add_argument("--country", default="gbr", help="код страны ISO-3 (gbr, esp, usa, irl)")
    ap.add_argument("--days", type=int, default=28, help="длина периода (по умолчанию 28)")
    ap.add_argument("--path", help="ограничить срез страницами, содержащими подстроку (напр. /en/)")
    ap.add_argument("--compare", action="store_true", help="сравнить с предыдущим периодом")
    ap.add_argument("--pages", action="store_true", help="показать страницы резидентских вёдер")
    ap.add_argument("--json", dest="json_path", help="сохранить сырые строки в JSON")
    args = ap.parse_args()

    cfg = load_config()
    site = cfg.get("GSC_SITE_URL")
    if not site:
        print("GSC_SITE_URL не задан — нечего запрашивать.", file=sys.stderr)
        return 1
    token = gsc_access_token()
    if not token:
        print("Нет доступа к Search Console. Почти всегда это протухший refresh-токен:\n"
              "OAuth-приложение осталось в статусе Testing. Цифры не выдумываем — выходим.",
              file=sys.stderr)
        return 1

    # Те же два дня отставания, что и в report.py: свежие данные GSC неполны.
    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=args.days - 1)
    scope = f", страницы с «{args.path}»" if args.path else ""

    try:
        cur = fetch(token, site, start, end, args.country.lower(), args.path)
        if not cur["total"]:
            print(f"\n{args.country.upper()}: за {start}—{end} данных нет.")
            return 0
        cur_map = print_buckets(
            cur, f"{args.country.upper()} · {start} — {end} ({args.days} дн.{scope})")

        if args.compare:
            prev_end = start - timedelta(days=1)
            prev_start = prev_end - timedelta(days=args.days - 1)
            prev = fetch(token, site, prev_start, prev_end, args.country.lower(), args.path)
            prev_map = print_buckets(
                prev, f"{args.country.upper()} · {prev_start} — {prev_end} (предыдущие {args.days} дн.)")
            print_compare(cur_map, prev_map)

        if args.pages:
            print_pages(cur, {"resident", "expat_travel", "undetermined"})

        if args.json_path:
            Path(args.json_path).write_text(json.dumps(cur, ensure_ascii=False, indent=1))
            print(f"\nСырые строки сохранены: {args.json_path}")
    except DataUnavailable as e:
        print(f"Search Console не отдала данные: {e}", file=sys.stderr)
        return 1

    print("\nВедро — это «про что запрос», а не «наш ли лид». Второе проверяется"
          "\nусловием 2 правил отбора: продукт, драйвер, канал, экономика лида.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
