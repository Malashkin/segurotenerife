#!/usr/bin/env python3
"""Тесты классификатора интента из intent.py.

Проверяется `classify` — единственное место, где решается, в какое ведро попадёт
запрос. Риск, ради которого тесты написаны: ошибка здесь не падает и не видна.
Ведро просто получает не свои показы, доли в отчёте сдвигаются, и вывод «спрос
резидентский» либо «спрос туристический» делается по подтасованным числам —
причём с виду это полностью нормальный отчёт. Именно так и появилось
утверждение, которое SEGU-38 исправлял в candidates-2026-09-09.md.

Отсюда три группы тестов: каждое ведро на своих запросах из живого среза,
ловушки на пересечениях правил (запрос содержит маркеры двух вёдер — важно,
какое победит) и поведение по умолчанию.

Запуск: python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from intent import BUCKETS, TITLES, classify  # noqa: E402


class TestTouristBucket(unittest.TestCase):
    """Турист: приехал ненадолго, полис купит дома (вердикт SEGU-37)."""

    def test_geo_travel_insurance(self):
        for q in (
            "tenerife travel insurance",
            "travel insurance tenerife",
            "canary islands travel insurance",
            "travel insurance for the canary islands",
            "holiday insurance tenerife",
            "gran canaria travel insurance",
        ):
            self.assertEqual(classify(q), "tourist", q)

    def test_verification_questions(self):
        # Запросы «да/нет» — самая крупная часть кластера по показам.
        for q in (
            "is tenerife in europe for travel insurance",
            "is tenerife classed as spain for travel insurance",
            "does tenerife come under spain for travel insurance",
            "are the canary islands classed as europe for travel insurance",
        ):
            self.assertEqual(classify(q), "tourist", q)

    def test_cruise(self):
        self.assertEqual(classify("cruise travel insurance spain"), "tourist")


class TestResidentBucket(unittest.TestCase):
    """Живёт или собирается жить: виза, ВНЖ, частная медицина, переезд."""

    def test_visa_clusters(self):
        for q in (
            "dnv spain insurance 2026",
            "digital nomad visa spain insurance requirements",
            "digital nomad insurance spain",
            "health insurance student visa spain",
            "student insurance spain",
            "health insurance non lucrative visa spain",
            "nlv",
            "family reunion visa spain",
            "family member visa canarias",
        ):
            self.assertEqual(classify(q), "resident", q)

    def test_living_here_already(self):
        for q in (
            "complete reimbursement private insurance spain",
            "reimbursement rehabilitation spain",
            "private healthcare canary islands",
            "accident cover for expats in spain",
            "retiring to tenerife",
            "how to move to tenerife",
            "convenio especial in english",
        ):
            self.assertEqual(classify(q), "resident", q)

    def test_bare_dnv_abbreviation(self):
        # «insurance dnv» — 6 показов из США на позиции 18,8: короткая форма
        # должна ловиться, иначе американский визовый спрос уходит в мусор.
        self.assertEqual(classify("insurance dnv"), "resident")
        # …но не как часть другого слова.
        self.assertNotEqual(classify("advnvertising"), "resident")


class TestExpatTravelBucket(unittest.TestCase):
    """Резидент в поездке: продукт из линии viaje, аудитория наша."""

    def test_multi_trip(self):
        for q in (
            "expat annual multi-trip travel insurance in spain",
            "annual multi trip travel insurance spain",
            "spanish multi-trip travel insurance",
            "seguro de viaje anual",
        ):
            self.assertEqual(classify(q), "expat_travel", q)

    def test_expat_travel_beats_tourist(self):
        # Содержит «travel insurance» — но искатель уже живёт в Испании, и это
        # решает: правило expat_travel стоит в INTENT_RULES выше туристического.
        for q in (
            "travel insurance for expats in spain",
            "travel insurance for expats living in spain",
            "long term travel insurance",
        ):
            self.assertEqual(classify(q), "expat_travel", q)


class TestUndeterminedBucket(unittest.TestCase):
    """Спорное уходит в `undetermined`, а не в ближайшее по смыслу ведро."""

    def test_healthcare_information_queries(self):
        # «Где в Тенерифе поликлиника» с равной вероятностью ищет турист с EHIC
        # и новый резидент. Коммерческого намерения нет — догадываться не будем.
        for q in (
            "healthcare system in tenerife",
            "public/state medical centres in tenerife",
            "is healthcare free in tenerife",
            "what is a public health charge in tenerife",
            "private health care",
        ):
            self.assertEqual(classify(q), "undetermined", q)

    def test_unknown_query_defaults_to_undetermined(self):
        # Мусор из среза GSC: «si», «65», «an kredit» — реальные строки.
        for q in ("si", "65", "an kredit", ""):
            self.assertEqual(classify(q), "undetermined", repr(q))


class TestRuleCollisions(unittest.TestCase):
    """Пересечения правил: запрос с маркерами двух вёдер должен идти в верное."""

    def test_travel_insurance_requirements_is_tourist(self):
        # Ловушка, на которой классификатор уже ошибался при разработке SEGU-38:
        # «insurance requirements» выглядит как визовое требование, но здесь это
        # турист, спрашивающий про правила въезда.
        self.assertEqual(classify("spain travel insurance requirements"), "tourist")
        self.assertEqual(classify("travel insurance for spain visa"), "tourist")

    def test_visa_insurance_requirements_is_resident(self):
        # А тот же оборот с визовым маркером — резидент.
        self.assertEqual(
            classify("digital nomad visa spain insurance requirements"), "resident"
        )

    def test_private_healthcare_geo_is_resident_not_undetermined(self):
        # «private healthcare canary islands» — резидент (гео + частная медицина),
        # «private healthcare in spain» — общий информационный, undetermined.
        self.assertEqual(classify("private healthcare canary islands"), "resident")
        self.assertEqual(classify("private healthcare in spain"), "undetermined")

    def test_case_is_ignored(self):
        self.assertEqual(classify("TENERIFE TRAVEL INSURANCE"), "tourist")
        self.assertEqual(classify("DNV Spain Insurance 2026"), "resident")


class TestInvariants(unittest.TestCase):
    """Структурные гарантии: отчёт не должен молча терять ведро."""

    def test_every_bucket_has_a_title(self):
        for b in BUCKETS:
            self.assertIn(b, TITLES, f"ведро {b} без человекочитаемого названия")

    def test_classify_only_returns_known_buckets(self):
        for q in ("tenerife travel insurance", "dnv", "multi-trip", "si"):
            self.assertIn(classify(q), BUCKETS, q)


if __name__ == "__main__":
    unittest.main()
