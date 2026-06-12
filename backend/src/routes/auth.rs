//! Аутентификация менеджера (lightweight single-manager JWT).
//!
//! Менеджер по сути один, поэтому без таблицы users/ролей: единственный пароль
//! хранится как argon2-хэш в ENV (`MANAGER_PASSWORD_HASH`). Поток (auth.md SOUL):
//!
//!   POST /api/auth/login   { password } -> { accessToken, expiresIn }
//!                          + Set-Cookie: refresh_token (httpOnly, SameSite=Strict)
//!   POST /api/auth/refresh (cookie)      -> { accessToken, expiresIn }
//!   POST /api/auth/logout                -> 204 + очистка cookie
//!
//! Access-токен короткоживущий (минуты) и живёт в памяти фронта (Authorization:
//! Bearer). Refresh-токен долгоживущий и лежит в httpOnly-cookie, недоступной JS,
//! — так его не украсть через XSS. Оба — подписанные JWT (HS256) с полем `typ`,
//! чтобы refresh-токен нельзя было использовать как access и наоборот.
//!
//! Refresh без отзыва в БД — осознанный компромисс «лёгкого» варианта: одного
//! менеджера достаточно поля `exp`. Полноценный отзыв (таблица refresh_tokens) —
//! это «полный» вариант auth.md, не нужный на текущем масштабе.

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{AppendHeaders, IntoResponse},
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{
    decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use validator::Validate;

use crate::{config::Config, error::AppError, AppState};

/// Имя refresh-cookie. Один источник правды для set/get/remove.
const REFRESH_COOKIE: &str = "refresh_token";
/// Субъект токена — единственный менеджер.
const SUBJECT: &str = "manager";
/// Тип access-токена (для авторизации запросов).
const TYP_ACCESS: &str = "access";
/// Тип refresh-токена (только для /refresh).
const TYP_REFRESH: &str = "refresh";

/// Полезная нагрузка JWT. `typ` различает access/refresh — refresh-токен,
/// присланный как Bearer, не пройдёт проверку access (и наоборот).
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    /// Субъект (всегда "manager").
    sub: String,
    /// Unix-время истечения (секунды). Проверяется библиотекой автоматически.
    exp: usize,
    /// Тип токена: "access" | "refresh".
    typ: String,
}

/// Тело запроса логина.
#[derive(Debug, Deserialize, Validate)]
pub struct LoginIn {
    #[validate(length(min = 1, max = 200))]
    pub password: String,
}

/// Кодирует JWT заданного типа с TTL в секундах.
fn make_token(config: &Config, typ: &str, ttl: Duration) -> Result<String, AppError> {
    let exp = (Utc::now() + ttl).timestamp() as usize;
    let claims = Claims {
        sub: SUBJECT.to_string(),
        exp,
        typ: typ.to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("jwt encode: {e}")))
}

/// Декодирует и валидирует JWT, сверяя ожидаемый тип. Любая ошибка (подпись,
/// истечение, неверный тип) -> Unauthorized: наружу не раскрываем причину.
fn decode_token(config: &Config, token: &str, expected_typ: &str) -> Result<Claims, AppError> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::Unauthorized)?;

    if data.claims.typ != expected_typ {
        return Err(AppError::Unauthorized);
    }
    Ok(data.claims)
}

/// Проверяет access-токен из заголовка `Authorization: Bearer <jwt>`.
/// Используется защищёнными хендлерами (например `GET /api/leads`).
pub fn verify_access(headers: &HeaderMap, config: &Config) -> Result<(), AppError> {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;
    decode_token(config, token, TYP_ACCESS)?;
    Ok(())
}

/// Строит значение заголовка `Set-Cookie` для refresh-токена с защитными флагами.
/// HttpOnly — недоступна JS (защита от XSS-кражи), SameSite=Strict — не уходит на
/// кросс-сайт запросах (защита от CSRF), Secure — только по HTTPS (в проде).
fn set_refresh_cookie(config: &Config, value: &str) -> String {
    let max_age = config.refresh_ttl_days * 24 * 60 * 60;
    let secure = if config.cookie_secure { "; Secure" } else { "" };
    format!(
        "{REFRESH_COOKIE}={value}; HttpOnly; Path=/; SameSite=Strict; Max-Age={max_age}{secure}"
    )
}

/// Строит `Set-Cookie`, немедленно стирающий refresh-cookie (Max-Age=0).
fn clear_refresh_cookie(config: &Config) -> String {
    let secure = if config.cookie_secure { "; Secure" } else { "" };
    format!("{REFRESH_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0{secure}")
}

/// Достаёт значение refresh-cookie из заголовка `Cookie: a=b; c=d`.
fn read_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';')
        .filter_map(|kv| kv.split_once('='))
        .find_map(|(k, v)| (k.trim() == REFRESH_COOKIE).then(|| v.trim().to_string()))
}

/// JSON-ответ с access-токеном и его сроком жизни (в секундах) — фронт по нему
/// планирует упреждающий refresh.
fn access_payload(config: &Config, access: String) -> Value {
    json!({
        "accessToken": access,
        "expiresIn": config.access_ttl_min * 60,
    })
}

/// `POST /api/auth/login` — проверяет пароль менеджера и выдаёт пару токенов.
///
/// При успехе: access-токен в теле + refresh-токен в httpOnly-cookie.
/// При неверном пароле: 401 (без подсказок, какой именно фактор неверен).
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginIn>,
) -> Result<impl IntoResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Парсим заранее заданный argon2-хэш и проверяем против него присланный пароль.
    let parsed = PasswordHash::new(&state.config.manager_password_hash)
        .map_err(|e| AppError::Internal(format!("bad MANAGER_PASSWORD_HASH: {e}")))?;
    Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let access = make_token(
        &state.config,
        TYP_ACCESS,
        Duration::minutes(state.config.access_ttl_min),
    )?;
    let refresh = make_token(
        &state.config,
        TYP_REFRESH,
        Duration::days(state.config.refresh_ttl_days),
    )?;

    tracing::info!("manager logged in");
    let headers = AppendHeaders([(header::SET_COOKIE, set_refresh_cookie(&state.config, &refresh))]);
    Ok((headers, Json(access_payload(&state.config, access))))
}

/// `POST /api/auth/refresh` — по валидному refresh-cookie выдаёт новый access.
/// Refresh-токен не ротируем (лёгкий вариант): cookie остаётся прежней.
pub async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let token = read_refresh_cookie(&headers).ok_or(AppError::Unauthorized)?;
    decode_token(&state.config, &token, TYP_REFRESH)?;

    let access = make_token(
        &state.config,
        TYP_ACCESS,
        Duration::minutes(state.config.access_ttl_min),
    )?;
    Ok(Json(access_payload(&state.config, access)))
}

/// `POST /api/auth/logout` — удаляет refresh-cookie. Access истечёт сам (минуты).
pub async fn logout(State(state): State<AppState>) -> impl IntoResponse {
    let headers = AppendHeaders([(header::SET_COOKIE, clear_refresh_cookie(&state.config))]);
    (StatusCode::NO_CONTENT, headers)
}
