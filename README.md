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

# список лидов (только с токеном менеджера)
curl localhost:8080/api/leads -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|------------|-----------|--------------|
| `DATABASE_URL` | строка подключения к Postgres | — (обязательна) |
| `PORT` | порт HTTP-сервера | `8080` |
| `ADMIN_API_TOKEN` | токен доступа к списку лидов | — (обязательна) |
| `ALLOWED_ORIGINS` | CORS: список доменов через запятую или `*` | `*` |
| `RATE_LIMIT_PER_MIN` | лимит запросов с одного IP в минуту | `60` |
| `RUST_LOG` | уровень логирования | `info` |

## Статус
Волна 1 (фундамент backend) готова к сборке. Frontend и деплой — следующие волны (см. `CLAUDE.md`).
