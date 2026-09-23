#!/usr/bin/env python3
"""Тесты проверок, которые ловят SEGU-31: незадеплоенный фикс и мягкую 404.

Запуск (стандартной библиотекой, pytest в проекте нет):

    python3 -m unittest discover -s scripts/analytics -p 'test_*.py' -v

Проверяется ровно то, что ломалось: сверка идёт с `origin/main`, а не с
чекаутом, и несуществующий URL обязан отдавать 404. Тесты работают на
одноразовом git-репозитории во временной папке — сеть и реальный origin не
нужны, кроме явно замоканного sitemap.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import healthcheck as hc  # noqa: E402

ARTICLES_REL = hc.ARTICLES_REL


def run(cwd: Path, *args: str) -> None:
    subprocess.run(("git", "-C", str(cwd), *args), check=True,
                   capture_output=True, text=True)


def commit(cwd: Path, message: str) -> None:
    run(cwd, "add", "-A")
    run(cwd, "-c", "user.name=test", "-c", "user.email=test@example.com",
        "commit", "-q", "-m", message)


def write_article(root: Path, loc: str, slug: str) -> None:
    d = root / ARTICLES_REL / loc
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{slug}.md").write_text(f"---\ntitle: {slug}\n---\n\n{slug}\n")


class RepoFixture(unittest.TestCase):
    """Чекаут с настоящим origin: без него «ветка держит файл» не проверить."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="segu32-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

        self.origin = self.tmp / "origin.git"
        subprocess.run(("git", "init", "--quiet", "--bare",
                        "--initial-branch=main", str(self.origin)),
                       check=True, capture_output=True)

        self.work = self.tmp / "work"
        subprocess.run(("git", "clone", "--quiet", str(self.origin), str(self.work)),
                       check=True, capture_output=True)
        run(self.work, "config", "init.defaultBranch", "main")
        run(self.work, "checkout", "-q", "-b", "main")

        write_article(self.work, "ru", "deployed")
        write_article(self.work, "en", "deployed")
        commit(self.work, "main: две статьи")
        run(self.work, "push", "-q", "-u", "origin", "main")

        patcher = mock.patch.multiple(
            hc,
            REPO_ROOT=self.work,
            ARTICLES=self.work / ARTICLES_REL,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def park_on_branch(self, branch: str, slug: str) -> None:
        """Статья, написанная на ветке и не влитая в main, — ровно SEGU-31."""
        run(self.work, "checkout", "-q", "-b", branch)
        write_article(self.work, "ru", slug)
        commit(self.work, f"{branch}: {slug}")
        run(self.work, "push", "-q", "-u", "origin", branch)

    @staticmethod
    def sitemap(urls: list[str]):
        xml = "".join(f"<url><loc>{u}</loc></url>" for u in urls).encode()
        response = mock.MagicMock()
        response.read.return_value = xml
        response.__enter__.return_value = response
        return mock.patch("urllib.request.urlopen", return_value=response)


class TestRefArticles(RepoFixture):
    def test_reads_ref_not_worktree(self) -> None:
        """Файл, лежащий только в чекауте, в дереве origin/main не появляется."""
        write_article(self.work, "ru", "uncommitted")
        self.assertIn(f"{hc.SITE}/blog/uncommitted/", hc.repo_article_urls())
        self.assertEqual(
            hc.ref_article_urls("origin/main"),
            {f"{hc.SITE}/blog/deployed/", f"{hc.SITE}/en/blog/deployed/"},
        )

    def test_missing_ref_is_none_not_empty(self) -> None:
        """None, а не пустое множество: иначе поломка git читается как «всё влито»."""
        self.assertIsNone(hc.ref_article_urls("origin/no-such-branch"))


class TestBranchNaming(RepoFixture):
    def test_names_branch_holding_unmerged_article(self) -> None:
        self.park_on_branch("fix/segu-31", "parked")
        main_urls = hc.ref_article_urls("origin/main")
        holders = hc.branches_ahead_of_main(main_urls)
        self.assertEqual([(ref, n) for ref, _, n in holders],
                         [("origin/fix/segu-31", 1)])

    def test_merged_branch_is_not_reported(self) -> None:
        self.park_on_branch("fix/segu-31", "parked")
        run(self.work, "checkout", "-q", "main")
        run(self.work, "merge", "-q", "fix/segu-31")
        run(self.work, "push", "-q", "origin", "main")
        run(self.work, "fetch", "-q", "origin")
        main_urls = hc.ref_article_urls("origin/main")
        self.assertEqual(hc.branches_ahead_of_main(main_urls), [])

    def test_check_warns_and_names_branch(self) -> None:
        self.park_on_branch("fix/segu-31", "parked")
        rep, out = hc.Report(), {}
        hc.check_merged_into_main(rep, hc.ref_article_urls("origin/main"), out)
        entry = rep.checks[-1]
        self.assertEqual(entry["level"], hc.WARN)
        self.assertIn("origin/fix/segu-31", entry["detail"])
        self.assertTrue(any("fix/segu-31" in h for h in out["not_in_main"]))

    def test_check_ok_when_everything_merged(self) -> None:
        rep, out = hc.Report(), {}
        hc.check_merged_into_main(rep, hc.ref_article_urls("origin/main"), out)
        self.assertEqual(rep.checks[-1]["level"], hc.OK)
        self.assertEqual(out["not_in_main"], [])


class TestSitemapStates(RepoFixture):
    """Два состояния, которые до SEGU-32 давали одну и ту же строку отчёта."""

    DEPLOYED = [f"{hc.SITE}/blog/deployed/", f"{hc.SITE}/en/blog/deployed/"]

    def test_not_merged_is_not_reported_as_not_deployed(self) -> None:
        self.park_on_branch("fix/segu-31", "parked")
        rep, out = hc.Report(), {}
        with self.sitemap(self.DEPLOYED):
            hc.check_sitemap(rep, out)
        levels = {c["check"]: c["level"] for c in rep.checks}
        self.assertEqual(levels["sitemap vs origin/main"], hc.OK,
                         "статья на невлитой ветке — не повод объявлять срыв выката")
        self.assertEqual(levels["статьи вне origin/main"], hc.WARN)
        self.assertEqual(out["not_deployed"], [])

    def test_merged_but_absent_from_sitemap_fails(self) -> None:
        rep, out = hc.Report(), {}
        with self.sitemap([self.DEPLOYED[0]]):
            hc.check_sitemap(rep, out)
        entry = next(c for c in rep.checks if c["check"] == "sitemap vs origin/main")
        self.assertEqual(entry["level"], hc.FAIL)
        self.assertIn("выкат", entry["detail"])
        self.assertEqual(out["not_deployed"], [self.DEPLOYED[1]])

    def test_all_green(self) -> None:
        rep, out = hc.Report(), {}
        with self.sitemap(self.DEPLOYED):
            hc.check_sitemap(rep, out)
        self.assertFalse(rep.failed)
        self.assertEqual(out["reference"], "origin/main")


class TestSoft404(unittest.TestCase):
    def verdict(self, *codes) -> tuple[str, str]:
        with mock.patch.object(hc, "http_status", side_effect=list(codes)):
            rep, out = hc.Report(), {}
            hc.check_soft_404(rep, out)
        return rep.checks[-1]["level"], rep.checks[-1]["detail"]

    def test_real_404_passes(self) -> None:
        self.assertEqual(self.verdict(404, 404)[0], hc.OK)

    def test_410_passes(self) -> None:
        self.assertEqual(self.verdict(410, 410)[0], hc.OK)

    def test_200_is_fail(self) -> None:
        level, detail = self.verdict(200, 200)
        self.assertEqual(level, hc.FAIL)
        self.assertIn("мягкая 404", detail)

    def test_single_locale_soft_404_is_fail(self) -> None:
        """Мягкая 404 на одной локали — уже поломка, не усредняем."""
        self.assertEqual(self.verdict(404, 200)[0], hc.FAIL)

    def test_redirect_is_fail(self) -> None:
        """302 на главную — та же мягкая 404: Google получает успешный ответ."""
        self.assertEqual(self.verdict(302, 302)[0], hc.FAIL)

    def test_network_error_is_warn_not_fail(self) -> None:
        """Недоступная сеть — не доказательство поломки 404."""
        self.assertEqual(self.verdict("сеть: timeout", "сеть: timeout")[0], hc.WARN)


if __name__ == "__main__":
    unittest.main()
