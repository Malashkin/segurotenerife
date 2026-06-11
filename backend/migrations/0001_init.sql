-- Волна 1: базовая схема. Таблицы leads и events.
-- Соглашения (database.md): snake_case, множественное число таблиц, индексы на частые выборки.

CREATE TABLE IF NOT EXISTS leads (
    id          UUID PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    name        TEXT        NOT NULL,
    contact     TEXT        NOT NULL,           -- телефон или @username
    messenger   TEXT        NOT NULL,           -- WhatsApp | Telegram | Viber
    comm_lang   TEXT,                           -- язык общения, выбранный в чате
    goal        TEXT,                           -- цель: residency | dental | family | business | other
    who         TEXT,                           -- состав: one | pair | family
    city        TEXT,                           -- район Тенерифе
    urgency     TEXT,                           -- urgent | soon | browsing
    ui_lang     TEXT,                           -- язык интерфейса на момент заявки
    consent     BOOLEAN     NOT NULL DEFAULT false,
    status      TEXT        NOT NULL DEFAULT 'new',  -- new | in_progress | signed | rejected
    ip          TEXT,
    user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);

-- Лёгкая аналитика воронки (chat_started / chat_completed / handoff и т.п.)
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id  TEXT,
    event       TEXT        NOT NULL,
    lang        TEXT,
    meta        JSONB,
    ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event      ON events (event);
