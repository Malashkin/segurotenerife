//! Точка входа backend-сервиса Seguro Tenerife.
//!
//! Поднимает HTTP-сервер на axum:
//!  1. читает конфигурацию из переменных окружения (`config.rs`);
//!  2. настраивает structured JSON logging (tracing);
//!  3. создаёт пул соединений к PostgreSQL и прогоняет миграции;
//!  4. собирает роутер с middleware (rate limiting, лимит размера тела, CORS, трейсинг);
//!  5. слушает входящие запросы.

mod config;
mod db;
mod error;
mod rate_limit;
mod routes;

use std::{net::SocketAddr, sync::Arc};

use axum::middleware;
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Общее состояние приложения, доступное во всех хендлерах.
/// Клонируется дёшево: пул и Arc — это счётчики ссылок.
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: Arc<config::Config>,
    pub limiter: Arc<rate_limit::RateLimiter>,
    /// HTTP-клиент к Claude API (переиспользуем пул соединений).
    pub http: reqwest::Client,
    /// Готовый системный промпт чат-консультанта (инструкции + каталог ASISA),
    /// собранный при старте. None, если каталог не загрузился — тогда чат выключен.
    pub knowledge_prompt: Option<Arc<String>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // .env подхватывается только локально; в проде переменные задаёт платформа.
    dotenvy::dotenv().ok();

    // Structured logging в JSON — обязателен даже в MVP (без логов дебаг невозможен).
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let config = Arc::new(config::Config::from_env()?);
    let pool = db::connect(&config.database_url).await?;

    // Миграции применяются автоматически при старте — один источник правды для схемы.
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("migrations applied");

    let limiter = Arc::new(rate_limit::RateLimiter::new(config.rate_limit_per_min));

    // Чат-консультант (Волна C): собираем системный промпт из базы знаний ASISA.
    // Если каталог не найден или ключ Claude не задан — чат просто выключен (503),
    // остальной сервис работает как обычно.
    let knowledge_prompt = match routes::chat::load_knowledge_prompt(&config.knowledge_path) {
        Ok(prompt) => {
            tracing::info!(
                ai_enabled = config.anthropic_api_key.is_some(),
                "knowledge base loaded for chat assistant"
            );
            Some(Arc::new(prompt))
        }
        Err(e) => {
            tracing::warn!(error = %e, path = %config.knowledge_path, "knowledge base not loaded — chat assistant disabled");
            None
        }
    };

    let state = AppState {
        pool,
        config: config.clone(),
        limiter,
        http: reqwest::Client::new(),
        knowledge_prompt,
    };

    // CORS. Refresh-токен лежит в cookie, поэтому при заданном белом списке
    // доменов включаем credentials — иначе браузер не пошлёт/не примет cookie.
    // Спецификация запрещает сочетать credentials с wildcard (`*`/Any), поэтому:
    //   - ALLOWED_ORIGINS=*           → Any, без credentials (только для dev/curl);
    //   - ALLOWED_ORIGINS=<домены>    → конкретный список + credentials + явные
    //                                   методы/заголовки (Authorization, Content-Type).
    let cors = if config.allowed_origins_raw.trim() == "*" {
        CorsLayer::new()
            .allow_origin(tower_http::cors::AllowOrigin::any())
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any)
    } else {
        CorsLayer::new()
            .allow_origin(config.allowed_origins())
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
            .allow_headers([
                axum::http::header::CONTENT_TYPE,
                axum::http::header::AUTHORIZATION,
            ])
            .allow_credentials(true)
    };

    let app = routes::router(state.clone())
        // Защита: per-IP rate limiting.
        .layer(middleware::from_fn_with_state(
            state.clone(),
            rate_limit::rate_limit_mw,
        ))
        // Защита: ограничение размера тела запроса (1 MB).
        .layer(RequestBodyLimitLayer::new(1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!(%addr, "starting server");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    // into_make_service_with_connect_info нужен, чтобы middleware видел IP клиента.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
