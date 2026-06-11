# Changelog

Формат по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/). Версионирование — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

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
