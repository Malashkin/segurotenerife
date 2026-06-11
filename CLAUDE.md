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
- ⏳ **Волна 2:** frontend Nx/FSD — публичный лендинг + чат (порт из прототипа), словари i18n; дашборд менеджера.
- ⏳ **Волна 3:** связка чат → API + события аналитики; авторизация дашборда.
- ⏳ **Волна 4:** деплой Railway, smoke + E2E (Playwright), нагрузочный smoke (k6).
- ⏳ **Волна 5:** сверка с acceptance criteria, CHANGELOG релиза.
