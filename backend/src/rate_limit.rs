//! Per-IP rate limiting (fixed window) + определение IP клиента за прокси.
//!
//! SOUL backend.md требует rate limiting на уровне приложения. Лёгкая in-memory
//! реализация без внешних зависимостей. Два применения:
//!  - общий лимит на все роуты (`rate_limit_mw`, дефолт 60/мин);
//!  - строгий лимит на платный `/api/chat` (`chat_rate_limit_mw`, дефолт 8/мин),
//!    т.к. каждый его запрос — платный вызов Claude (защита от cost-DoS).
//!
//! IP клиента берётся из прокси-заголовков, если `trust_proxy_headers=true`
//! (прод за Railway/Cloudflare). Иначе — адрес сокета. Для нескольких инстансов
//! лимитер позже выносится в Redis.

use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::AppState;

pub struct RateLimiter {
    buckets: Mutex<Buckets>,
    max_per_window: u32,
    window: Duration,
}

struct Buckets {
    map: HashMap<IpAddr, (u32, Instant)>,
    last_sweep: Instant,
}

impl RateLimiter {
    pub fn new(max_per_min: u32) -> Self {
        Self {
            buckets: Mutex::new(Buckets {
                map: HashMap::new(),
                last_sweep: Instant::now(),
            }),
            max_per_window: max_per_min,
            window: Duration::from_secs(60),
        }
    }

    /// Возвращает true, если запрос разрешён, и инкрементит счётчик IP.
    pub fn allow(&self, ip: IpAddr) -> bool {
        let mut b = self.buckets.lock().unwrap();
        let now = Instant::now();

        // Эвикция: не чаще раза в окно вычищаем протухшие IP, чтобы мапа не росла
        // бесконечно (иначе медленная утечка памяти / memory-DoS).
        if now.duration_since(b.last_sweep) > self.window {
            let window = self.window;
            b.map.retain(|_, (_, t)| now.duration_since(*t) <= window);
            b.last_sweep = now;
        }

        let entry = b.map.entry(ip).or_insert((0, now));
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

/// Определяет IP клиента. За доверенным прокси берёт CF-Connecting-IP, иначе
/// первый адрес X-Forwarded-For; без доверия к прокси — адрес сокета.
fn client_ip(headers: &HeaderMap, socket: SocketAddr, trust_proxy: bool) -> IpAddr {
    if trust_proxy {
        if let Some(ip) = headers
            .get("cf-connecting-ip")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.trim().parse::<IpAddr>().ok())
        {
            return ip;
        }
        if let Some(ip) = headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .and_then(|s| s.trim().parse::<IpAddr>().ok())
        {
            return ip;
        }
    }
    socket.ip()
}

/// Ответ при превышении лимита.
fn too_many() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [("Retry-After", "60")],
        "rate limit exceeded",
    )
        .into_response()
}

/// Middleware общего лимита (все роуты).
pub async fn rate_limit_mw(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let ip = client_ip(&headers, addr, state.config.trust_proxy_headers);
    if state.limiter.allow(ip) {
        next.run(request).await
    } else {
        too_many()
    }
}

/// Middleware строгого лимита для платного `/api/chat`.
pub async fn chat_rate_limit_mw(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let ip = client_ip(&headers, addr, state.config.trust_proxy_headers);
    if state.chat_limiter.allow(ip) {
        next.run(request).await
    } else {
        too_many()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    fn ip(n: u8) -> IpAddr {
        IpAddr::V4(Ipv4Addr::new(10, 0, 0, n))
    }

    #[test]
    fn allows_up_to_limit_then_blocks() {
        let rl = RateLimiter::new(3);
        assert!(rl.allow(ip(1)));
        assert!(rl.allow(ip(1)));
        assert!(rl.allow(ip(1)));
        assert!(!rl.allow(ip(1))); // 4-й сверх лимита
    }

    #[test]
    fn limits_are_per_ip() {
        let rl = RateLimiter::new(1);
        assert!(rl.allow(ip(1)));
        assert!(!rl.allow(ip(1)));
        assert!(rl.allow(ip(2))); // другой IP — своя корзина
    }

    #[test]
    fn client_ip_uses_xff_when_trusted() {
        let mut h = HeaderMap::new();
        h.insert("x-forwarded-for", "203.0.113.7, 70.41.3.18".parse().unwrap());
        let socket: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        assert_eq!(client_ip(&h, socket, true).to_string(), "203.0.113.7");
        // Без доверия к прокси — игнорируем заголовок, берём сокет.
        assert_eq!(client_ip(&h, socket, false).to_string(), "10.0.0.1");
    }

    #[test]
    fn client_ip_prefers_cf_header() {
        let mut h = HeaderMap::new();
        h.insert("cf-connecting-ip", "198.51.100.5".parse().unwrap());
        h.insert("x-forwarded-for", "203.0.113.7".parse().unwrap());
        let socket: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        assert_eq!(client_ip(&h, socket, true).to_string(), "198.51.100.5");
    }
}
