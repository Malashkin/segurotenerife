# Changelog

Формат по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/). Версионирование — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added — Лиды из чата

**Передача менеджеру с обязательным именем.** В карточке хендоффа поле «Как к
вам обращаться?» теперь обязательно: пока имя не введено, кнопки мессенджеров
заблокированы (`aria-disabled`), при попытке нажать — подсветка поля и подсказка.
Сообщение менеджеру всегда начинается с «Меня зовут …».

**Сохранение лида.** Любой переход в мессенджер шлёт `POST /api/handoff`, который
(1) сохраняет лид в таблицу `leads` (видно в админке: имя, вид страховки `goal`,
мессенджер, язык; `contact` пустой — на этом шаге не собираем) и (2) пересылает
карточку лида в Telegram (имя/мессенджер/вид страховки/язык/вопрос) — со
**всех** каналов, поэтому менеджер всегда получает предзаполненную карточку,
даже для Telegram (где `t.me/username` не принимает текст). Получателей может
быть несколько: `TELEGRAM_MANAGER_CHAT_ID` принимает список chat_id через
запятую (владелец для учёта + менеджер(ы)). WhatsApp/Viber дополнительно несут
предзаполненный текст в самом deep-link; контакт клиента на этом шаге не
собираем. Без `TELEGRAM_BOT_TOKEN`/chat_id — no-op (кнопки мессенджеров всё
равно работают).

**Telegram — копирование заготовки.** `t.me/<username>` не предзаполняет текст,
поэтому при выборе Telegram клиенту показывается заготовка сообщения с кнопкой
**«Скопировать»** (иконка + фидбэк «Скопировано ✓») и ссылкой **«Открыть чат
менеджера»**: клиент копирует, переходит в личку менеджера, вставляет и
отправляет. Лид при этом так же сохраняется и уходит карточкой в Telegram-бот —
сверка по имени. Схема всех каналов — `docs/architecture/lead-flow.md`.

### Added — Наблюдаемость и тесты

**Langfuse — трассировка диалогов агента.** Каждый ответ `/api/chat` пишет в
Langfuse `trace` (вопрос → ответ, метаданные intent/lang/поднятые сервис-доки/
флаг бренд-гейта, `sessionId` для группировки) + вложенный `generation` (модель,
токены, латентность). Прямой HTTP на ingestion-API (Basic-auth; у Langfuse нет
Rust-SDK), **fire-and-forget** через `tokio::spawn` — на UX чата не влияет. Без
ключей (`LANGFUSE_PUBLIC_KEY`/`SECRET_KEY`/`BASE_URL`) — no-op. Фронт шлёт
`session_id` (consent-gated) для группировки. Детали: `docs/monitoring/`.

**Тестовая инфраструктура.** Frontend: **vitest** (`pnpm test`) для чистых
хелперов (posthog-гейт/GDPR, i18n `getT`). Backend: укреплены unit-тесты RAG-
ретривала и rate-limit + интеграционные тесты middleware (router/`tower::oneshot`)
и Langfuse `log_chat` (mock-сервер). Quality-гейт — **mutation-тесты**
(`cargo-mutants`) на изменённом коде; сводка в `TEST_RESULTS.md`. Хелпер
`Config::test()` для тестов backend.

### Changed
- Модель чата по умолчанию `claude-opus-4-8` → **`claude-haiku-4-5`**.
- `/api/chat` принимает `session_id`; упрощён избыточный `&& != 207` в Langfuse-
  отправке (207 уже входит в `is_success()`).

### Security
- `/api/chat`: строгий per-IP лимит (`RATE_LIMIT_CHAT_PER_MIN`, дефолт 8/мин) +
  proxy-aware IP (`TRUST_PROXY_HEADERS`) + эвикция протухших IP; анти-инъекционное
  правило в системном промпте.

### Added — Волна D: Astro, RAG-агент, продуктовая аналитика, харднинг

**Публичный сайт переехал на Astro (SSG + React-острова).** Новое приложение
`frontend/apps/web-astro` — мультиязычный SEO/GEO: статический локализованный HTML
по локалям (`/` ru-каноническая, `/es/`, `/uk/`, `/en/`) через нативный i18n-роутинг;
hreflang + canonical + OG/Twitter + JSON-LD (`Organization`+`WebSite`+`FAQPage`) +
`sitemap.xml`. Статичные секции — `.astro` с билд-тайм `t()` (контент в выдаче, не
после JS); интерактив (чат-подбор + правовая модалка + куки) — один React-остров
`client:only`, переиспользует FSD-библиотеки; статичные кнопки управляют им через
делегированное событие `seguro:ui`. Переключатель языков — ссылки на локальные URL.
Сгенерирована OG-картинка 1200×630. Деталь: `docs/architecture/astro-web.md`.

**RAG-агент подбора (бренд-нейтральный, 4 языка).** Новый бренд-НЕЙТРАЛЬНЫЙ корпус
`knowledge-base/asisa/services.json` (14 сервис-доков: типы покрытия/условия/лимиты +
мультиязычные `keywords`, факты обогащены с asisa.es и нейтрализованы — без названия
страховщика и брендовых продуктов). Ретривал `backend/src/knowledge.rs` — лексический
+ по интенту чата, кросс-язычно, без эмбеддингов. Агент `routes/chat.rs` отвечает
развёрнуто на языке пользователя по ретривнутым фактам. Нейтральный бренд защищён
тройным рубежом: нейтральный корпус + правило в промпте + детерминированный
пост-гейт `strip_brand`. Деталь: `docs/ai/rag-agent.md`.

**Продуктовая аналитика — PostHog.** `@shared/api/posthog.ts`: autocapture +
pageview/pageleave + запись сессий (с маскировкой инпутов — PII контактной формы);
вся воронка чата фан-аутится из `trackEvent`; расширенные события — `scroll_depth`,
`section_viewed`, `faq_opened`, `chat_opened {source}`, `insurance_intent_selected`,
`legal_opened`, `cookie_consent`, чат-события. **GDPR-гейт:** capture только после
согласия в баннере куки (по умолчанию opt-out). Ключ — только из env (публичный
`phc_`), без ключа — тихий no-op. На admin autocapture/recording выключены (PII лидов).

**UX-обзоры (волны улучшений).** Дедуп лендинга (убрана секция-CTA `#quiz`, дубль
«как это работает»); компактный FAB; кликабельные карточки без повторов; адаптивная
таблица лидов в admin (карточки на мобиле) + фильтр по статусу; полоса доверия
(TrustBar); 9-я CTA-карточка «Не нашли своё?»; стартовые чипсы и сворачиваемый
свободный ввод в чате; статьи помечены «скоро» вместо битых ссылок.

### Changed
- **Модель чата по умолчанию `claude-opus-4-8` → `claude-haiku-4-5`** (дёшево, для
  grounded-RAG достаточно; sonnet/opus переключаются `ANTHROPIC_MODEL`).
- **Чат: вместо «весь каталог в промпт» — ретривал** релевантного среза; корпус —
  `services.json` (бренд-нейтральный) вместо `catalog.json` (с брендовыми именами);
  `KNOWLEDGE_PATH` по умолчанию указывает на `services.json`; ответы развёрнутые
  (`max_tokens` 1024 → 1400); `/api/chat` принимает `intent`.
- **web: Vite-SPA → Astro**; прежний `apps/web` и костыль `scripts/seo-prerender.mjs`
  удалены; e2e и `build:web` переключены на Astro; из `@shared/i18n` убрана URL-логика
  локалей (была стопгэпом SPA). Смена языка теперь — навигация (а не live-рендер).

### Fixed
- **Тема Tailwind: `slate`/`amber` были плоскими строками** → вся шкала
  `slate-*/amber-*` по приложению была no-op (серый текст почти чёрный, фоны
  прозрачные, границы на дефолтном сером). Чинено в `tailwind.preset.cjs` (DEFAULT +
  полная шкала); попутно починены статус-бейджи в admin.
- Reveal больше не прячет контент до JS (SEO); FAB не перекрывает ввод чата на
  мобиле; hydration-mismatch куки-баннера на Astro (оверлеи → `client:only`).

### Security
- **`/api/chat` — защита от DDoS/cost-DoS:** отдельный строгий per-IP лимит
  (`RATE_LIMIT_CHAT_PER_MIN`, дефолт 8/мин) поверх общего; **proxy-aware IP**
  (`TRUST_PROXY_HEADERS` → `CF-Connecting-IP`/`X-Forwarded-For`, иначе за прокси лимит
  считал всех как один IP); эвикция протухших IP из лимитера (memory-DoS).
- **Защита от prompt-injection:** правило в системном промпте (текст пользователя —
  только вопрос; попытки сменить правила/раскрыть инструкции/оффтоп → отказ). Радиус
  поражения мал by design: у агента нет инструментов/секретов/доступа к БД.

### Added — Чат-консультант на базе знаний (RAG + Claude API, Волна C)
- **Backend `POST /api/chat`**: отвечает на свободные вопросы по каталогу ASISA. Каталог (34 продукта) грузится в системный промпт при старте и кэшируется (`cache_control: ephemeral`, prompt caching → дешёвые повторы). Прямой HTTP к Claude API (reqwest; у Anthropic нет Rust-SDK), модель из `ANTHROPIC_MODEL` (дефолт `claude-opus-4-8`). Бот строго по фактам: **цены не выдумывает** (где `pricing_notes: null` — «считается индивидуально/уточнит менеджер»), при незнании — передаёт менеджеру, отвечает на языке пользователя. Без `ANTHROPIC_API_KEY`/каталога фича выключена (**503 graceful**) — остальной сервис не затронут.
- **Frontend**: `askQuestion` (shared/api) + компонент `AskAssistant` на экране хендоффа («пока ждёте менеджера — спросите про страховки»). На 503 молча откатывается к фолбэку (ответит менеджер).
- **Стоимость:** каждый вопрос = платный вызов Claude API — отмечено в `.env.example`/`docs/deploy.md`; для трафика модель переключаема на Haiku/Sonnet.

**Проверено:** backend компилируется (clippy 0 warnings); каталог грузится при старте; `POST /api/chat` без ключа → 503 graceful; frontend typecheck (10 пакетов) + build + E2E (4/4) зелёные.

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
