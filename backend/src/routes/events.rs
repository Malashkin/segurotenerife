//! Аналитика воронки: приём событий чата в таблицу `events`.
//!
//!  - `POST /api/events` — публичный (как и создание лида): фронтенд шлёт сюда
//!    лёгкие события воронки (`chat_started`, `step_completed`, `chat_completed`,
//!    `handoff_clicked`), чтобы можно было измерять ключевую метрику гипотезы
//!    (handoff rate: завершившие чат → перешедшие к менеджеру).
//!
//! Защита та же, что у лидов: глобальный per-IP rate limiting + лимит размера
//! тела. Эндпоинт пишет «сырые» события; агрегаты считаются на чтении.

use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use std::net::SocketAddr;
use validator::Validate;

use crate::{error::AppError, AppState};

/// Входные данные события воронки.
///
/// Обязателен только `event` (тип события). Остальное — необязательный контекст:
/// `session_id` связывает события одного посетителя, `lang` — язык интерфейса,
/// `meta` — произвольный JSON (например выбранный шаг/опция).
#[derive(Debug, Deserialize, Validate)]
pub struct EventIn {
    /// Идентификатор сессии посетителя (генерится на фронте), для склейки воронки.
    #[validate(length(max = 80))]
    pub session_id: Option<String>,
    /// Тип события: chat_started | step_completed | chat_completed | handoff_clicked | ...
    #[validate(length(min = 1, max = 60))]
    pub event: String,
    /// Язык интерфейса на момент события (en|es|uk|ru).
    #[validate(length(max = 8))]
    pub lang: Option<String>,
    /// Произвольный контекст события (шаг, опция и т.п.).
    pub meta: Option<Value>,
}

/// Принимает событие воронки и сохраняет его. Всегда отвечает `204 No Content`:
/// аналитика не должна влиять на UX, тело ответа фронту не нужно.
pub async fn create(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<EventIn>,
) -> Result<StatusCode, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let ip = addr.ip().to_string();

    sqlx::query(
        "INSERT INTO events (session_id, event, lang, meta, ip) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&body.session_id)
    .bind(&body.event)
    .bind(&body.lang)
    .bind(&body.meta)
    .bind(&ip)
    .execute(&state.pool)
    .await?;

    tracing::info!(event = %body.event, "funnel event recorded");
    Ok(StatusCode::NO_CONTENT)
}
