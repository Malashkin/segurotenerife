//! Простой per-IP rate limiting (fixed window).
//!
//! SOUL backend.md требует rate limiting на уровне приложения. Здесь — лёгкая
//! in-memory реализация без внешних зависимостей: на каждый IP считаем число
//! запросов в текущем окне (по умолчанию 60 секунд). Для нескольких инстансов
//! позже выносится в Redis, но для одного сервера этого достаточно.

use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::AppState;

pub struct RateLimiter {
    buckets: Mutex<HashMap<IpAddr, (u32, Instant)>>,
    max_per_window: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_per_min: u32) -> Self {
        Self {
            buckets: Mutex::new(HashMap::new()),
            max_per_window: max_per_min,
            window: Duration::from_secs(60),
        }
    }

    /// Возвращает true, если запрос разрешён, и инкрементит счётчик IP.
    pub fn allow(&self, ip: IpAddr) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();
        let entry = buckets.entry(ip).or_insert((0, now));

        // Окно истекло — сбрасываем счётчик.
        if now.duration_since(entry.1) > self.window {
            *entry = (0, now);
        }
        if entry.0 >= self.max_per_window {
            return false;
        }
        entry.0 += 1;
        true
    }
}

/// Middleware: на каждый запрос проверяет лимит по IP клиента.
pub async fn rate_limit_mw(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    if state.limiter.allow(addr.ip()) {
        next.run(request).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            [("Retry-After", "60")],
            "rate limit exceeded",
        )
            .into_response()
    }
}
