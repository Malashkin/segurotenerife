# Changelog

Формат по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/). Версионирование — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added — База знаний ASISA + плавающий чат-бот
- **База знаний ASISA** (`knowledge-base/asisa/`): каталог из **34 продуктов** по всем линиям ASISA в Испании (salud + модальности, salud для иностранцев/ВНЖ, dental, vida, decesos, accidentes, viaje, mascotas, hospitalización). Собрано с asisa.es со ссылками-источниками; `catalog.json` (+ `schema.json`, `index.json`), `residency-visa.md` (highlight для приезжих), `SOURCES.md` с дисклеймерами. Принципы: цены где не опубликованы — `null` (не выдумываем), покрытия на испанском (первоисточник) + краткие `summary_ru/en`. Задел под RAG (Postgres+эмбеддинги → ответы бота через Claude API).
- **Плавающий чат-бот** на лендинге: чат вынесен из встроенной секции в виджет `ChatLauncher` (кнопка-пузырь в углу → всплывающее окно), секция #quiz стала CTA. uiStore.chatOpen, i18n `chat_fab`/`chat_close`, E2E обновлён (4/4).

### Added — Волна 4: деплой-конфиг + E2E (Playwright) + нагрузочный smoke (k6)
- **Деплой.** `backend/railway.toml` (сборка по Dockerfile, healthcheck `/health`, restart-policy); Dockerfile собирает `--locked` с `Cargo.lock` (воспроизводимо). `docs/deploy.md` — полный гайд: backend+Postgres на Railway, две SPA на Vercel/Netlify, таблицы ENV, генерация `MANAGER_PASSWORD_HASH`, обязательные `COOKIE_SECURE=true` и конкретный `ALLOWED_ORIGINS` (не `*`) для cookie-логина, чек-лист после деплоя.
- **E2E (Playwright)** в `frontend/e2e`: реальный браузер против собранных SPA, backend подменён стабами (`page.route`) — детерминированно, без БД. Покрытие: web — проход чат-подбора до экрана хендоффа + смена языка перерисовывает чат без перезагрузки; admin — нет сессии → форма входа, неверный пароль → ошибка, верный пароль → дашборд со списком лидов. **4/4 зелёные.**
- **Нагрузочный smoke (k6)** `scripts/load/smoke.js` + оркестратор `run-local.sh` (поднимает временный Postgres+backend с высоким rate-limit). Пороги `p95<500ms`, `http_req_failed<1%`, `business_errors<1%`. Прогон локально: **450/450 проверок, 0 ошибок, p95 ≈ 5мс.**

### Added — Волна 3: аналитика воронки + JWT-аутентификация менеджера
- **Аналитика воронки.** Backend `POST /api/events` (публичный, rate-limited) пишет события в таблицу `events`. Frontend (`features/chat`) шлёт `chat_started` / `step_completed` / `chat_completed` / `handoff_clicked` через `shared/api.trackEvent` (fire-and-forget, не влияет на UX; `session_id` в sessionStorage). Это даёт измеримый **handoff rate** — ключевую метрику гипотезы.
- **JWT-аутентификация менеджера** (lightweight single-manager, `auth.md`): `POST /api/auth/login|refresh|logout`. Пароль одного менеджера хранится как **argon2-хэш** в ENV (`MANAGER_PASSWORD_HASH`, утилита `cargo run --bin hash_password`). Access-JWT (короткий, в памяти фронта) + refresh-JWT (httpOnly `Path=/ SameSite=Strict` cookie). `GET /api/leads` теперь под access-токеном — **статичный `ADMIN_API_TOKEN` удалён**. CORS включает credentials при заданном белом списке доменов.
- **Admin: вход по паролю** вместо вставки токена (`LoginGate` вместо `TokenGate`): access-токен в памяти (не в localStorage), тихое восстановление сессии по refresh-cookie при загрузке и **авто-refresh при 401**, «Sign out» → `/logout`.

### Changed
- **FSD-рефактор:** TanStack Query-хуки лида (`useCreateLead`/`useLeads`) и `leadKeys` переехали из `shared/api` в `entities/lead` (доменная логика сущности — уровень entities); `shared/api` оставил низкоуровневые `createLead`/`listLeads`, контракт-типы и generic-клиент. Потребители (чат, дашборд) импортируют хуки из `@entities`.

**Бизнес-ценность:** появилась воронка в цифрах (можно считать конверсию чат→хендофф) и нормальный вход менеджера по паролю вместо расшаривания секретного токена — безопаснее и привычнее.

**Проверено:** `pnpm typecheck` (10 пакетов) и `pnpm build` (web 123KB gz, admin 115KB gz) — зелёные; backend компилируется без warnings; e2e smoke против живого Postgres — **15/15** (health, leads create/list, consent-400, events-204, login ok/401, authed list, bad-token-401, refresh ok/401, logout).

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
