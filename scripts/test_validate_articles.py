#!/usr/bin/env python3
"""Тесты планки перелинковки в validate_articles.py.

    python3 -m unittest scripts/test_validate_articles.py
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_articles import check_product_link  # noqa: E402

NEW = ["date: 2026-09-23"]
LINK = "[подобрать полис под требования консульства](#chat)"


def body(before: int, after: int, link: str = LINK) -> str:
    """Тело статьи: `before` слов, ссылка, `after` слов."""
    return " ".join(["слово"] * before) + f" {link} " + " ".join(["слово"] * after)


class ProductLinkTest(unittest.TestCase):
    def test_old_article_is_exempt(self):
        self.assertEqual(check_product_link(["date: 2026-09-03"], "без ссылки"), [])

    def test_updated_old_article_falls_under_the_bar(self):
        fm = ["date: 2026-09-03", "updated: 2026-09-25"]
        self.assertEqual(len(check_product_link(fm, "без ссылки")), 1)

    def test_quoted_date_is_read(self):
        self.assertEqual(len(check_product_link(["date: '2026-09-23'"], "без ссылки")), 1)

    def test_since_date_itself_is_covered(self):
        self.assertEqual(len(check_product_link(["date: 2026-09-22"], "без ссылки")), 1)

    def test_early_link_passes(self):
        self.assertEqual(check_product_link(NEW, body(50, 200)), [])

    def test_missing_link_fails(self):
        errs = check_product_link(NEW, "текст статьи без входа в продукт")
        self.assertEqual(len(errs), 1)
        self.assertIn("нет ссылки", errs[0])

    def test_late_link_fails(self):
        errs = check_product_link(NEW, body(300, 20))
        self.assertTrue(any("первой половине" in e for e in errs), errs)

    def test_link_just_past_middle_fails(self):
        errs = check_product_link(NEW, body(130, 100))
        self.assertTrue(any("первой половине" in e for e in errs), errs)

    def test_link_just_before_middle_passes(self):
        self.assertEqual(check_product_link(NEW, body(90, 120)), [])

    def test_two_word_anchor_fails(self):
        errs = check_product_link(NEW, body(10, 200, "[полис здесь](#chat)"))
        self.assertTrue(any("якорь" in e for e in errs), errs)

    def test_short_anchor_fails(self):
        errs = check_product_link(NEW, body(10, 200, "[в чат](#chat)"))
        self.assertTrue(any("якорь" in e for e in errs), errs)

    def test_link_cap(self):
        text = body(10, 10) + (" " + LINK) * 3 + " " + " ".join(["слово"] * 300)
        errs = check_product_link(NEW, text)
        self.assertTrue(any("потолок" in e for e in errs), errs)

    def test_three_links_are_allowed(self):
        text = body(10, 10) + (" " + LINK) * 2 + " " + " ".join(["слово"] * 300)
        self.assertEqual(check_product_link(NEW, text), [])

    def test_exception_with_reason_passes(self):
        text = "<!-- no-product-link: тема нормативная, сроки подачи -->\nтекст"
        self.assertEqual(check_product_link(NEW, text), [])

    def test_exception_without_reason_fails(self):
        self.assertEqual(check_product_link(NEW, "<!-- no-product-link: -->\nтекст"),
                         ["no-product-link без причины"])

    def test_footer_style_link_is_not_counted(self):
        # ссылка на главную — не вход в продукт; считается только #chat
        self.assertEqual(len(check_product_link(NEW, "текст [на главную](/)")), 1)


if __name__ == "__main__":
    unittest.main()
