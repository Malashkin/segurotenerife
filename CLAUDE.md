# Seguro Tenerife

**Прочитай `../my-product-soul/SOUL.md` перед началом работы** — проект следует стандартам SOUL.

## Что это
Независимый мультиязычный сервис подбора страховки на Тенерифе (lead-generation).
Посетитель проходит чат-подбор на сайте → лид сохраняется → менеджер видит лиды в дашборде
и продолжает общение с клиентом в мессенджере (WhatsApp / Telegram / Viber).

Нейтральный бренд (без названия конкретной страховой). Мы — информационный сервис, не страховщик и не брокер.

## Стек (полный, по SOUL)
- **Backend:** Rust + axum + PostgreSQL (sqlx). REST. Structured JSON logging. Rate limiting.
- **Frontend:** React + Feature-Sliced Design + Nx (монорепо) + Zustand + TS strict + Shadcn/ui + TanStack Query + i18next.
- **Deploy:** Railway (backend + managed Postgres), frontend на Vercel/Netlify.

## Правила работы (из SOUL)
- Сначала план по `development/workflow.md` (декомпозиция → волны), не кодить без плана.
- Уведомлять пользователя о влиянии на нагрузку/стоимость (новые endpoint'ы, запросы к БД, AI-вызовы).
- Загружать детальные стандарты по мере необходимости, не читать всё сразу.
- Каждая задача → запись в `CHANGELOG.md` с бизнес-ценностью.

## Прогресс по волнам
- ✅ **Волна 1 — фундамент:** структура монорепо, backend-скелет (config, logging, pool, миграции), вертикаль лидов (`POST/GET /api/leads`), health-check, rate-limit, Docker.
- ✅ **Волна 2 — frontend:** pnpm-монорепо (Nx-совместимое) + FSD; `apps/web` (лендинг + чат, 4 языка) и `apps/admin` (дашборд лидов); i18next, Zustand, TanStack Query, Tailwind/shadcn. Чат на сабмите шлёт `POST /api/leads`; хендофф в WhatsApp/Telegram/Viber. typecheck + build зелёные; backend smoke пройден.
- ✅ **Волна 3 — аналитика + auth:** `POST /api/events` + трекинг воронки из чата (`trackEvent`); JWT-аутентификация менеджера (login/refresh/logout, argon2-пароль из ENV, access в памяти + refresh httpOnly-cookie) вместо статичного токена; вход admin по паролю с авто-refresh; lead-хуки вынесены в `entities/lead`. typecheck + build зелёные; e2e smoke backend (Postgres) 15/15.
- ⏳ **Волна 4:** деплой Railway, smoke + E2E (Playwright), нагрузочный smoke (k6).
- ⏳ **Волна 5:** сверка с acceptance criteria, CHANGELOG релиза.
