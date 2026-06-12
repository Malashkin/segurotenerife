# Деплой Seguro Tenerife (Волна 4)

Архитектура продакшена (по `CLAUDE.md`):

```
[ Пользователь ]
      │  https
      ▼
[ Frontend SPA ]  ── Vercel / Netlify (статика: apps/web, apps/admin)
      │  https + credentials (cookie)
      ▼
[ Backend API ]   ── Railway (Docker, этот репозиторий /backend)
      │
      ▼
[ PostgreSQL ]    ── Railway managed Postgres (плагин)
```

Backend и БД — на Railway; frontend (две статические SPA) — на Vercel или Netlify.

---

## 1. Backend + Postgres на Railway

### 1.1. Создать проект и Postgres
1. `railway login` → `railway init` (или создать проект в дашборде Railway).
2. Добавить **Postgres** (`+ New` → Database → PostgreSQL). Railway создаст
   переменную `DATABASE_URL` в плагине.

### 1.2. Сервис backend
Деплой ведётся из каталога `backend/` (там `Dockerfile` и `railway.toml`):
- **Build:** по `Dockerfile` (multi-stage, итоговый образ — debian-slim + бинарь).
- **Healthcheck:** `/health` (см. `railway.toml`) — Railway переключит трафик
  только после `200`. Миграции применяются автоматически при старте.

### 1.3. Переменные окружения сервиса backend
| Переменная | Значение |
|---|---|
| `DATABASE_URL` | сослаться на Postgres-плагин: `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | длинный случайный секрет: `openssl rand -hex 32` |
| `MANAGER_PASSWORD_HASH` | argon2-хэш пароля менеджера (см. ниже) |
| `ACCESS_TTL_MIN` | `30` (опц.) |
| `REFRESH_TTL_DAYS` | `7` (опц.) |
| `COOKIE_SECURE` | **`true`** (прод по HTTPS — обязательно) |
| `ALLOWED_ORIGINS` | домен(ы) фронтенда, **не `*`** (нужно для cookie): напр. `https://seguro.app,https://admin.seguro.app` |
| `RATE_LIMIT_PER_MIN` | `60` (опц.) |
| `ANTHROPIC_API_KEY` | ключ Claude API для чат-консультанта (опц.; без него `/api/chat` → 503). **Каждый вопрос = платный вызов API** |
| `ANTHROPIC_MODEL` | модель бота, `claude-opus-4-8` (опц.; для трафика — `claude-haiku-4-5`/`claude-sonnet-4-6`) |
| `KNOWLEDGE_PATH` | путь к `knowledge-base/asisa/catalog.json` (опц.; для Docker — смонтировать/скопировать каталог и указать путь) |
| `RUST_LOG` | `info` (опц.) |

> `PORT` задаёт Railway автоматически — сервис уже читает его из ENV.

### 1.4. Сгенерировать `MANAGER_PASSWORD_HASH`
Пароль в открытом виде нигде не хранится. Локально из репозитория:
```bash
cd backend
cargo run --bin hash_password -- 'ВашСложныйПароль'
# → $argon2id$v=19$m=19456,t=2,p=1$....   (вставить как MANAGER_PASSWORD_HASH)
```
Смена пароля = перегенерировать хэш и обновить переменную (рестарт сервиса).

---

## 2. Frontend (две SPA) на Vercel / Netlify

Обе сборки — статика Vite. Каждое приложение деплоится как отдельный проект
(или два проекта в монорепо), указывая на свой подкаталог.

### Общие настройки
| Параметр | `apps/web` | `apps/admin` |
|---|---|---|
| Root directory | `frontend` | `frontend` |
| Install | `pnpm install` | `pnpm install` |
| Build command | `pnpm build:web` | `pnpm build:admin` |
| Output directory | `apps/web/dist` | `apps/admin/dist` |

### Переменные окружения фронтенда
| Переменная | Значение |
|---|---|
| `VITE_API_URL` | URL backend на Railway, напр. `https://seguro-backend.up.railway.app` |
| `VITE_WHATSAPP_NUMBER` | номер WhatsApp офиса (формат wa.me, только цифры) |
| `VITE_TELEGRAM_USERNAME` | username Telegram офиса (без `@`) |
| `VITE_VIBER_NUMBER` | номер Viber (по умолчанию = WhatsApp) |

> SPA без роутера — fallback на `index.html` не обязателен. Если позже появится
> клиентский роутинг, добавить rewrite всех путей на `/index.html`
> (`vercel.json` → `rewrites`, или `netlify.toml` → `[[redirects]] from="/*" to="/index.html" status=200`).

---

## 3. Чек-лист «после деплоя»
- [ ] `GET https://<backend>/health` → `{"status":"ok"}` (БД на связи).
- [ ] Логин в дашборде проходит, лиды видны (значит `ALLOWED_ORIGINS` + `COOKIE_SECURE`
      настроены верно и cookie долетает).
- [ ] Отправка лида из чата на web → лид появился в дашборде.
- [ ] `ALLOWED_ORIGINS` не содержит `*` (иначе cookie-логин из браузера не работает).
- [ ] `JWT_SECRET` и `MANAGER_PASSWORD_HASH` заданы (без них сервис не стартует —
      это намеренно: «секрет обязателен»).

## 4. Smoke и нагрузка
- E2E (Playwright): `frontend/e2e` — `pnpm --filter @seguro/e2e test` (см. `frontend/e2e/README.md`).
- Нагрузочный smoke (k6): `scripts/load/smoke.js` — `k6 run scripts/load/smoke.js`
  (переменная `BASE_URL` указывает на цель).
