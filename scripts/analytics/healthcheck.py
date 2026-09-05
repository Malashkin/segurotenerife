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
  5. sitemap отдаётся и в нём столько же статей, сколько в репозитории —
     ловит «контент написан, но не задеплоен»;
  6. кэш индексации покрывает sitemap.

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
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

CONFIG = Path.home() / ".config" / "segurotenerife" / "analytics.env"
GSC_TOKEN = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"
INDEX_STATE = Path.home() / ".config" / "segurotenerife" / "indexation.json"
SITEMAP = "https://segurotenerife.com/sitemap-0.xml"
ARTICLES = Path(__file__).resolve().parents[2] / "frontend/apps/web-astro/src/content/articles"

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


def repo_article_urls() -> set[str]:
    """URL статей так, как их должен отдавать сайт. ru живёт в корне,
    остальные локали — под своим префиксом (см. docs/seo/index.md)."""
    urls: set[str] = set()
    if not ARTICLES.is_dir():
        return urls
    for locale_dir in sorted(ARTICLES.iterdir()):
        if not locale_dir.is_dir():
            continue
        loc = locale_dir.name
        for md in locale_dir.glob("*.md"):
            slug = md.stem
            path = f"/blog/{slug}/" if loc == "ru" else f"/{loc}/blog/{slug}/"
            urls.add(f"https://segurotenerife.com{path}")
    return urls


def check_sitemap(rep: Report, out: dict) -> list[str]:
    """Расхождение sitemap и репозитория — самая обидная причина отсутствия
    трафика: статья написана, но не выкачена, и Google про неё не знает."""
    # Без User-Agent Cloudflare перед сайтом отвечает 403.
    req = urllib.request.Request(SITEMAP, headers={"User-Agent": "seguro-tenerife-healthcheck/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            xml = r.read().decode()
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        rep.add(FAIL, "sitemap", f"{SITEMAP} недоступен: {e}")
        return []
    live = re.findall(r"<loc>(.*?)</loc>", xml)
    out["sitemap_urls"] = len(live)

    repo = repo_article_urls()
    out["repo_articles"] = len(repo)
    missing = sorted(repo - set(live))
    out["not_deployed"] = missing
    if missing:
        rep.add(FAIL, "sitemap vs репозиторий",
                f"{len(missing)} статей нет в живом sitemap (написаны, но не "
                f"задеплоены), например: {missing[0]}")
    else:
        rep.add(OK, "sitemap vs репозиторий",
                f"{len(live)} URL в sitemap, все {len(repo)} статей репозитория на месте")
    return live


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
