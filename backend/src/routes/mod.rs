//! Сборка HTTP-роутера приложения.

pub mod auth;
pub mod chat;
pub mod events;
pub mod health;
pub mod leads;

use axum::{
    routing::{get, post},
    Router,
};

use crate::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        // Публичные эндпоинты воронки.
        .route("/api/leads", post(leads::create).get(leads::list))
        .route("/api/events", post(events::create))
        // Чат-консультант по базе знаний ASISA (Claude API; 503 если не настроен).
        .route("/api/chat", post(chat::ask))
        // Аутентификация менеджера (JWT).
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/refresh", post(auth::refresh))
        .route("/api/auth/logout", post(auth::logout))
        .with_state(state)
}
