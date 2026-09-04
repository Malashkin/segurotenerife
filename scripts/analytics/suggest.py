#!/usr/bin/env python3
"""
Сбор поисковых подсказок Google и поиск контентных пробелов.

Зачем: Search Console показывает только запросы, по которым мы УЖЕ показываемся.
Спрос, который мы не ловим вообще, оттуда не виден в принципе. Подсказки —
бесплатный источник реального спроса: они формируются из того, что люди
действительно набирают.

Это не частотность. Подсказка говорит «так спрашивают», но не говорит «сколько
раз». Приоритет между темами всё равно расставляет человек или месячная рутина.

Запуск:
    python3 scripts/analytics/suggest.py                 # по всем локалям
    python3 scripts/analytics/suggest.py --locale es     # одна локаль
    python3 scripts/analytics/suggest.py --deep          # + перебор алфавита
    python3 scripts/analytics/suggest.py --json out.json # выгрузка для скилла
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
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ARTICLES = ROOT / "frontend/apps/web-astro/src/content/articles"

# Регион всегда Испания: сервис локальный, спрос из других стран нам не нужен.
GL = "es"

# Затравки по локалям. Держим короткими и общими — длинный хвост доберут
# модификаторы и подсказки самого Google.
SEEDS = {
    "ru": ["страховка испания", "медицинская страховка испания", "страховка тенерифе",
           "страховка для внж испания", "стоматология испания", "страховка жизни испания"],
    "uk": ["страховка іспанія", "медична страховка іспанія", "страхування тенеріфе",
           "страховка для внж іспанія", "стоматологія іспанія"],
    "en": ["insurance spain", "health insurance spain", "tenerife insurance",
           "residency visa insurance spain", "dental insurance spain", "expat insurance spain"],
    "es": ["seguro medico", "seguro salud espana", "seguro tenerife",
           "seguro para residencia", "seguro dental", "seguro de vida"],
}

# Вопросительные модификаторы дают самый коммерчески осмысленный хвост:
# так формулируют, когда уже собираются покупать.
MODIFIERS = {
    "ru": ["как", "сколько стоит", "что такое", "нужна ли", "какой"],
    "uk": ["як", "скільки коштує", "що таке", "чи потрібна", "який"],
    "en": ["how", "how much", "what is", "do i need", "best"],
    "es": ["como", "cuanto cuesta", "que es", "necesito", "mejor"],
}

ALPHABET = {
    "ru": "абвгдежзиклмнопрстуфхцчшэюя",
    "uk": "абвгдежзіклмнопрстуфхцчшюя",
    "en": "abcdefghijklmnopqrstuvwxyz",
    "es": "abcdefghijklmnopqrstuvwxyz",
}

STOP = {
    "ru": {"в", "на", "и", "для", "с", "по", "из", "к", "у", "о", "не", "что", "как", "это", "а"},
    "uk": {"в", "на", "і", "для", "з", "по", "із", "до", "у", "о", "не", "що", "як", "це", "а"},
    "en": {"a", "an", "the", "in", "on", "for", "of", "to", "and", "is", "do", "i", "my", "you"},
    "es": {"el", "la", "los", "las", "de", "en", "para", "por", "un", "una", "y", "que", "es", "mi"},
}


def fetch(query: str, hl: str) -> list[str]:
    url = ("https://suggestqueries.google.com/complete/search?client=firefox"
           f"&hl={hl}&gl={GL}&q={urllib.parse.quote(query)}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode("utf-8", "replace"))[1]
    except (urllib.error.URLError, json.JSONDecodeError, IndexError):
        return []


def words(text: str, locale: str) -> set:
    toks = re.findall(r"[\wЀ-ӿ]+", text.lower())
    return {t for t in toks if len(t) > 2 and t not in STOP.get(locale, set())}


def corpus(locale: str) -> list[tuple[str, set]]:
    """Наши статьи как (slug, значимые слова из title + keywords)."""
    out = []
    for f in sorted((ARTICLES / locale).iterdir()):
        if f.suffix != ".md":
            continue
        head = f.read_text(encoding="utf-8").split("---")[1]
        text = " ".join(
            line.split(":", 1)[1] for line in head.splitlines()
            if line.startswith(("title:", "keywords:", "description:"))
        )
        out.append((f.stem, words(text, locale)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Подсказки Google и контентные пробелы")
    ap.add_argument("--locale", choices=list(SEEDS), help="только одна локаль")
    ap.add_argument("--deep", action="store_true", help="дополнительно перебрать алфавит (медленно)")
    ap.add_argument("--json", dest="json_path", help="сохранить результат в JSON")
    ap.add_argument("--min-overlap", type=int, default=2,
                    help="сколько общих слов со статьёй считать покрытием (по умолчанию 2)")
    args = ap.parse_args()

    locales = [args.locale] if args.locale else list(SEEDS)
    result: dict = {}

    for loc in locales:
        queries = []
        for seed in SEEDS[loc]:
            queries.append(seed)
            queries += [f"{m} {seed}" for m in MODIFIERS[loc]]
            if args.deep:
                queries += [f"{seed} {ch}" for ch in ALPHABET[loc]]

        found: set = set()
        for i, q in enumerate(queries, 1):
            found.update(s.lower().strip() for s in fetch(q, loc))
            time.sleep(0.25)  # вежливо к чужому эндпоинту
            if i % 20 == 0:
                print(f"  [{loc}] {i}/{len(queries)} запросов, найдено {len(found)}",
                      file=sys.stderr)

        arts = corpus(loc)
        gaps = []
        for s in sorted(found):
            sw = words(s, loc)
            if len(sw) < 2:
                continue
            best, best_n = None, 0
            for slug, aw in arts:
                n = len(sw & aw)
                if n > best_n:
                    best, best_n = slug, n
            if best_n < args.min_overlap:
                gaps.append({"query": s, "nearest": best, "overlap": best_n})

        result[loc] = {"suggestions": sorted(found), "gaps": gaps}
        print(f"\n=== {loc}: подсказок {len(found)}, без своей статьи {len(gaps)} ===")
        for g in gaps[:20]:
            print(f"  {g['query']}")
        if len(gaps) > 20:
            print(f"  … и ещё {len(gaps) - 20}")

    if args.json_path:
        Path(args.json_path).write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(f"\nСырые данные: {args.json_path}")

    print("\nЭто спрос, но НЕ частотность: подсказка говорит «так спрашивают», "
          "но не говорит «сколько раз».")
    return 0


if __name__ == "__main__":
    sys.exit(main())
