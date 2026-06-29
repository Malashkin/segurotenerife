//! Origin-гейт: запрещает доступ к сервису в обход Cloudflare.
//!
//! Если задан `ORIGIN_SHARED_SECRET`, каждый запрос (кроме `/health`, который
//! пингует Railway напрямую) обязан нести заголовок `X-Origin-Auth` с этим
//! секретом. Cloudflare добавляет заголовок Transform-правилом, поэтому прямой
//! origin (`*.up.railway.app`) запросы без заголовка отдаёт 403. Это закрывает
//! подделку `CF-Connecting-IP` (см. `rate_limit.rs`): обойти rate limit можно
//! было, только достучавшись до origin напрямую — теперь это невозможно.
//!
//! Без секрета (локально/dev) гейт — no-op.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::AppState;

/// Сравнение в постоянном времени (без раннего выхода по первому различию) —
/// чтобы не давать timing-оракул на секрет. Длины раскрываются (приемлемо).
fn constant_time_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Middleware origin-гейта. При заданном секрете отбивает запросы без валидного
/// `X-Origin-Auth` (кроме `/health`) кодом 403.
pub async fn origin_gate_mw(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if let Some(secret) = state.config.origin_shared_secret.as_deref() {
        if request.uri().path() != "/health" {
            let ok = request
                .headers()
                .get("x-origin-auth")
                .and_then(|v| v.to_str().ok())
                .map(|v| constant_time_eq(v, secret))
                .unwrap_or(false);
            if !ok {
                return (StatusCode::FORBIDDEN, "forbidden").into_response();
            }
        }
    }
    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_time_eq_matches_only_identical() {
        assert!(constant_time_eq("secret-123", "secret-123"));
        assert!(!constant_time_eq("secret-123", "secret-124"));
        assert!(!constant_time_eq("secret-123", "secret-1234")); // разная длина
        assert!(!constant_time_eq("", "x"));
        assert!(constant_time_eq("", ""));
    }
}
