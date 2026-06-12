# Seguro Tenerife

Независимый мультиязычный сервис подбора страховки на Тенерифе (lead-generation).
Чат-подбор на сайте → лид в БД → менеджер видит лиды в дашборде и продолжает в мессенджере.

## Архитектура

```
seguro-tenerife/
├── backend/            # Rust + axum + PostgreSQL (sqlx)
│   ├── src/
│   │   ├── main.rs        # bootstrap: config, logging, pool, миграции, router
│   │   ├── config.rs      # конфигурация из ENV
│   │   ├── db.rs          # пул соединений Postgres
│   │   ├── error.rs       # единый тип ошибки + ответы
│   │   ├── rate_limit.rs  # rate limiting (per-IP, fixed window)
│   │   └── routes/        # health, leads
│   ├── migrations/        # SQL-миграции (sqlx)
│   └── Dockerfile
├── frontend/           # (Волна 2) Nx + React + FSD
├── docker-compose.yml  # Postgres + backend
└── .env.example
```

## Быстрый старт (backend)

Требуется: Docker (или локально Rust 1.88+ и PostgreSQL).

### Вариант A — через Docker Compose (рекомендуется)
```bash
cp .env.example .env          # при необходимости поправьте значения
docker compose up --build     # поднимет Postgres + backend на :8080
```

### Вариант B — локально
```bash
cp .env.example .env
# поднимите Postgres и пропишите DATABASE_URL в .env
cd backend
cargo run                     # миграции применяются автоматически при старте
```

## Проверка

```bash
# health (проверяет и соединение с БД)
curl localhost:8080/health

# создать лид
curl -X POST localhost:8080/api/leads \
  -H 'Content-Type: application/json' \
  -d '{"name":"Anna","contact":"+34600000000","messenger":"WhatsApp","goal":"residency","ui_lang":"ru","consent":true}'

# событие воронки (аналитика)
curl -X POST localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{"event":"chat_started","session_id":"s1","lang":"ru"}'

# логин менеджера → access-токен (+ refresh-cookie); пароль задаётся как argon2-хэш
ACCESS=$(curl -s -c cookies.txt -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"<пароль>"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')

# список лидов (только с access-токеном менеджера)
curl localhost:8080/api/leads -H "Authorization: Bearer $ACCESS"

# продлить сессию по refresh-cookie
curl -b cookies.txt -X POST localhost:8080/api/auth/refresh
```

Сгенерировать `MANAGER_PASSWORD_HASH` из пароля:
```bash
cargo run --bin hash_password -- 'ВашСложныйПароль'   # печатает argon2-хэш в ENV
```

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|------------|-----------|--------------|
| `DATABASE_URL` | строка подключения к Postgres | — (обязательна) |
| `PORT` | порт HTTP-сервера | `8080` |
| `JWT_SECRET` | секрет подписи JWT (HS256) | — (обязательна) |
| `MANAGER_PASSWORD_HASH` | argon2-хэш пароля менеджера | — (обязательна) |
| `ACCESS_TTL_MIN` | срок жизни access-токена, мин | `30` |
| `REFRESH_TTL_DAYS` | срок жизни refresh-токена, дней | `7` |
| `COOKIE_SECURE` | флаг Secure на refresh-cookie (HTTPS) | `false` |
| `ALLOWED_ORIGINS` | CORS: список доменов через запятую или `*` | `*` |
| `RATE_LIMIT_PER_MIN` | лимит запросов с одного IP в минуту | `60` |
| `RUST_LOG` | уровень логирования | `info` |

> Для cookie-логина из браузера укажите конкретный `ALLOWED_ORIGINS` (не `*`) —
> при credentials спецификация CORS запрещает wildcard.

## Статус
Волны 1–3 готовы: фундамент backend, frontend (лендинг+чат, дашборд), аналитика
воронки и JWT-аутентификация менеджера. Деплой и E2E — следующие волны (см. `CLAUDE.md`).
