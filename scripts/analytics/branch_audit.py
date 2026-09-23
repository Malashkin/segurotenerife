#!/usr/bin/env python3
"""Аудит веток репозитория: что написано, но не доехало до main.

Закрывает дыру, из-за которой фикс мягкой 404 простоял на проде четыре дня
(SEGU-31): он был написан, закоммичен в ветку — и никто не смотрел на то,
попал ли он в `main`. Дневная проверка SEO-контура (`healthcheck.py`) видит
только свой контур; ветки `feat/*`, `fix/*`, `agent/*` не видел никто.

Правило (docs/process/code-integration.md):
  ветка с невлитыми коммитами и без открытого PR старше 2 суток  -> нарушение
  открытый PR без мержа старше 3 суток                           -> нарушение
  открытый PR с конфликтами                                      -> нарушение

Только стандартная библиотека. PR читаются через `gh`; если `gh` недоступен,
скрипт не падает, а честно помечает состояние PR как неизвестное.

Запуск:
    python3 scripts/analytics/branch_audit.py            # отчёт
    python3 scripts/analytics/branch_audit.py --json     # машинный вывод
    python3 scripts/analytics/branch_audit.py --quiet    # только нарушения

Код возврата: 0 — нарушений нет, 1 — есть, 2 — не смогли собрать данные.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone

BASE = "origin/main"
REMOTE = "origin"

# Пороги в сутках. Подняты из реального инцидента: четыре дня простоя —
# уже потеря, двое суток — ещё нет.
DEFAULT_NO_PR_DAYS = 2
DEFAULT_PR_DAYS = 3

# Ветки, которые живут по своим правилам и не считаются долгом.
IGNORED = {"main", "master", "HEAD"}


class GitError(RuntimeError):
    pass


def git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {proc.stderr.strip()}")
    return proc.stdout.strip()


def fetch() -> None:
    """Без свежего fetch аудит врёт: покажет влитое как невлитое."""
    subprocess.run(
        ["git", "fetch", REMOTE, "--prune", "--quiet"],
        capture_output=True,
        text=True,
        check=False,
    )


def remote_branches() -> list[str]:
    """Ветки origin без symref-а origin/HEAD.

    origin/HEAD — указатель на main, а не ветка; принятый за ветку, он даёт
    ложное «ноль коммитов позади» и шум в отчёте (та же ловушка, что в
    healthcheck.py, SEGU-32).
    """
    out = git(
        "for-each-ref",
        "--format=%(refname:short)%09%(symref)",
        f"refs/remotes/{REMOTE}",
    )
    names = []
    for line in out.splitlines():
        name, _, symref = line.partition("\t")
        if symref:  # origin/HEAD
            continue
        short = name.split("/", 1)[1] if "/" in name else name
        if short in IGNORED:
            continue
        names.append(name)
    return names


def has_conflicts(ref: str) -> "bool | None":
    """Сводится ли ветка с BASE. Считаем локально, а не по полю `mergeable`.

    GitHub вычисляет `mergeable` лениво: сразу после того, как `main` уехал
    вперёд, API какое-то время отдаёт UNKNOWN по конфликтующему PR. Скрипт,
    который верит этому полю, в такой момент молча объявляет конфликтующую
    ветку здоровой — то есть ровно тогда, когда аудит нужнее всего.
    `git merge-tree --write-tree` (git >= 2.38) отвечает на тот же вопрос
    здесь и сейчас: код 0 — сводится, 1 — конфликт.
    """
    proc = subprocess.run(
        ["git", "merge-tree", "--write-tree", BASE, ref],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        return False
    if proc.returncode == 1:
        return True
    return None  # старый git или битая ссылка — врать не будем


def age_days(iso: str) -> float:
    # gh отдаёт время с суффиксом Z, который fromisoformat не понимает до 3.11.
    ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ts).total_seconds() / 86400


def open_prs() -> tuple[dict[str, dict], bool]:
    """{имя ветки: данные PR}. Второе значение — удалось ли спросить gh."""
    proc = subprocess.run(
        [
            "gh", "pr", "list", "--state", "open", "--limit", "100",
            "--json", "number,title,headRefName,createdAt,mergeable,isDraft",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return {}, False
    try:
        data = json.loads(proc.stdout or "[]")
    except json.JSONDecodeError:
        return {}, False
    return {pr["headRefName"]: pr for pr in data}, True


def classify(
    ahead: int,
    branch_age: float,
    pr: dict | None,
    gh_ok: bool,
    no_pr_days: float,
    pr_days: float,
    conflicts: bool | None = None,
) -> tuple[str, str | None]:
    """Состояние ветки и нарушение, если оно есть. Чистая функция — вся логика
    правила из docs/process/code-integration.md живёт здесь и только здесь."""
    if ahead == 0:
        # Влитая ветка — не долг, но и не нужна: мусор маскирует реальный.
        return ("merged" if pr else "merged-stale"), None

    if pr:
        if conflicts is True or (
            conflicts is None and pr.get("mergeable") == "CONFLICTING"
        ):
            return "pr-open", f"PR #{pr['number']} с конфликтами — сам не вольётся"
        if pr["age_days"] > pr_days and not pr.get("draft"):
            return "pr-open", (
                f"PR #{pr['number']} открыт {pr['age_days']:.0f} сут "
                f"(порог {pr_days:.0f}) — работа не на проде"
            )
        return "pr-open", None

    if not gh_ok:
        return "pr-unknown", None

    if conflicts is True:
        return "no-pr", (
            f"{ahead} коммит(ов) вне main, PR нет и ветка уже не сводится — "
            f"чем дольше ждёт, тем дороже развести"
        )
    if branch_age > no_pr_days:
        return "no-pr", (
            f"{ahead} коммит(ов) вне main, PR нет, возраст "
            f"{branch_age:.0f} сут (порог {no_pr_days:.0f})"
        )
    return "no-pr", None


def collect(no_pr_days: float, pr_days: float) -> dict:
    fetch()
    prs, gh_ok = open_prs()
    rows = []

    for ref in remote_branches():
        short = ref.split("/", 1)[1]
        ahead = int(git("rev-list", "--count", f"{BASE}..{ref}"))
        last_commit = git("log", "-1", "--format=%cI", ref)
        row = {
            "branch": short,
            "commits_ahead": ahead,
            "last_commit": last_commit,
            "age_days": round(age_days(last_commit), 1),
            "pr": None,
            "conflicts": None,
            "state": "",
            "violation": None,
        }

        pr = prs.get(short)
        if pr:
            row["pr"] = {
                "number": pr["number"],
                "age_days": round(age_days(pr["createdAt"]), 1),
                "mergeable": pr.get("mergeable"),
                "draft": pr.get("isDraft", False),
            }

        row["conflicts"] = has_conflicts(ref) if ahead else None
        row["state"], row["violation"] = classify(
            ahead,
            row["age_days"],
            row["pr"],
            gh_ok,
            no_pr_days,
            pr_days,
            row["conflicts"],
        )
        rows.append(row)

    rows.sort(key=lambda r: (r["violation"] is None, -r["age_days"]))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "base": BASE,
        "gh_available": gh_ok,
        "thresholds": {"no_pr_days": no_pr_days, "pr_days": pr_days},
        "branches": rows,
        "violations": [r for r in rows if r["violation"]],
    }


def render(report: dict, quiet: bool) -> None:
    violations = report["violations"]
    print(f"Аудит веток относительно {report['base']} — {report['generated_at']}")
    if not report["gh_available"]:
        print("  ! gh недоступен: наличие PR не проверено, вывод неполный")
    print()

    if violations:
        print(f"Нарушений: {len(violations)}")
        for r in violations:
            print(f"  ✗ {r['branch']}")
            print(f"      {r['violation']}")
        print()
    else:
        print("Нарушений нет: всё написанное либо в main, либо в свежем PR.\n")

    if quiet:
        return

    rest = [r for r in report["branches"] if not r["violation"]]
    if rest:
        print("Остальные ветки:")
        for r in rest:
            pr = f"PR #{r['pr']['number']}" if r["pr"] else "без PR"
            print(
                f"  · {r['branch']:<40} {r['state']:<13} "
                f"+{r['commits_ahead']:<3} {pr}"
            )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true", help="машинный вывод")
    ap.add_argument("--quiet", action="store_true", help="только нарушения")
    ap.add_argument("--no-pr-days", type=float, default=DEFAULT_NO_PR_DAYS)
    ap.add_argument("--pr-days", type=float, default=DEFAULT_PR_DAYS)
    args = ap.parse_args()

    try:
        report = collect(args.no_pr_days, args.pr_days)
    except GitError as exc:
        print(f"Не удалось собрать данные: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        render(report, args.quiet)

    return 1 if report["violations"] else 0


if __name__ == "__main__":
    sys.exit(main())
