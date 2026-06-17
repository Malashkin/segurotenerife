//! Конфигурация сервиса из переменных окружения.
//! Секреты (DATABASE_URL, JWT_SECRET, MANAGER_PASSWORD_HASH) — только из ENV,
//! никогда не хардкодим.

use anyhow::Context;
use tower_http::cors::AllowOrigin;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    /// Секрет подписи JWT (HS256). Обязателен — на нём держится вся авторизация.
    pub jwt_secret: String,
    /// PHC-строка argon2-хэша пароля единственного менеджера (генерится скриптом).
    /// Пароль в открытом виде в проде не хранится — только его argon2-хэш.
    pub manager_password_hash: String,
    /// Время жизни access-токена в минутах (короткое — он в памяти фронта).
    pub access_ttl_min: i64,
    /// Время жизни refresh-токена в днях (длинное — он в httpOnly-cookie).
    pub refresh_ttl_days: i64,
    /// Ставить ли флаг Secure на refresh-cookie (true в проде/HTTPS, false локально).
    pub cookie_secure: bool,
    pub allowed_origins_raw: String,
    pub rate_limit_per_min: u32,

    /// Ключ Claude API (ANTHROPIC_API_KEY). Опционален: без него чат-консультант
    /// выключен (POST /api/chat вернёт 503), остальной сервис работает как обычно.
    pub anthropic_api_key: Option<String>,
    /// Модель Claude для ответов бота (по умолчанию claude-opus-4-8). Для большого
    /// трафика можно переключить на claude-haiku-4-5 / claude-sonnet-4-6 ради цены.
    pub anthropic_model: String,
    /// Путь к бренд-нейтральному корпусу знаний RAG-агента (services.json).
    pub knowledge_path: String,
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
            jwt_secret: std::env::var("JWT_SECRET")
                .context("JWT_SECRET is required")?,
            manager_password_hash: std::env::var("MANAGER_PASSWORD_HASH")
                .context("MANAGER_PASSWORD_HASH is required")?,
            access_ttl_min: std::env::var("ACCESS_TTL_MIN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            refresh_ttl_days: std::env::var("REFRESH_TTL_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(7),
            cookie_secure: std::env::var("COOKIE_SECURE")
                .ok()
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
            allowed_origins_raw: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "*".into()),
            rate_limit_per_min: std::env::var("RATE_LIMIT_PER_MIN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            anthropic_model: std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-opus-4-8".into()),
            knowledge_path: std::env::var("KNOWLEDGE_PATH")
                .unwrap_or_else(|_| "../knowledge-base/asisa/services.json".into()),
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
