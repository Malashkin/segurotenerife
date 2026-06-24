//! `POST /api/handoff` — пересылка лида менеджеру в Telegram (бот).
//!
//! Публичный, под общим rate-limit. Принимает имя (опц.), последний вопрос и
//! язык. Если Telegram-бот настроен — отправляет менеджеру сообщение и возвращает
//! `{ ok: true }`; иначе `{ ok: false }` (фронт всё равно откроет t.me-чат).

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use validator::Validate;

use crate::{error::AppError, AppState};

#[derive(Debug, Deserialize, Validate)]
pub struct HandoffIn {
    #[validate(length(max = 80))]
    pub name: Option<String>,
    #[validate(length(max = 1000))]
    pub question: Option<String>,
    #[validate(length(max = 8))]
    pub lang: Option<String>,
}

pub async fn forward(
    State(state): State<AppState>,
    Json(body): Json<HandoffIn>,
) -> Result<Json<Value>, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let lang = body.lang.as_deref().unwrap_or("ru");
    let ok = crate::telegram::send_lead(
        &state.http,
        &state.config,
        body.name.as_deref(),
        body.question.as_deref(),
        lang,
    )
    .await;

    tracing::info!(delivered = ok, "handoff forwarded to manager");
    Ok(Json(json!({ "ok": ok })))
}
