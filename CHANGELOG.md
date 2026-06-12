# Changelog

Формат по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/). Версионирование — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added — Волна 2: frontend (Nx-совместимое pnpm-монорепо + FSD)
- Монорепо `frontend/` (pnpm workspaces, Nx-совместимая структура): 2 приложения (`apps/web` — лендинг+чат, `apps/admin` — дашборд менеджера) и 8 FSD-библиотек (`shared/ui`, `shared/i18n`, `shared/api`, `shared/store`, `entities`, `features`, `widgets`, `pages`), каждая со своим публичным `index.ts`.
- Стек по SOUL: React + Vite + **TypeScript strict** (exactOptionalPropertyTypes, noUncheckedIndexedAccess), Tailwind (brand-токены), shadcn-style примитивы, **i18next** (EN/ES/UA/RU, порядок EN,ES,UA,RU, авто-детект `be→ru`, fallback EN, persist в localStorage), **TanStack Query** (без bare fetch в компонентах).
- Публичный лендинг: виджеты Hero (универсальный заголовок + «быстрый ответ менеджера»), InsuranceTypes, HowItWorks, Articles, FAQ, Footer (нейтральный дисклеймер) — контент портирован из прототипа на 4 языках.
- On-page чат (фича `features/chat`) на Zustand-сторе: 6-шаговый подбор, перерисовка на смену языка, хендофф в **WhatsApp / Telegram / Viber** с предзаполненным сообщением; на сабмите — `POST /api/leads`.
- Дашборд менеджера (`apps/admin`): токен-гейт (Bearer в localStorage), таблица лидов из `GET /api/leads`, состояния loading/empty/error.

**Бизнес-ценность:** появился реальный продукт — мультиязычный лендинг с чат-подбором, который кладёт лиды в backend, и дашборд, где менеджер их видит. Это закрывает цикл «посетитель → квалифицированный лид → менеджер» и позволяет измерять гипотезу.

**Проверено:** `pnpm typecheck` (10 пакетов) и `pnpm build` (оба приложения) — зелёные; end-to-end smoke backend против Postgres (health/create/list/401/400) — пройден.

### Added — Волна 1: фундамент backend
- Структура монорепо `seguro-tenerife/` (backend + место под frontend).
- Backend на Rust/axum: конфигурация из ENV, structured JSON logging, пул Postgres, авто-миграции при старте.
- Схема БД: таблицы `leads` и `events` с индексами (миграция `0001_init.sql`).
- Вертикаль лидов: `POST /api/leads` (валидация + сохранение), `GET /api/leads` (под токеном менеджера).
- `GET /health` с проверкой соединения с БД.
- Защита: per-IP rate limiting (fixed window), лимит размера тела запроса (1MB), CORS.
- Docker: multi-stage сборка backend, `docker-compose.yml` (Postgres + backend).

**Бизнес-ценность:** появилась точка приёма и хранения лидов — заявки из чата больше не теряются,
менеджер получает доступ к ним по API. Это фундамент для измерения ключевой метрики гипотезы
(handoff rate: завершившие чат → переданные менеджеру).
