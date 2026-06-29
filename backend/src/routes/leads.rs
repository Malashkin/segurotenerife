//! Вертикаль лидов: приём заявки из чата и выдача списка менеджеру.
//!
//!  - `POST /api/leads` — публичный: валидирует и сохраняет заявку.
//!  - `GET  /api/leads` — под токеном: возвращает последние лиды для дашборда.

use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::SocketAddr;
use uuid::Uuid;
use validator::Validate;

use crate::{error::AppError, AppState};

/// Входные данные заявки. Поля цели/состава/срочности необязательны:
/// чат может оборваться, но имя+контакт+согласие обязательны для лида.
#[derive(Debug, Deserialize, Validate)]
pub struct LeadIn {
    #[validate(length(min = 1, max = 120))]
    pub name: String,
    #[validate(length(min = 2, max = 200))]
    pub contact: String,
    #[validate(length(min = 1, max = 40))]
    pub messenger: String, // WhatsApp | Telegram | Viber
    pub comm_lang: Option<String>,
    pub goal: Option<String>,
    pub who: Option<String>,
    pub city: Option<String>,
    pub urgency: Option<String>,
    pub ui_lang: Option<String>,
    pub consent: bool,
}

pub async fn create(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<LeadIn>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    // Согласие на обработку данных (GDPR) — обязательное условие приёма лида.
    if !body.consent {
        return Err(AppError::Validation("consent is required".into()));
    }

    let id = Uuid::new_v4();
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let ip = crate::rate_limit::anonymize_ip(addr.ip());

    sqlx::query(
        "INSERT INTO leads \
         (id, name, contact, messenger, comm_lang, goal, who, city, urgency, ui_lang, consent, ip, user_agent) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.contact)
    .bind(&body.messenger)
    .bind(&body.comm_lang)
    .bind(&body.goal)
    .bind(&body.who)
    .bind(&body.city)
    .bind(&body.urgency)
    .bind(&body.ui_lang)
    .bind(body.consent)
    .bind(&ip)
    .bind(user_agent)
    .execute(&state.pool)
    .await?;

    tracing::info!(%id, "lead created");
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

/// Строка лида для дашборда (без ip/user_agent — лишнее в UI).
#[derive(Serialize, sqlx::FromRow)]
pub struct LeadRow {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub name: String,
    pub contact: String,
    pub messenger: String,
    pub comm_lang: Option<String>,
    pub goal: Option<String>,
    pub who: Option<String>,
    pub city: Option<String>,
    pub urgency: Option<String>,
    pub ui_lang: Option<String>,
    pub status: String,
}

pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    // Авторизация по access-JWT менеджера (Волна 3 заменила статичный токен).
    // Проверка инкапсулирована в auth-модуле: Bearer <access-jwt> с typ=access.
    super::auth::verify_access(&headers, &state.config)?;

    let rows: Vec<LeadRow> = sqlx::query_as::<_, LeadRow>(
        "SELECT id, created_at, name, contact, messenger, comm_lang, goal, who, city, urgency, ui_lang, status \
         FROM leads ORDER BY created_at DESC LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({ "leads": rows })))
}
