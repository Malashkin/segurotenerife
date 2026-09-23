#!/usr/bin/env python3
"""Тесты правила эскалации из docs/process/code-integration.md.

Проверяется `classify` — единственное место, где живёт решение «долг или нет».
Риск, ради которого тесты написаны: правило, которое молчит о просроченной
ветке, выглядит ровно как правило, у которого нет нарушений. Поэтому каждый
тест про порог идёт парой — до порога тихо, за порогом громко.

Запуск: python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from branch_audit import DEFAULT_NO_PR_DAYS, DEFAULT_PR_DAYS, classify  # noqa: E402


def call(ahead=3, age=0.0, pr=None, gh_ok=True):
    return classify(ahead, age, pr, gh_ok, DEFAULT_NO_PR_DAYS, DEFAULT_PR_DAYS)


def make_pr(number=7, age=0.0, mergeable="MERGEABLE", draft=False):
    return {"number": number, "age_days": age, "mergeable": mergeable, "draft": draft}


class MergedBranches(unittest.TestCase):
    def test_merged_branch_is_not_debt(self):
        state, violation = call(ahead=0)
        self.assertIsNone(violation)
        self.assertEqual(state, "merged-stale")

    def test_merged_branch_with_open_pr_is_plain_merged(self):
        state, _ = call(ahead=0, pr=make_pr())
        self.assertEqual(state, "merged")

    def test_merged_branch_never_violates_however_old(self):
        self.assertIsNone(call(ahead=0, age=90.0)[1])


class BranchWithoutPR(unittest.TestCase):
    def test_fresh_branch_is_silent(self):
        state, violation = call(age=DEFAULT_NO_PR_DAYS - 0.5)
        self.assertEqual(state, "no-pr")
        self.assertIsNone(violation)

    def test_branch_past_threshold_violates(self):
        _, violation = call(age=DEFAULT_NO_PR_DAYS + 0.5)
        self.assertIsNotNone(violation)
        self.assertIn("PR нет", violation)

    def test_exactly_at_threshold_is_still_silent(self):
        # Граница не срабатывает: ровно порог — ещё не просрочка.
        self.assertIsNone(call(age=float(DEFAULT_NO_PR_DAYS))[1])

    def test_four_day_soft_404_would_have_been_caught(self):
        # Регресс на инцидент SEGU-31: фикс прожил в ветке 4 дня без PR.
        _, violation = call(ahead=1, age=4.0)
        self.assertIsNotNone(violation)


class BranchWithPR(unittest.TestCase):
    def test_fresh_pr_is_silent(self):
        self.assertIsNone(call(pr=make_pr(age=DEFAULT_PR_DAYS - 1))[1])

    def test_stale_pr_violates(self):
        _, violation = call(pr=make_pr(age=DEFAULT_PR_DAYS + 1))
        self.assertIn("не на проде", violation)

    def test_conflicting_pr_violates_immediately(self):
        _, violation = call(pr=make_pr(age=0.0, mergeable="CONFLICTING"))
        self.assertIn("конфликт", violation)

    def test_draft_pr_is_exempt_from_age_but_not_from_conflicts(self):
        self.assertIsNone(call(pr=make_pr(age=30.0, draft=True))[1])
        self.assertIsNotNone(
            call(pr=make_pr(age=0.0, mergeable="CONFLICTING", draft=True))[1]
        )


class GhUnavailable(unittest.TestCase):
    def test_no_verdict_without_pr_data(self):
        """Без gh мы не знаем, есть ли PR, и не обвиняем ветку наугад."""
        state, violation = call(age=30.0, gh_ok=False)
        self.assertEqual(state, "pr-unknown")
        self.assertIsNone(violation)


if __name__ == "__main__":
    unittest.main()
