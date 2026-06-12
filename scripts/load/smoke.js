/**
 * k6 нагрузочный smoke (Волна 4).
 *
 * Лёгкая нагрузка на публичные endpoint'ы воронки — проверяем, что backend под
 * параллельными запросами держит latency и не отдаёт ошибок:
 *   GET  /health        — живость + соединение с БД
 *   POST /api/events     — запись события воронки (204)
 *   POST /api/leads      — создание лида (201, запись в БД)
 *
 * Цель указывается через BASE_URL (по умолчанию локальный backend). Это smoke,
 * а не стресс: немного VU на короткое время — поймать грубые регрессии latency и
 * ошибки записи, не «ронять» сервис.
 *
 * ВАЖНО: при локальном прогоне поднимайте backend с высоким RATE_LIMIT_PER_MIN —
 * иначе сработает per-IP rate limiting (все запросы с одного IP) и smoke измерит
 * лимитер, а не приложение. См. scripts/load/run-local.sh.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

/** Доля бизнес-ошибок (неожиданный статус) — отдельный порог поверх http_req_failed. */
export const businessErrors = new Rate('business_errors');

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 5, duration: '15s' },
  },
  thresholds: {
    // Латентность: 95-й перцентиль ниже 500мс (локально — с большим запасом).
    http_req_duration: ['p(95)<500'],
    // Транспортных сбоев почти нет.
    http_req_failed: ['rate<0.01'],
    // Бизнес-статусы (200/204/201) — без сюрпризов.
    business_errors: ['rate<0.01'],
  },
};

export default function () {
  // 1. health
  const health = http.get(`${BASE}/health`);
  businessErrors.add(!check(health, { 'health 200': (r) => r.status === 200 }));

  // 2. событие воронки
  const evt = http.post(
    `${BASE}/api/events`,
    JSON.stringify({ event: 'chat_started', session_id: `vu-${__VU}-${__ITER}`, lang: 'ru' }),
    JSON_HEADERS,
  );
  businessErrors.add(!check(evt, { 'event 204': (r) => r.status === 204 }));

  // 3. создание лида (запись в БД)
  const lead = http.post(
    `${BASE}/api/leads`,
    JSON.stringify({
      name: `Load ${__VU}-${__ITER}`,
      contact: '+34600000000',
      messenger: 'WhatsApp',
      consent: true,
      goal: 'residency',
      ui_lang: 'ru',
    }),
    JSON_HEADERS,
  );
  businessErrors.add(!check(lead, { 'lead 201': (r) => r.status === 201 }));

  sleep(0.5);
}
