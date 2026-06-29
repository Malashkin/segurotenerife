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
        self.allow_at(ip, Instant::now())
    }

    /// Ядро лимита с инъектируемым «сейчас» (детерминированные тесты окна/эвикции).
    fn allow_at(&self, ip: IpAddr, now: Instant) -> bool {
        let mut b = self.buckets.lock().unwrap();

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

    /// Число отслеживаемых IP (для тестов эвикции).
    #[cfg(test)]
    fn tracked_ips(&self) -> usize {
        self.buckets.lock().unwrap().map.len()
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

/// Middleware строгого лимита на логин (анти-брутфорс пароля менеджера).
pub async fn login_rate_limit_mw(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let ip = client_ip(&headers, addr, state.config.trust_proxy_headers);
    if state.login_limiter.allow(ip) {
        next.run(request).await
    } else {
        too_many()
    }
}

/// Middleware строгого лимита на публичные write-эндпоинты (`/api/handoff`):
/// ограничивает спам фейк-лидами и флуд карточек менеджеру в Telegram.
pub async fn write_rate_limit_mw(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let ip = client_ip(&headers, addr, state.config.trust_proxy_headers);
    if state.write_limiter.allow(ip) {
        next.run(request).await
    } else {
        too_many()
    }
}

/// Анонимизирует IP перед записью в БД (GDPR data-minimisation): обнуляет
/// host-часть — IPv4 до /24, IPv6 до /48. Достаточно для грубой гео-аналитики,
/// но не идентифицирует конкретного пользователя.
pub fn anonymize_ip(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(a) => {
            let o = a.octets();
            format!("{}.{}.{}.0", o[0], o[1], o[2])
        }
        IpAddr::V6(a) => {
            let s = a.segments();
            format!("{:x}:{:x}:{:x}::", s[0], s[1], s[2])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, middleware, routing::get, Router};
    use std::net::Ipv4Addr;
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    use tower::ServiceExt;

    fn ip(n: u8) -> IpAddr {
        IpAddr::V4(Ipv4Addr::new(10, 0, 0, n))
    }

    /// Минимальный AppState для интеграции middleware (пул ленивый — БД не трогаем).
    fn test_state(general: u32, chat: u32) -> AppState {
        let cfg = crate::config::Config {
            rate_limit_per_min: general,
            rate_limit_chat_per_min: chat,
            ..crate::config::Config::test()
        };
        AppState {
            pool: sqlx::PgPool::connect_lazy("postgres://u:p@127.0.0.1/db").unwrap(),
            config: Arc::new(cfg),
            limiter: Arc::new(RateLimiter::new(general)),
            chat_limiter: Arc::new(RateLimiter::new(chat)),
            login_limiter: Arc::new(RateLimiter::new(5)),
            write_limiter: Arc::new(RateLimiter::new(10)),
            http: reqwest::Client::new(),
            knowledge: None,
        }
    }

    async fn status(app: &Router, addr: SocketAddr) -> StatusCode {
        let mut req = Request::builder().uri("/r").body(Body::empty()).unwrap();
        req.extensions_mut().insert(ConnectInfo(addr));
        app.clone().oneshot(req).await.unwrap().status()
    }

    #[test]
    fn window_resets_after_expiry() {
        let rl = RateLimiter::new(2); // окно 60с
        let t0 = Instant::now();
        assert!(rl.allow_at(ip(1), t0));
        assert!(rl.allow_at(ip(1), t0));
        assert!(!rl.allow_at(ip(1), t0)); // лимит исчерпан в окне
        // После истечения окна счётчик сбрасывается — снова можно.
        let t1 = t0 + Duration::from_secs(61);
        assert!(rl.allow_at(ip(1), t1));
        assert!(rl.allow_at(ip(1), t1));
        assert!(!rl.allow_at(ip(1), t1)); // и снова лимит в новом окне
    }

    #[test]
    fn window_boundary_is_exclusive() {
        // Граница: РОВНО окно (60с) ещё НЕ сбрасывает счётчик (условие `> window`,
        // не `>=`). На 60с лимит держится, на 60.001с — сброс.
        let rl = RateLimiter::new(1);
        let t0 = Instant::now();
        assert!(rl.allow_at(ip(1), t0));
        assert!(!rl.allow_at(ip(1), t0 + Duration::from_secs(60))); // ровно окно → ещё лимит
        assert!(rl.allow_at(ip(1), t0 + Duration::from_millis(60_001))); // чуть за окном → сброс
    }

    #[test]
    fn evicts_stale_ips_after_window() {
        let rl = RateLimiter::new(5);
        let t0 = Instant::now();
        rl.allow_at(ip(1), t0);
        rl.allow_at(ip(2), t0);
        assert_eq!(rl.tracked_ips(), 2);
        // Спустя окно новый запрос триггерит свип — протухшие IP уходят из мапы.
        let t1 = t0 + Duration::from_secs(61);
        rl.allow_at(ip(3), t1);
        assert_eq!(rl.tracked_ips(), 1); // остался только активный ip(3)
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
    fn anonymize_ip_zeroes_host_part() {
        assert_eq!(anonymize_ip("203.0.113.77".parse().unwrap()), "203.0.113.0");
        assert_eq!(
            anonymize_ip("2606:4700:4700::1111".parse().unwrap()),
            "2606:4700:4700::"
        );
    }

    #[test]
    fn too_many_returns_429() {
        // Ответ лимита — именно 429 (а не пустой 200 по умолчанию).
        assert_eq!(too_many().status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn client_ip_prefers_cf_header() {
        let mut h = HeaderMap::new();
        h.insert("cf-connecting-ip", "198.51.100.5".parse().unwrap());
        h.insert("x-forwarded-for", "203.0.113.7".parse().unwrap());
        let socket: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        assert_eq!(client_ip(&h, socket, true).to_string(), "198.51.100.5");
    }

    #[tokio::test]
    async fn chat_middleware_blocks_over_strict_limit() {
        // Интеграция: запрос через router с chat_rate_limit_mw. Сверх лимита (2) →
        // middleware отдаёт 429 (а не пропускает/не возвращает дефолтный 200).
        let state = test_state(1000, 2);
        let app = Router::new()
            .route("/r", get(|| async { "ok" }))
            .route_layer(middleware::from_fn_with_state(state.clone(), chat_rate_limit_mw))
            .with_state(state);
        let addr: SocketAddr = "9.9.9.9:1234".parse().unwrap();
        assert_eq!(status(&app, addr).await, StatusCode::OK);
        assert_eq!(status(&app, addr).await, StatusCode::OK);
        assert_eq!(status(&app, addr).await, StatusCode::TOO_MANY_REQUESTS);
    }

    #[tokio::test]
    async fn general_middleware_blocks_over_limit() {
        // То же для общего rate_limit_mw (лимит 1).
        let state = test_state(1, 1000);
        let app = Router::new()
            .route("/r", get(|| async { "ok" }))
            .route_layer(middleware::from_fn_with_state(state.clone(), rate_limit_mw))
            .with_state(state);
        let addr: SocketAddr = "8.8.8.8:4321".parse().unwrap();
        assert_eq!(status(&app, addr).await, StatusCode::OK);
        assert_eq!(status(&app, addr).await, StatusCode::TOO_MANY_REQUESTS);
    }
}
