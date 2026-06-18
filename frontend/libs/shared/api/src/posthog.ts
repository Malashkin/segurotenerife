/**
 * Интеграция PostHog (продуктовая аналитика) — единая обёртка для web и admin.
 *
 * Принципы:
 *  - GDPR: capture ВЫКЛЮЧЕН по умолчанию (`opt_out_capturing_by_default`), пока
 *    пользователь не дал согласие на куки (баннер CookieConsent → setAnalyticsConsent).
 *  - Ключ — ТОЛЬКО из env (`PUBLIC_POSTHOG_KEY` для Astro / `VITE_POSTHOG_KEY`),
 *    публичный проектный ключ `phc_…` (он write-only и безопасен в клиенте).
 *    Персональные ключи `phx_…` сюда не годятся и в клиент НЕ попадают.
 *  - Никогда не бросает и не ломает UX: всё под `typeof window` и try/catch,
 *    без ключа/вне браузера — тихий no-op (dev/e2e/SSR работают как обычно).
 *  - PII: на форме чата есть контакт/имя → в session recording маскируем все
 *    инпуты; на admin (где видны лиды) autocapture/recording выключены.
 */
import posthog from 'posthog-js';

/** Прочитать env-значение из Astro(PUBLIC_*)/Vite(VITE_*)-окружения. */
function env(name: string): string | undefined {
  try {
    const e = import.meta.env as Record<string, string | undefined>;
    return e[`PUBLIC_${name}`] ?? e[`VITE_${name}`];
  } catch {
    return undefined;
  }
}

const CONSENT_KEY = 'seguro_cookie_consent';

/** Уже инициализировали инстанс? (идемпотентность для нескольких островов/точек). */
let initialized = false;

/** Опции инициализации. */
export interface InitAnalyticsOptions {
  /** Авто-захват кликов/сабмитов (по умолчанию true — публичный сайт). */
  autocapture?: boolean;
  /** Запись сессий (по умолчанию true для web; на admin выключаем — PII лидов). */
  sessionRecording?: boolean;
}

/**
 * Инициализирует PostHog. Безопасна: без ключа/вне браузера — no-op.
 * Capture не начнётся, пока не вызовут setAnalyticsConsent(true) (или согласие
 * уже сохранено) — это требование GDPR.
 */
export function initAnalytics(opts: InitAnalyticsOptions = {}): void {
  if (initialized || typeof window === 'undefined') return;
  const key = env('POSTHOG_KEY');
  if (!key) return; // ключ не задан — аналитика выключена, без ошибок

  const host = env('POSTHOG_HOST') ?? 'https://eu.i.posthog.com';
  const autocapture = opts.autocapture ?? true;
  const sessionRecording = opts.sessionRecording ?? true;

  try {
    posthog.init(key, {
      api_host: host,
      // GDPR: не трекаем до явного согласия (баннер куки → opt_in).
      opt_out_capturing_by_default: true,
      autocapture,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: !sessionRecording,
      // PII: маскируем ввод (контактная форма чата) в записях сессий.
      session_recording: { maskAllInputs: true },
      persistence: 'localStorage+cookie',
      loaded: (ph) => {
        // Если согласие уже было дано ранее — включаем capture сразу.
        try {
          if (window.localStorage.getItem(CONSENT_KEY) === 'accepted') {
            ph.opt_in_capturing();
          }
        } catch {
          /* localStorage недоступен — остаёмся opted out */
        }
      },
    });
    initialized = true;
  } catch {
    /* инициализация не должна ломать приложение */
  }
}

/**
 * Применяет решение пользователя по куки к PostHog.
 * accepted → начинаем capture; иначе → opt-out (и чистим, если уже шло).
 */
export function setAnalyticsConsent(granted: boolean): void {
  if (!initialized) return;
  try {
    if (granted) posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
  } catch {
    /* no-op */
  }
}

/**
 * Произвольное событие в PostHog. Безопасно: no-op без инициализации/согласия
 * (PostHog сам не шлёт, когда opted out). Не бросает.
 */
export function captureEvent(event: string, props?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* no-op */
  }
}
