---
audience: [frontend, devops]
owner: seguro-tenerife
updated: 2026-06-26
---

# Публичный сайт переехал на Astro (SSG + React-острова)

**Статус:** реализовано и переключено. Публичный web — `frontend/apps/web-astro`
(`@seguro/web-astro`). Прежний Vite-SPA `frontend/apps/web` **удалён**; Playwright
e2e гоняется против Astro-сборки (`playwright.config.ts` → `astro preview`), все
тесты зелёные. Осталось только переключить деплой (см. ниже).

## Зачем
Лендинг на ~80% статичный контент + один интерактивный остров (чат). На Vite-SPA
весь контент рендерился на клиенте, а локализация была только в `<head>` (костыль
`seo-prerender.mjs`). Astro даёт **настоящий локализованный HTML целиком** на
каждый язык, нативный i18n-роутинг и почти нулевой JS — это и есть «легче для SEO».

## Архитектура
- **SSG** (`output: static`). 4 страницы: `/` (ru, каноническая), `/en/`, `/es/`,
  `/uk/` — генерируются на сборке (`src/pages/index.astro` + `[locale]/index.astro`).
- **i18n-роутинг** Astro: `defaultLocale: ru`, `prefixDefaultLocale: false`
  (ru без префикса). URL == контент == hreflang/canonical — без ручного пререндера.
- **Статичные секции — `.astro`** (`src/components/*`): NavBar, Hero, TrustBar,
  InsuranceTypes, HowItWorks, Articles, Faq (нативный `<details>`), Footer. Тексты —
  билд-тайм `getT(locale)` поверх тех же `common.json` (`src/i18n/t.ts`). Контент
  попадает в HTML на сборке → индексируется.
- **Интерактив — один React-остров** `src/islands/Overlays.tsx` (`client:idle`):
  чат-лончер + правовая модалка + баннер куки. Переиспользует `libs/*`
  (`@widgets`, `@features`, `@shared/*`) как есть.
- **Мост статика→остров:** статичные кнопки несут `data-ui` (`open-chat` |
  `intent` + `data-intent` | `legal` + `data-doc`); делегированный клик в
  `Layout.astro` шлёт `CustomEvent('seguro:ui')`, остров слушает и дёргает
  `useUiStore`. Так Hero/NavBar/карточки/Footer остаются статичным HTML, не теряя
  поведения «открыть чат».
- **Переключатель языков** — обычные `<a>` на локальные URL (`getRelativeLocaleUrl`):
  zero-JS и реальные ссылки между hreflang-версиями.
- **SEO-head** (`Layout.astro`): title/description (`src/i18n/seo.ts`), canonical,
  hreflang (+ x-default), OG/Twitter, JSON-LD `Organization`+`WebSite`+`FAQPage`
  (вопросы из словаря локали). `@astrojs/sitemap` → `sitemap-index.xml` с i18n.
- **Tailwind** — через PostCSS и **тот же** `tailwind.preset.cjs` (бренд-токены).

## Что НЕ изменилось
- `libs/*` (chat-фича, store, api, ui, i18n, entities) — переиспользуются островом.
- Admin (`apps/admin`) и backend (axum) — без изменений.
- `@shared/i18n.initI18n()` получил опции `{ lng, syncUrl }` (обратносовместимо):
  острова Astro инициализируют i18n явной локалью и НЕ трогают URL.

## Блог (Content Layer)
- **Контент:** `src/content/articles/{locale}/{slug}.md` (Astro 6 Content Layer,
  `glob`-loader; схема в `src/content.config.ts`). Поле URL — **`urlSlug`** (НЕ
  `slug` — зарезервирован Astro, иначе коллизия между локалями). Значения
  frontmatter с `:` — в кавычках (иначе YAML падает). Сейчас 24 статьи
  (6 тем × ru/uk/en/es).
- **Страницы:** `/blog/<slug>/` (ru) и `/<locale>/blog/<slug>/` — со слешем
  (совпадает с canonical/sitemap, без 308). Шаблон `ArticlePage.astro`:
  `BlogPosting`+`BreadcrumbList`+`FAQPage` schema, hreflang на переводы, блок
  «Похожие статьи» (карта связей), кнопки «поделиться», CTA в чат.
- **Хаб** `/blog/` (`BlogIndex.astro`, `ItemList`), **«О нас»** `/about/`
  (`AboutPage.astro`, контент в `src/i18n/about.ts`, E-E-A-T). Карточки секции
  «Статьи» (`Articles.astro`) кликабельны, где статья для локали есть.
- **Layout расширен:** props `keywords`/`canonicalUrl`/`ogType`/`extraSchema`/
  `alternates`/`includeSiteFaq`; `InsuranceAgency`-разметка (локальный SEO).
  Детали SEO — [../seo/index.md](../seo/index.md).

## Реверс-прокси PostHog (`/ph`)
- **Зачем:** блокировщики/Safari ITP режут `i.posthog.com` → теряется аналитика.
  Проксируем через свой домен (первая сторона).
- **Как:** Cloudflare Pages **advanced-mode** `dist/_worker.js` (исходник
  `apps/web-astro/pages-functions/_worker.js`, копируется в `dist/_worker.js` в
  CI). `/ph/static/*` → `eu-assets.i.posthog.com`, `/ph/*` →
  `eu.i.posthog.com`, остальное → `env.ASSETS`. Web-хост PostHog =
  `PUBLIC_POSTHOG_HOST=https://segurotenerife.com/ph`, `ui_host`=`eu.posthog.com`.
  Admin ходит напрямую. Детали — [../monitoring/observability.md](../monitoring/observability.md).

## Команды
```
pnpm --filter @seguro/web-astro dev        # дев-сервер
pnpm --filter @seguro/web-astro build      # SSG → apps/web-astro/dist
pnpm --filter @seguro/web-astro preview    # предпросмотр прод-сборки
pnpm --filter @seguro/web-astro typecheck  # astro check
```

## Заметки
- **Оверлеи — `client:only="react"`** (не `client:idle`): чат/куки/правовое зависят
  от `localStorage`/`window` и не являются SEO-контентом; SSR давал бы
  hydration-mismatch (баннер куки не скрывался). Они рендерятся только на клиенте.
- **env:** `envPrefix: ['VITE_','PUBLIC_']` в `astro.config.mjs` — чтобы общий
  `@shared/api` видел `VITE_API_URL` (Astro по умолчанию отдаёт клиенту лишь `PUBLIC_*`).

## Деплой (выполнено)
Прод — **Cloudflare Pages** (проект `seguro-web`, домен `segurotenerife.com`),
авто-деплой из `.github/workflows/deploy-frontend.yml` (`wrangler pages deploy
frontend/apps/web-astro/dist`). `/es/ /uk/ /en/` отдаются как свои подпапки.
Старый `apps/web` и `scripts/seo-prerender.mjs` удалены.
