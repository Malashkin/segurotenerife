---
audience: [backend, frontend, devops, testing, ai]
owner: seguro-tenerife
updated: 2026-06-26
---

# Seguro Tenerife — AGENTS.md

Операционная точка входа для людей и AI-агентов. Процесс/стандарты разработки
(SOUL, волны) — в корневом [`../CLAUDE.md`](../CLAUDE.md). Человеческий алиас этого
файла — [`index.md`](index.md).

## Что это
Независимый мультиязычный (ru/uk/en/es) сервис **подбора страховки** на Тенерифе
(lead-gen). Посетитель проходит чат-подбор → лид сохраняется → менеджер видит лиды
в дашборде и продолжает в мессенджере. **Нейтральный бренд:** мы не страховщик и
не брокер; страховщика (ASISA) и брендовые продукты в UI/ответах **не называем**.

## Структура
```
backend/         Rust + axum + PostgreSQL (API: лиды, события, auth, /api/chat RAG-агент)
frontend/
  apps/web-astro/  публичный лендинг — Astro (SSG + React-острова), целевой web
  apps/admin/      дашборд менеджера — Vite SPA
  libs/            FSD-библиотеки (shared/{ui,api,store,i18n}, entities, features, widgets, pages)
  e2e/             Playwright (*.spec.ts)
knowledge-base/asisa/  база знаний; services.json — бренд-нейтральный корпус RAG-агента
docs/            эта документация (по ролям)
```

## Doc map (по ролям)
| Тема | Документ | Audience |
|---|---|---|
| AI-агент чата (RAG, бренд-гейт) | [ai/rag-agent.md](ai/rag-agent.md) | backend, ai |
| Веб на Astro (SSG + острова) | [architecture/astro-web.md](architecture/astro-web.md) | frontend |
| Наблюдаемость (Langfuse, PostHog) | [monitoring/](monitoring/index.md) | backend, frontend, devops |
| Тесты (cargo/vitest/playwright/mutation) | [testing/](testing/index.md) | testing |
| Деплой + ENV | [deploy.md](deploy.md) | devops |
| SEO/GEO + блог + Google Search Console | [seo/index.md](seo/index.md) | product, frontend |
| Лиды по каналам (схема) | [architecture/lead-flow.md](architecture/lead-flow.md) | product, backend |
| UX-обзоры | [ux/](ux/ux-review.md) | product |
| Changelog | [../CHANGELOG.md](../CHANGELOG.md) | all |
| Последний тест-прогон | [../TEST_RESULTS.md](../TEST_RESULTS.md) | testing |

## Команды

### Backend (`backend/`)
```bash
cargo build
cargo test                       # unit + интеграционные
cargo clippy                     # держим 0 warnings
cargo mutants -f src/<file>.rs   # mutation-гейт
cargo run                        # нужен ENV (DATABASE_URL/JWT_SECRET/… см. deploy.md)
```

### Frontend (`frontend/`)
```bash
pnpm install
pnpm typecheck         # tsc по всем пакетам
pnpm test              # vitest (unit, *.test.ts)
pnpm e2e               # Playwright (web+admin, *.spec.ts)
pnpm build             # web-astro + admin
pnpm dev:web           # Astro dev (web)
pnpm dev:admin         # Vite dev (admin)
```

## Конвенции
- **FSD + public API:** импорт библиотек только через их `src/index.ts` (alias
  `@shared/*`,`@entities`,`@features`,`@widgets`,`@pages`); внутренние пути не тянем.
- **«Голый fetch» в компонентах запрещён** — только через `@shared/api`.
- **i18n:** тексты в `common.json` (4 локали) + chat-словарь; `.astro` — билд-тайм
  `getT`, острова — i18next (`initI18n({lng})`).
- **TS strict, Rust clippy 0 warnings.** Тесты: `*.test.ts`=vitest, `*.spec.ts`=e2e.

## Не редактировать / генерируемое
- `**/dist/`, `backend/target/`, `**/node_modules/`, `mutants.out/` — артефакты.
- `apps/web-astro/dist/{,/en,/es,/uk}/index.html` — генерируются Astro.
- `*.env` — секреты, **gitignored**, в репозиторий не коммитим.

## Готчи (важно для агентов)
- **Бренд-нейтральность:** не называть ASISA/Ocaso и брендовые продукты в
  ответах/UI. Защита: бренд-нейтральный `services.json` + правило в промпте +
  пост-гейт `strip_brand`. **Цены не выдумывать** (нет в данных → «уточнит менеджер»).
- **web = Astro** (`apps/web-astro`); старый `apps/web` удалён. Оверлеи —
  `client:only` (localStorage/window → иначе hydration-mismatch).
- **Tailwind preset:** `slate`/`amber` заданы как DEFAULT **+ полная шкала** —
  не возвращать к плоской строке (иначе `*-slate-NNN`/`*-amber-NNN` станут no-op).
- **Ключи аналитики:** PostHog `phc_…` (публичный, можно в клиент) ≠ `phx_…`
  (секрет). Langfuse `sk-lf-…` и Anthropic-ключ — только backend-env.
- **`/api/chat`** платный (вызов Claude) и за rate-limit'ом; в проде нужен
  `TRUST_PROXY_HEADERS=true` (иначе лимит за прокси не работает).
- Без `ANTHROPIC_API_KEY`/корпуса `/api/chat` → 503; фронт молча откатывается к
  гайдовому чату. **Модель агента в проде — `claude-sonnet-4-6`** (`ANTHROPIC_MODEL`).
- **Статьи блога** (`web-astro/src/content/articles/*`): поле URL — **`urlSlug`**,
  НЕ `slug` (зарезервирован Astro → коллизия локалей); значения frontmatter с `:`
  — в кавычках (иначе YAML падает). См. `architecture/astro-web.md`.
- **PostHog (web)** ходит через прокси `segurotenerife.com/ph` (Cloudflare
  `_worker.js`) — обход блокировщиков. Детали — `monitoring/observability.md`.
