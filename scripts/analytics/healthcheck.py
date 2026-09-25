#!/usr/bin/env python3
"""
Проверка доступов и инвариантов SEO-пайплайна. Первый шаг ежедневной рутины.

Зачем отдельный шаг: все остальные инструменты при потере доступа деградируют
молча. `report.py` без токена печатает «пропускаю» и отдаёт нули — отчёт
выглядит как «трафика нет», хотя на самом деле мы просто ослепли. Самый частый
случай: OAuth-приложение осталось в статусе Testing, и refresh-токен умер через
7 дней (см. docs/analytics.md).

Проверяется:
  1. конфигурация на месте и с правами 600;
  2. refresh-токен Search Console живой (реальный обмен на access-токен);
  3. в Search Console есть свежие данные (задержка не больше ожидаемой);
  4. ключ PostHog отвечает;
  5. sitemap отдаётся и в нём столько же статей, сколько в `origin/main` —
     ловит «влито в main, но не задеплоено»;
  6. статьи, которые есть в чекауте или на ветках, но не в `origin/main` —
     ловит «написано, но не влито»: деплою нечего забирать;
  7. несуществующий URL отдаёт 404, а не 200 (негативный контроль мягкой 404);
  8. кэш индексации покрывает sitemap.

Почему сверка идёт с `origin/main`, а не с рабочим деревом (SEGU-32): прод
собирается из `origin/main`. Если рутина крутится на ветке, где работа уже
сделана, сверка с чекаутом читает «не влито» как «не задеплоено» — два разных
состояния с двумя разными действиями (открыть PR против подождать выката)
сливаются в одну строку отчёта. Так SEGU-31 простояла на проде трое суток.

Коды возврата:
    0 — всё в порядке (возможны предупреждения)
    1 — есть отказ: данные за день собирать бессмысленно, чинить доступ

Запуск:
    python3 scripts/analytics/healthcheck.py
    python3 scripts/analytics/healthcheck.py --json /tmp/seo-health.json
"""
from __future__ import annotations

import argparse
import json
import re
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
GSC_TOKEN = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"
INDEX_STATE = Path.home() / ".config" / "segurotenerife" / "indexation.json"
SITE = "https://segurotenerife.com"
SITEMAP = f"{SITE}/sitemap-0.xml"
REPO_ROOT = Path(__file__).resolve().parents[2]
ARTICLES_REL = "frontend/apps/web-astro/src/content/articles"
ARTICLES = REPO_ROOT / ARTICLES_REL

# Ветка, из которой собирается прод. Всё, чего в ней нет, не задеплоено по
# определению — сколько бы веток и чекаутов это ни держали.
MAIN_REF = "origin/main"

# Без User-Agent Cloudflare перед сайтом отвечает 403.
UA = "seguro-tenerife-healthcheck/1.0"

# Search Console финализирует данные примерно за двое суток. Три дня без единой
# строки — это уже не задержка, а обрыв: либо доступ, либо ресурс.
MAX_DATA_LAG_DAYS = 3

OK, WARN, FAIL = "OK", "WARN", "FAIL"


class Report:
    def __init__(self) -> None:
        self.checks: list[dict] = []

    def add(self, level: str, name: str, detail: str) -> None:
        self.checks.append({"level": level, "check": name, "detail": detail})

    @property
    def failed(self) -> bool:
        return any(c["level"] == FAIL for c in self.checks)

    def print(self) -> None:
        mark = {OK: "  ok  ", WARN: " warn ", FAIL: " FAIL "}
        print("=== Доступы и инварианты пайплайна ===")
        for c in self.checks:
            print(f"[{mark[c['level']]}] {c['check']}: {c['detail']}")
        n_fail = sum(c["level"] == FAIL for c in self.checks)
        n_warn = sum(c["level"] == WARN for c in self.checks)
        print(f"\nИтог: отказов {n_fail}, предупреждений {n_warn}, "
              f"проверок {len(self.checks)}.")


def load_config() -> dict:
    cfg = {}
    if CONFIG.is_file():
        for line in CONFIG.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


def check_config(rep: Report) -> dict:
    if not CONFIG.is_file():
        rep.add(FAIL, "конфигурация", f"нет файла {CONFIG} — см. docs/analytics.md")
        return {}
    mode = stat.S_IMODE(CONFIG.stat().st_mode)
    if mode & 0o077:
        rep.add(WARN, "права на конфигурацию",
                f"{CONFIG} имеет режим {mode:o}, ожидается 600 — там ключи")
    cfg = load_config()
    missing = [k for k in ("POSTHOG_PERSONAL_API_KEY", "GSC_SITE_URL") if not cfg.get(k)]
    if missing:
        rep.add(WARN, "конфигурация", f"не заданы: {', '.join(missing)}")
    else:
        rep.add(OK, "конфигурация", f"{CONFIG}, ресурс {cfg['GSC_SITE_URL']}")
    return cfg


def gsc_access_token(rep: Report) -> str | None:
    """Реальный обмен refresh-токена. Проверять наличие файла бесполезно:
    мёртвый токен лежит на диске точно так же, как живой."""
    if not GSC_TOKEN.is_file():
        rep.add(FAIL, "токен Search Console",
                f"нет {GSC_TOKEN} — выполните scripts/analytics/gsc_auth.py")
        return None
    t = json.loads(GSC_TOKEN.read_text())
    data = urllib.parse.urlencode({
        "client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        t.get("token_uri", "https://oauth2.googleapis.com/token"), data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            token = json.load(r)["access_token"]
    except urllib.error.HTTPError as e:
        detail = e.read()[:200].decode(errors="replace")
        rep.add(FAIL, "токен Search Console",
                f"HTTP {e.code}: {detail} — почти наверняка приложение в статусе "
                f"Testing (refresh-токен живёт 7 дней). Опубликуйте его и "
                f"перезапустите gsc_auth.py")
        return None
    except urllib.error.URLError as e:
        rep.add(FAIL, "токен Search Console", f"сеть недоступна: {e.reason}")
        return None
    rep.add(OK, "токен Search Console", "refresh отработал, доступ живой")
    return token


def check_gsc_data(rep: Report, token: str, site: str, out: dict) -> None:
    """Свежесть данных. Живой токен ещё не значит, что отчёт что-то покажет:
    ресурс могли пересоздать, верификацию — потерять."""
    end = date.today()
    start = end - timedelta(days=10)
    url = ("https://www.googleapis.com/webmasters/v3/sites/"
           f"{urllib.parse.quote(site, safe='')}/searchAnalytics/query")
    body = json.dumps({"startDate": start.isoformat(), "endDate": end.isoformat(),
                       "dimensions": ["date"], "rowLimit": 20}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r).get("rows", [])
    except urllib.error.HTTPError as e:
        rep.add(FAIL, "данные Search Console",
                f"HTTP {e.code}: {e.read()[:200].decode(errors='replace')}")
        return
    if not rows:
        rep.add(FAIL, "данные Search Console", "за 10 дней ни одной строки")
        return
    latest = max(r["keys"][0] for r in rows)
    lag = (date.today() - date.fromisoformat(latest)).days
    out["gsc_latest_date"] = latest
    out["gsc_lag_days"] = lag
    level = OK if lag <= MAX_DATA_LAG_DAYS else WARN
    rep.add(level, "данные Search Console",
            f"последний день с данными {latest} (отставание {lag} дн.)")


def check_posthog(rep: Report, cfg: dict) -> None:
    key = cfg.get("POSTHOG_PERSONAL_API_KEY")
    if not key:
        rep.add(WARN, "PostHog", "ключ не задан — поведенческая часть отчёта отключена")
        return
    host = cfg.get("POSTHOG_HOST", "https://eu.posthog.com").rstrip("/")
    body = json.dumps({"query": {"kind": "HogQLQuery",
                                 "query": "select count() from events where timestamp > now() - interval 1 day"}}).encode()
    req = urllib.request.Request(f"{host}/api/projects/@current/query/", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {key}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            json.load(r)
    except urllib.error.HTTPError as e:
        rep.add(WARN, "PostHog",
                f"HTTP {e.code}: {e.read()[:150].decode(errors='replace')} — "
                f"проверьте scope Query Read и привязку ключа к проекту")
        return
    except urllib.error.URLError as e:
        rep.add(WARN, "PostHog", f"сеть недоступна: {e.reason}")
        return
    rep.add(OK, "PostHog", f"{host} отвечает")


def article_url(loc: str, slug: str) -> str:
    """URL статьи так, как его должен отдавать сайт. ru живёт в корне,
    остальные локали — под своим префиксом (см. docs/seo/index.md)."""
    path = f"/blog/{slug}/" if loc == "ru" else f"/{loc}/blog/{slug}/"
    return f"{SITE}{path}"


def repo_article_urls() -> set[str]:
    """Статьи рабочего дерева — то, что видит этот чекаут прямо сейчас."""
    urls: set[str] = set()
    if not ARTICLES.is_dir():
        return urls
    for locale_dir in sorted(ARTICLES.iterdir()):
        if not locale_dir.is_dir():
            continue
        for md in locale_dir.glob("*.md"):
            urls.add(article_url(locale_dir.name, md.stem))
    return urls


def git(*args: str, timeout: int = 120) -> str | None:
    """stdout команды или None, если git недоступен/команда упала.
    Отличать «git сломался» от «файлов нет» обязательно: молчаливое пустое
    множество превратило бы любую поломку в бодрое «всё на месте»."""
    try:
        r = subprocess.run(("git", "-C", str(REPO_ROOT), *args),
                           capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def ref_article_urls(ref: str) -> set[str] | None:
    """Статьи в дереве ветки, а не в чекауте. None — ветки не видно."""
    listing = git("ls-tree", "-r", "--name-only", ref, "--", ARTICLES_REL)
    if listing is None:
        return None
    urls = set()
    for path in listing.splitlines():
        parts = path.split("/")
        if len(parts) >= 2 and path.endswith(".md"):
            urls.add(article_url(parts[-2], parts[-1][:-3]))
    return urls


def branches_ahead_of_main(main_urls: set[str]) -> list[tuple[str, str, int]]:
    """Удалённые ветки, не влитые в main, которые держат статьи, каких в main
    нет. Возвращает (ветка, дата последнего коммита, сколько статей).

    Это ответ на вопрос «где лежит недостающее»: без него отчёт сообщает о
    дыре, но не о том, куда идти её закрывать."""
    refs = git("for-each-ref", "--format=%(refname:short)\t%(committerdate:short)",
               "--no-merged", MAIN_REF, "refs/remotes/origin")
    if not refs:
        return []
    holders = []
    for line in refs.splitlines():
        if "\t" not in line:
            continue
        ref, committed = line.split("\t", 1)
        # origin/HEAD — симлинк на main, в отчёте он выглядел бы веткой «origin»
        # и отправлял открывать PR в саму же main.
        if ref == "origin" or ref.endswith("/HEAD") or ref == MAIN_REF:
            continue
        urls = ref_article_urls(ref)
        if urls is None:
            continue
        extra = urls - main_urls
        if extra:
            holders.append((ref, committed, len(extra)))
    return sorted(holders, key=lambda h: (-h[2], h[0]))


def check_merged_into_main(rep: Report, main_urls: set[str], out: dict) -> None:
    """«Написано, но не влито в main» — состояние, в котором деплою нечего
    забирать. Отдельная строка отчёта, потому что действие здесь другое:
    открыть PR, а не ждать выката."""
    holders: list[str] = []

    local_extra = repo_article_urls() - main_urls
    if local_extra:
        branch = (git("rev-parse", "--abbrev-ref", "HEAD") or "?").strip()
        holders.append(f"рабочее дерево (ветка {branch}) — {len(local_extra)}")

    for ref, committed, n in branches_ahead_of_main(main_urls):
        holders.append(f"{ref} — {n}, последний коммит {committed}")

    out["not_in_main"] = holders
    if holders:
        rep.add(WARN, f"статьи вне {MAIN_REF}",
                f"{'; '.join(holders[:3])}"
                f"{f' (и ещё {len(holders) - 3})' if len(holders) > 3 else ''}"
                f" — это НЕ «ждёт деплоя»: пока нет PR в main, выкату нечего "
                f"забирать")
    else:
        rep.add(OK, f"статьи вне {MAIN_REF}",
                f"всё написанное влито в {MAIN_REF}")


def check_sitemap(rep: Report, out: dict) -> list[str]:
    """Расхождение живого sitemap и `origin/main` — самая обидная причина
    отсутствия трафика: статья влита, но не выкачена, и Google про неё не знает.

    Сверка идёт именно с `origin/main`, потому что прод собирается из неё.
    Сверка с чекаутом отвечала бы «написаны, но не задеплоены» и на «ждёт
    выката», и на «не влито вовсе» — а делать в этих случаях нужно разное."""
    req = urllib.request.Request(SITEMAP, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            xml = r.read().decode()
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        rep.add(FAIL, "sitemap", f"{SITEMAP} недоступен: {e}")
        return []
    live = re.findall(r"<loc>(.*?)</loc>", xml)
    out["sitemap_urls"] = len(live)

    if git("fetch", "--quiet", "origin", "main") is None:
        rep.add(WARN, f"обновление {MAIN_REF}",
                "git fetch не отработал — сверяю с последним известным "
                "состоянием ветки, свежие вливания могут быть не видны")
    main_urls = ref_article_urls(MAIN_REF)
    if main_urls is None:
        # Деградируем громко: молчаливый откат на чекаут вернул бы ровно ту
        # неоднозначность, ради которой всё это писалось.
        rep.add(WARN, f"сверка с {MAIN_REF}",
                f"{MAIN_REF} не виден (не git-чекаут или нет remote) — сверяю "
                f"с рабочим деревом, «не влито» и «не задеплоено» снова "
                f"неразличимы")
        main_urls = repo_article_urls()
        reference = "рабочее дерево"
    else:
        reference = MAIN_REF
    out["main_articles"] = len(main_urls)
    out["reference"] = reference

    missing = sorted(main_urls - set(live))
    out["not_deployed"] = missing
    if missing:
        rep.add(FAIL, f"sitemap vs {reference}",
                f"{len(missing)} статей влиты в {reference}, но их нет в живом "
                f"sitemap — выкат идёт или упал, править нечего, проверяйте "
                f"деплой; например: {missing[0]}")
    else:
        rep.add(OK, f"sitemap vs {reference}",
                f"{len(live)} URL в sitemap, все {len(main_urls)} статей "
                f"{reference} на месте")

    check_merged_into_main(rep, main_urls, out)
    return live


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Редирект на существующую страницу — такая же мягкая 404, как и 200:
    Google получает успешный ответ там, где страницы нет. Поэтому не ходим
    по редиректам, а сообщаем сам код."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_status(url: str) -> int | str:
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with opener.open(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except urllib.error.URLError as e:
        return f"сеть: {e.reason}"


def check_soft_404(rep: Report, out: dict) -> None:
    """Негативный контроль: несуществующий URL обязан отдавать 404.

    Зачем отдельно от sitemap (SEGU-32): sitemap сверяет только статьи.
    `404.astro` — не статья, в sitemap его нет, и никакая файловая сверка его
    пропажу не заметила бы. Это прямой ассерт того свойства, которое ломается,
    и он не зависит от того, на какой ветке стоит чекаут.

    Порог значимости здесь не применяется: это бинарный факт, а не метрика.
    Мягкая 404 отдаёт Google бесконечность «успешных» пустых страниц, размывает
    краулинговый бюджет и тянет вниз качество всего хоста."""
    stamp = int(time.time())
    probes = {f"{SITE}/zz-no-such-page-{stamp}/": None,
              f"{SITE}/en/zz-no-such-page-{stamp}/": None}
    for url in probes:
        probes[url] = http_status(url)
    out["soft_404"] = {u: c for u, c in probes.items()}

    bad = {u: c for u, c in probes.items() if c not in (404, 410)}
    if not bad:
        rep.add(OK, "негативный контроль 404",
                f"несуществующий URL отдаёт 404 ({len(probes)} проверено)")
        return
    unreachable = {u: c for u, c in bad.items() if isinstance(c, str)}
    if len(unreachable) == len(bad):
        rep.add(WARN, "негативный контроль 404",
                f"сайт не ответил: {'; '.join(unreachable.values())}")
        return
    sample = next(u for u, c in bad.items() if not isinstance(c, str))
    rep.add(FAIL, "негативный контроль 404",
            f"мягкая 404: {sample} отдаёт {probes[sample]} вместо 404 "
            f"({len(bad)} из {len(probes)}) — Google индексирует "
            f"несуществующие страницы; нужна страница 404 со статусом 404")


def check_indexation_cache(rep: Report, live: list[str], out: dict) -> None:
    if not live:
        return
    state = json.loads(INDEX_STATE.read_text()) if INDEX_STATE.is_file() else {}
    checked = [u for u in live if u in state]
    problems = [u for u in checked if state[u].get("verdict") != "PASS"]
    stale_cutoff = (date.today() - timedelta(days=14)).isoformat()
    stale = [u for u in checked if state[u].get("checked", "") < stale_cutoff]
    out["indexation"] = {"total": len(live), "checked": len(checked),
                         "passed": len(checked) - len(problems), "problems": len(problems),
                         "unchecked": len(live) - len(checked), "stale": len(stale)}
    unchecked = len(live) - len(checked)
    if unchecked:
        rep.add(WARN, "кэш индексации",
                f"{len(checked)}/{len(live)} URL проверены, {unchecked} ни разу — "
                f"поднимите --limit у indexation.py (квота 2000/сутки)")
    else:
        rep.add(OK, "кэш индексации",
                f"{len(checked)}/{len(live)} проверены, вне индекса {len(problems)}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Проверка доступов SEO-пайплайна")
    ap.add_argument("--json", dest="json_path", help="сохранить результат в JSON")
    args = ap.parse_args()

    rep = Report()
    out: dict = {"generated": date.today().isoformat()}

    cfg = check_config(rep)
    token = gsc_access_token(rep) if cfg else None
    if token and cfg.get("GSC_SITE_URL"):
        check_gsc_data(rep, token, cfg["GSC_SITE_URL"], out)
    if cfg:
        check_posthog(rep, cfg)
    live = check_sitemap(rep, out)
    check_soft_404(rep, out)
    check_indexation_cache(rep, live, out)

    rep.print()
    out["checks"] = rep.checks
    out["ok"] = not rep.failed
    if args.json_path:
        Path(args.json_path).write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"Результат: {args.json_path}")
    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main())
