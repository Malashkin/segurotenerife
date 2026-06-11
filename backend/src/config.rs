//! Конфигурация сервиса из переменных окружения.
//! Секреты (DATABASE_URL, ADMIN_API_TOKEN) — только из ENV, никогда не хардкодим.

use anyhow::Context;
use tower_http::cors::AllowOrigin;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub admin_api_token: String,
    pub allowed_origins_raw: String,
    pub rate_limit_per_min: u32,
}

impl Config {
    /// Считывает конфигурацию из окружения. Падает, если нет обязательных секретов.
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL is required")?,
            port: std::env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            admin_api_token: std::env::var("ADMIN_API_TOKEN")
                .context("ADMIN_API_TOKEN is required")?,
            allowed_origins_raw: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "*".into()),
            rate_limit_per_min: std::env::var("RATE_LIMIT_PER_MIN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
        })
    }

    /// Преобразует строку ALLOWED_ORIGINS в политику CORS.
    /// `*` → разрешить любой источник; иначе — белый список доменов через запятую.
    pub fn allowed_origins(&self) -> AllowOrigin {
        if self.allowed_origins_raw.trim() == "*" {
            return AllowOrigin::any();
        }
        let list: Vec<axum::http::HeaderValue> = self
            .allowed_origins_raw
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        AllowOrigin::list(list)
    }
}
