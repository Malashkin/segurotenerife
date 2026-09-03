---
audience: [product, seo]
owner: seguro-tenerife
updated: 2026-09-03
---

# Аналитика: доступы и ежедневный цикл

Два источника данных и два скилла, которые их читают.

## Источники

| Источник | Что показывает | Доступ |
|---|---|---|
| **PostHog** (EU) | поведение на сайте: визиты, каналы, воронка чата | Personal API key, scope `Query Read` |
| **Search Console** | поисковый спрос: показы, позиции, индексация | OAuth-клиент Desktop, scope `webmasters.readonly` |

Важно понимать разницу: PostHog видит только тех, кто **уже дошёл** до сайта.
Search Console показывает тех, кто увидел нас в выдаче и **не пришёл** — а
это как раз то, что можно исправить.

## Конфигурация

Секреты живут вне репозитория, права 600:

```
~/.config/segurotenerife/analytics.env    POSTHOG_*, GSC_SITE_URL
~/.config/segurotenerife/gsc-token.json   refresh-токен Search Console
~/.config/segurotenerife/indexation.json  кэш статусов индексации
```

### PostHog

Ключ создаётся в Account settings → Personal API keys. Достаточно scope
**Query Read**, ключ стоит ограничить одним проектом. Из-за такой привязки
`/api/projects/` отдаёт 403 — работает адрес `@current`:

```
POST https://eu.posthog.com/api/projects/@current/query/
```

### Search Console

Организационная политика GCP `iam.disableServiceAccountKeyCreation` запрещает
скачивать ключи сервис-аккаунтов, поэтому используется **OAuth-клиент типа
Desktop app** от имени владельца ресурса. Побочный плюс: не нужно отдельно
выдавать права роботу в Search Console.

```bash
pip3 install --user google-auth google-auth-oauthlib
python3 scripts/analytics/gsc_auth.py ~/Downloads/client_secret_*.json
```

> **Ловушка со сроком.** Пока OAuth-приложение в статусе **Testing**,
> refresh-токен живёт **7 дней** — отчёты замолкают без единой ошибки. Чтобы
> снять ограничение: задеплоить сайт (нужны рабочие `/privacy/` и `/terms/`),
> опубликовать приложение (**Google Auth Platform → Audience → Publish app**) и
> перезапустить `gsc_auth.py`. Если доступен тип **Internal** — публикация не
> нужна вовсе.

## Инструменты

```bash
python3 scripts/analytics/report.py --days 28 --compare   # трафик + динамика
python3 scripts/analytics/indexation.py --limit 60        # что в индексе
python3 scripts/validate_articles.py                      # контент перед сборкой
```

`report.py` не требует сторонних библиотек — только стандартная библиотека,
чтобы регулярный запуск ничего не ломал. `google-auth` нужен лишь для разовой
авторизации.

Данные Search Console финализируются с задержкой около двух суток, поэтому
отчёт всегда берёт окно, заканчивающееся позавчера. Служебные события
(`admin_opened` — заходы менеджера в админку) исключаются из выборки, иначе
собственные визиты составляют большую часть данных.

Квоты URL Inspection: 2000 запросов в сутки. Проиндексированные URL
перепроверяются раз в неделю, проблемные — каждый запуск.

## Ежедневный цикл

1. `/seo-analyst` — читает данные, сверяет с порогами, ставит задачи.
2. `/seo-copywriter` — выполняет задачи, валидирует, пишет в CHANGELOG.
3. История решений накапливается в `docs/seo/journal.md`.

Правила принятия решений — в самих скиллах (`.claude/skills/`). Там же записано
главное: «изменений нет, действий не требуется» — нормальный результат дня.
