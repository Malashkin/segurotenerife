//! `POST /api/handoff` — фиксация лида из чата при передаче менеджеру.
//!
//! Сохраняет лид в таблицу `leads` (виден в админке) и шлёт карточку лида
//! получателям в Telegram (владелец для учёта + менеджер(ы)). Имя обязательно.
//!
//! Telegram-канал особый: клиент уходит НЕ к менеджеру напрямую, а в бота
//! (`t.me/<bot>?start=<lead_id>`); ник + карточку дошлёт вебхук бота
//! (`telegram::webhook`), когда клиент нажмёт Start. Поэтому для `messenger =
//! Telegram` карточку здесь НЕ шлём (чтобы не дублировать без ника) — только
//! сохраняем лид. Для WhatsApp/Viber шлём карточку сразу (контакт неизвестен).
//!
//! `lead_id` приходит с фронта (UUID, сгенерированный клиентом) — чтобы
//! Telegram-deep-link `?start=<lead_id>` можно было построить синхронно (без
//! ожидания ответа сервера и блокировки попапа). Если не пришёл/невалиден —
//! генерируем свой. Публичный, под общим rate-limit.

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
    /// UUID лида, сгенерированный клиентом (для синхронного Telegram deep-link).
    #[validate(length(max = 36))]
    pub lead_id: Option<String>,
}

pub async fn forward(
    State(state): State<AppState>,
    Json(body): Json<HandoffIn>,
) -> Result<Json<Value>, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let lang = body.lang.as_deref().unwrap_or("ru");
    let messenger = body.messenger.as_deref().unwrap_or("—");
    let is_telegram = messenger.eq_ignore_ascii_case("Telegram");
    // Используем клиентский lead_id, если это валидный UUID; иначе генерируем.
    let lead_id = body
        .lead_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s.trim()).ok())
        .unwrap_or_else(Uuid::new_v4);

    // Сохраняем лид (контакт пока пустой — для Telegram дозахватим ник в вебхуке).
    // consent=true: переход к менеджеру = согласие на связь.
    let res = sqlx::query(
        "INSERT INTO leads \
         (id, name, contact, messenger, comm_lang, goal, ui_lang, consent) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, true) \
         ON CONFLICT (id) DO NOTHING",
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

    // Для Telegram карточку дошлёт вебхук (с ником) — здесь не дублируем.
    let delivered = if is_telegram {
        false
    } else {
        crate::telegram::send_lead(
            &state.http,
            &state.config,
            &crate::telegram::Lead {
                name: Some(body.name.trim()),
                question: body.question.as_deref(),
                topic: body.topic.as_deref(),
                messenger: body.messenger.as_deref(),
                contact: None,
                lang,
            },
        )
        .await
    };

    tracing::info!(messenger, is_telegram, delivered, "handoff lead saved");
    Ok(Json(json!({ "ok": true, "lead_id": lead_id })))
}
