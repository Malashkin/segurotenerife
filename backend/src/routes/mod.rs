//! Сборка HTTP-роутера приложения.

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
        .route("/api/leads", post(leads::create).get(leads::list))
        .with_state(state)
}
