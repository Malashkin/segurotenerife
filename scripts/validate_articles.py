#!/usr/bin/env python3
"""
Проверка статей блога перед сборкой: frontmatter, внутренние ссылки, карта
«Похожие статьи».

Ловит ровно те ошибки, которые Astro либо пропустит, либо покажет невнятно:
неэкранированный апостроф в YAML, ссылку на чужую локаль, статью-сироту без
входящих ссылок. Запускать после любой правки контента:

    python3 scripts/validate_articles.py

Код возврата 1, если есть ошибки — годится для CI и pre-commit.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "frontend/apps/web-astro/src/content/articles"
ARTICLE_PAGE = ROOT / "frontend/apps/web-astro/src/components/ArticlePage.astro"
LOCALES = ["ru", "uk", "en", "es"]
REQUIRED = ["locale", "urlSlug", "title", "description", "tag", "date", "order"]
KEY = r"[A-Za-z_]+"


def check_quoting(path: str, line: str, errs: list) -> None:
    """В одинарных кавычках YAML апостроф должен быть удвоен. Самая частая
    ошибка в русских и украинских текстах — и Astro падает на ней невнятно."""
    m = re.match(rf"^\s*(-\s+)?({KEY}):\s*(.*)$", line)
    if not m:
        return
    val = m.group(3).strip()
    if val.startswith("'"):
        if not val.endswith("'") or len(val) < 2:
            errs.append((path, f"незакрытая кавычка: {line[:60]}"))
            return
        inner, i = val[1:-1], 0
        while i < len(inner):
            if inner[i] == "'":
                if i + 1 < len(inner) and inner[i + 1] == "'":
                    i += 2
                    continue
                errs.append((path, f"неэкранированный апостроф: {line[:60]}"))
                return
            i += 1
    elif val.startswith('"'):
        if not val.endswith('"'):
            errs.append((path, f"незакрытая кавычка: {line[:60]}"))
    elif ": " in val:
        errs.append((path, f"двоеточие в значении без кавычек: {line[:60]}"))


def main() -> int:
    errs: list = []
    have = {l: {f[:-3] for f in os.listdir(ARTICLES / l)} for l in LOCALES}

    # 1. Один и тот же набор slug'ов во всех локалях: статья без перевода
    #    ломает hreflang и оставляет локаль без страницы.
    base = have["ru"]
    for l in LOCALES:
        if have[l] != base:
            for miss in sorted(base - have[l]):
                errs.append((l, f"нет перевода: {miss}"))
            for extra in sorted(have[l] - base):
                errs.append((l, f"нет ru-оригинала: {extra}"))

    links = 0
    for l in LOCALES:
        orders: dict = {}
        for f in sorted(os.listdir(ARTICLES / l)):
            rel = f"{l}/{f}"
            txt = (ARTICLES / l / f).read_text(encoding="utf-8")
            lines = txt.split("\n")
            if lines[0] != "---":
                errs.append((rel, "нет открывающего ---"))
                continue
            try:
                end = lines.index("---", 1)
            except ValueError:
                errs.append((rel, "нет закрывающего ---"))
                continue
            fm = lines[1:end]

            top = [re.match(rf"^({KEY}):", x).group(1) for x in fm if re.match(rf"^{KEY}:", x)]
            for k in REQUIRED:
                if k not in top:
                    errs.append((rel, f"нет обязательного поля {k}"))
            if any(k not in top for k in REQUIRED):
                continue

            def g(k: str) -> str:
                return [x for x in fm if x.startswith(k + ":")][0].split(":", 1)[1].strip()

            if g("locale") != l:
                errs.append((rel, f"locale={g('locale')}, а файл в {l}/"))
            if g("urlSlug") != f[:-3]:
                errs.append((rel, f"urlSlug={g('urlSlug')} не совпадает с именем файла"))
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", g("date")):
                errs.append((rel, f"дата не в формате YYYY-MM-DD: {g('date')}"))
            orders.setdefault(g("order"), []).append(f)

            for x in fm:
                check_quoting(rel, x, errs)

            q = len([x for x in fm if re.match(r"^\s+-\s+q:", x)])
            a = len([x for x in fm if re.match(r"^\s+a:", x)])
            if q != a:
                errs.append((rel, f"faq: {q} вопросов и {a} ответов"))

            # 2. Внутренние ссылки: только на существующие статьи СВОЕЙ локали.
            for m in re.finditer(r"\]\((/[^)]*)\)", txt):
                href = m.group(1)
                links += 1
                mm = re.fullmatch(r"/(?:(uk|en|es)/)?blog/([a-z0-9-]+)/", href)
                if not mm:
                    errs.append((rel, f"ссылка не по формату /blog/<slug>/: {href}"))
                    continue
                want = mm.group(1) or "ru"
                if want != l:
                    errs.append((rel, f"{href}: ссылка на локаль {want} из {l}"))
                elif mm.group(2) not in have[l]:
                    errs.append((rel, f"{href}: такой статьи нет"))

        for o, fs in orders.items():
            if len(fs) > 1:
                errs.append((l, f"order {o} у нескольких статей: {fs}"))

    # 3. Карта «Похожие статьи»: запись у каждой статьи и хотя бы одна входящая
    #    ссылка — иначе страница остаётся сиротой и теряет вес.
    page = ARTICLE_PAGE.read_text(encoding="utf-8")
    keys = re.findall(r"^  '([a-z0-9-]+)': \[", page, re.M)
    targets = set(re.findall(r"^    '([a-z0-9-]+)',", page, re.M))
    for miss in sorted(base - set(keys)):
        errs.append(("RELATED", f"нет записи для {miss}"))
    for bad in sorted(targets - base):
        errs.append(("RELATED", f"ссылка на несуществующую статью {bad}"))
    for orphan in sorted(base - targets):
        errs.append(("RELATED", f"сирота без входящих ссылок: {orphan}"))
    dupes = [k for k in set(keys) if keys.count(k) > 1]
    for d in dupes:
        errs.append(("RELATED", f"дублирующаяся запись: {d}"))

    total = sum(len(have[l]) for l in LOCALES)
    print(f"Статей: {total} ({len(base)} тем × {len(LOCALES)} локали)")
    print(f"Внутренних ссылок: {links}")
    print(f"Записей в RELATED: {len(keys)}")
    if errs:
        print(f"\nОШИБОК: {len(errs)}")
        for where, what in errs[:40]:
            print(f"  {where}: {what}")
        if len(errs) > 40:
            print(f"  … и ещё {len(errs) - 40}")
        return 1
    print("\nОшибок нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
