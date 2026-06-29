//! Сборка HTTP-роутера приложения.

pub mod auth;
pub mod chat;
pub mod events;
pub mod handoff;
pub mod health;
pub mod leads;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{rate_limit, AppState};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        // Публичные эндпоинты воронки.
        .route("/api/leads", post(leads::create).get(leads::list))
        .route("/api/events", post(events::create))
        // Чат-консультант (Claude API; 503 если не настроен). Поверх общего лимита —
        // строгий per-IP лимит: каждый запрос платный (защита от cost-DoS).
        .route(
            "/api/chat",
            post(chat::ask).route_layer(middleware::from_fn_with_state(
                state.clone(),
                rate_limit::chat_rate_limit_mw,
            )),
        )
        // Передача лида менеджеру в Telegram (бот). Поверх общего лимита — строгий
        // write-лимит: каждый запрос шлёт карточку менеджеру (анти-спам/флуд).
        .route(
            "/api/handoff",
            post(handoff::forward).route_layer(middleware::from_fn_with_state(
                state.clone(),
                rate_limit::write_rate_limit_mw,
            )),
        )
        // Аутентификация менеджера (JWT). Поверх общего лимита — строгий
        // login-лимит (анти-брутфорс пароля).
        .route(
            "/api/auth/login",
            post(auth::login).route_layer(middleware::from_fn_with_state(
                state.clone(),
                rate_limit::login_rate_limit_mw,
            )),
        )
        .route("/api/auth/refresh", post(auth::refresh))
        .route("/api/auth/logout", post(auth::logout))
        .with_state(state)
}
