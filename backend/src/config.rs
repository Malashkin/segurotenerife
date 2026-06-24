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
    /// Общий лимит запросов в минуту на клиента (для всех роутов).
    pub rate_limit_per_min: u32,
    /// Строгий лимит для платного `/api/chat` (каждый запрос = вызов Claude).
    pub rate_limit_chat_per_min: u32,
    /// Доверять ли прокси-заголовкам (X-Forwarded-For/CF-Connecting-IP) для
    /// определения IP клиента. В проде ЗА прокси (Railway/Cloudflare) — `true`,
    /// иначе rate limit считает всех под одним IP прокси. Локально/без прокси —
    /// `false` (заголовки можно подделать, если сервис доступен напрямую).
    pub trust_proxy_headers: bool,

    /// Ключ Claude API (ANTHROPIC_API_KEY). Опционален: без него чат-консультант
    /// выключен (POST /api/chat вернёт 503), остальной сервис работает как обычно.
    pub anthropic_api_key: Option<String>,
    /// Модель Claude для ответов бота. По умолчанию claude-haiku-4-5 (дёшево,
    /// для grounded-RAG достаточно). Для более «умных» ответов на сложных
    /// вопросах можно переключить на claude-sonnet-4-6 / claude-opus-4-8.
    pub anthropic_model: String,
    /// Путь к бренд-нейтральному корпусу знаний RAG-агента (services.json).
    pub knowledge_path: String,

    /// Langfuse (observability диалогов агента). Оба ключа опциональны: без них
    /// трассировка выключена (no-op), чат работает как обычно. Secret — секрет
    /// (только backend-env). Base URL по умолчанию EU-облако.
    pub langfuse_public_key: Option<String>,
    pub langfuse_secret_key: Option<String>,
    pub langfuse_base_url: String,

    /// Telegram-бот для пересылки лидов менеджеру. Токен — секрет. chat_id
    /// менеджера получаем после того, как он нажал Start у бота. Оба опциональны:
    /// без них пересылка в Telegram выключена (фронт откатывается на t.me-ссылку).
    pub telegram_bot_token: Option<String>,
    pub telegram_manager_chat_id: Option<String>,
    /// Секрет вебхука Telegram (`X-Telegram-Bot-Api-Secret-Token`). Если задан —
    /// принимаем апдейты только с этим заголовком (защита публичного эндпойнта).
    pub telegram_webhook_secret: Option<String>,
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
            rate_limit_chat_per_min: std::env::var("RATE_LIMIT_CHAT_PER_MIN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8),
            trust_proxy_headers: std::env::var("TRUST_PROXY_HEADERS")
                .ok()
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            anthropic_model: std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-haiku-4-5".into()),
            knowledge_path: std::env::var("KNOWLEDGE_PATH")
                .unwrap_or_else(|_| "../knowledge-base/asisa/services.json".into()),
            langfuse_public_key: std::env::var("LANGFUSE_PUBLIC_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            langfuse_secret_key: std::env::var("LANGFUSE_SECRET_KEY")
                .ok()
                .filter(|s| !s.is_empty()),
            langfuse_base_url: std::env::var("LANGFUSE_BASE_URL")
                .unwrap_or_else(|_| "https://cloud.langfuse.com".into()),
            telegram_bot_token: std::env::var("TELEGRAM_BOT_TOKEN")
                .ok()
                .filter(|s| !s.is_empty()),
            telegram_manager_chat_id: std::env::var("TELEGRAM_MANAGER_CHAT_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            telegram_webhook_secret: std::env::var("TELEGRAM_WEBHOOK_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
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

    /// Минимально валидная конфигурация для тестов (дальше точечно правится через
    /// struct-update `..Config::test()`). Все секреты — заглушки.
    #[cfg(test)]
    pub fn test() -> Self {
        Self {
            database_url: "postgres://u:p@127.0.0.1/db".into(),
            port: 0,
            jwt_secret: "x".into(),
            manager_password_hash: "x".into(),
            access_ttl_min: 30,
            refresh_ttl_days: 7,
            cookie_secure: false,
            allowed_origins_raw: "*".into(),
            rate_limit_per_min: 60,
            rate_limit_chat_per_min: 8,
            trust_proxy_headers: false,
            anthropic_api_key: None,
            anthropic_model: "claude-haiku-4-5".into(),
            knowledge_path: "x".into(),
            langfuse_public_key: None,
            langfuse_secret_key: None,
            langfuse_base_url: "https://cloud.langfuse.com".into(),
            telegram_bot_token: None,
            telegram_manager_chat_id: None,
            telegram_webhook_secret: None,
        }
    }
}
