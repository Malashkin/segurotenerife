//! Единый тип ошибки приложения и его преобразование в HTTP-ответ.
//! Наружу отдаём безопасные сообщения; детали БД логируем, но не показываем клиенту.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("validation error: {0}")]
    Validation(String),

    #[error("unauthorized")]
    Unauthorized,

    /// Внутренняя ошибка (крипто/JWT/конфиг): детали в логи, наружу — 500.
    #[error("internal error: {0}")]
    Internal(String),

    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Validation(m) => (StatusCode::BAD_REQUEST, m.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized".to_string()),
            AppError::Internal(e) => {
                // Внутреннюю причину — в логи, наружу — обобщённое сообщение.
                tracing::error!(error = %e, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
            AppError::Db(e) => {
                // Внутреннюю причину — в логи, наружу — обобщённое сообщение.
                tracing::error!(error = %e, "database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
