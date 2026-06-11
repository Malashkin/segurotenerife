//! Health-check. Проверяет не только что процесс жив, но и что БД доступна
//! (см. backend.md → health отражает реальное состояние зависимостей).

use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{error::AppError, AppState};

pub async fn health(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({ "status": "ok" })))
}
