//! `POST /api/handoff` — фиксация лида из чата при передаче менеджеру.
//!
//! Сохраняет лид в таблицу `leads` (виден в админке) и шлёт карточку лида
//! получателям в Telegram (владелец для учёта + менеджер(ы)) — со всех каналов.
//! Имя обязательно. Контакт клиента на этом шаге не собираем (для Telegram клиент
//! сам копирует заготовленное сообщение и идёт в чат менеджера). Публичный, под
//! общим rate-limit.

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use validator::Validate;

use crate::{error::AppError, AppState};

#[derive(Debug, Deserialize, Validate)]
pub struct HandoffIn {
    /// Имя — обязательно («Как к вам обращаться»).
    #[validate(length(min = 1, max = 80))]
    pub name: String,
    /// Последний вопрос пользователя (контекст для менеджера).
    #[validate(length(max = 1000))]
    pub question: Option<String>,
    /// Вид страховки (человекочитаемый лейбл, как видит клиент) — в goal лида.
    #[validate(length(max = 80))]
    pub topic: Option<String>,
    #[validate(length(max = 8))]
    pub lang: Option<String>,
    /// Выбранный мессенджер (WhatsApp|Telegram|Viber).
    #[validate(length(max = 16))]
    pub messenger: Option<String>,
}

pub async fn forward(
    State(state): State<AppState>,
    Json(body): Json<HandoffIn>,
) -> Result<Json<Value>, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let lang = body.lang.as_deref().unwrap_or("ru");
    let messenger = body.messenger.as_deref().unwrap_or("—");
    let lead_id = Uuid::new_v4();

    // Сохраняем лид. consent=true: переход к менеджеру = согласие на связь.
    let res = sqlx::query(
        "INSERT INTO leads \
         (id, name, contact, messenger, comm_lang, goal, ui_lang, consent) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)",
    )
    .bind(lead_id)
    .bind(body.name.trim())
    .bind("")
    .bind(messenger)
    .bind(lang)
    .bind(body.topic.as_deref())
    .bind(lang)
    .execute(&state.pool)
    .await;
    if let Err(e) = res {
        tracing::warn!(error = %e, "handoff lead insert failed");
    }

    // Карточка лида получателям в Telegram (если настроен бот + chat_id) — со всех
    // каналов, чтобы лид всегда попадал к нам в учёт.
    let delivered = crate::telegram::send_lead(
        &state.http,
        &state.config,
        &crate::telegram::Lead {
            name: Some(body.name.trim()),
            question: body.question.as_deref(),
            topic: body.topic.as_deref(),
            messenger: body.messenger.as_deref(),
            lang,
        },
    )
    .await;

    tracing::info!(messenger, delivered, "handoff lead saved");
    Ok(Json(json!({ "ok": true, "lead_id": lead_id })))
}
