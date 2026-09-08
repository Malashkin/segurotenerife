/**
 * Интеграция PostHog (продуктовая аналитика) — обёртка для публичного сайта.
 *
 * Принципы:
 *  - GDPR: capture ВЫКЛЮЧЕН по умолчанию (`opt_out_capturing_by_default`), пока
 *    пользователь не дал согласие на куки (баннер CookieConsent → setAnalyticsConsent).
 *  - Ключ — ТОЛЬКО из env (`PUBLIC_POSTHOG_KEY` для Astro / `VITE_POSTHOG_KEY`),
 *    публичный проектный ключ `phc_…` (он write-only и безопасен в клиенте).
 *    Персональные ключи `phx_…` сюда не годятся и в клиент НЕ попадают.
 *  - Никогда не бросает и не ломает UX: всё под `typeof window` и try/catch,
 *    без ключа/вне браузера — тихий no-op (dev/e2e/SSR работают как обычно).
 *  - PII: на форме чата есть контакт/имя → в session recording маскируем все инпуты.
 *  - Внутренние поверхности (админка) в аналитику НЕ попадают — см.
 *    `isInternalSurface()`: там трекинг не инициализируется вовсе.
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
  /** Запись сессий (по умолчанию true; выключать там, где на экране PII). */
  sessionRecording?: boolean;
}

/**
 * Внутренняя (не публичная) поверхность — дашборд менеджера: поддомен
 * `admin.*` или путь `/admin…`.
 *
 * Зачем: заходы менеджера в админку — это наш собственный трафик. В отчётах он
 * смешивался с посетительским и завышал события/сессии/просмотры (фильтр по
 * событию `admin_opened` в `scripts/analytics/report.py` убирал только его, но
 * не `$pageview`/`$pageleave` админки). Поэтому трекинг здесь не включается
 * вовсе — это дешевле и надёжнее, чем чистить данные постфактум.
 *
 * Проверка по location, а не по флагу сборки: гарантия держится даже если
 * обёртку позовут из другого приложения или админку смонтируют по пути.
 */
export function isInternalSurface(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const { hostname, pathname } = window.location;
    return /^admin\./i.test(hostname) || /^\/admin(\/|$)/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Определяет канал трафика по referrer/UTM. `ai` — приход из AI-движков (GEO:
 * ChatGPT, Perplexity, Gemini, Claude, Copilot…), отдельно от обычного поиска.
 */
export function detectTrafficChannel(): {
  traffic_channel: string;
  ai_engine?: string;
  channel_source?: string;
} {
  try {
    const ref = (document.referrer || '').toLowerCase();
    const host = ref ? new URL(ref).hostname.replace(/^www\./, '') : '';
    const utm = (new URLSearchParams(window.location.search).get('utm_source') || '').toLowerCase();

    // AI-движки по домену реферера.
    const AI: Record<string, string> = {
      'chatgpt.com': 'ChatGPT',
      'chat.openai.com': 'ChatGPT',
      'openai.com': 'ChatGPT',
      'perplexity.ai': 'Perplexity',
      'gemini.google.com': 'Gemini',
      'bard.google.com': 'Gemini',
      'claude.ai': 'Claude',
      'copilot.microsoft.com': 'Copilot',
      'you.com': 'You.com',
      'poe.com': 'Poe',
      'phind.com': 'Phind',
      'meta.ai': 'Meta AI',
    };
    const AI_UTM: Record<string, string> = {
      perplexity: 'Perplexity',
      chatgpt: 'ChatGPT',
      openai: 'ChatGPT',
      gemini: 'Gemini',
      copilot: 'Copilot',
    };

    for (const [d, engine] of Object.entries(AI)) {
      if (host === d || host.endsWith('.' + d)) {
        return { traffic_channel: 'ai', ai_engine: engine, channel_source: host };
      }
    }
    const utmEngine = AI_UTM[utm];
    if (utmEngine) return { traffic_channel: 'ai', ai_engine: utmEngine, channel_source: `utm:${utm}` };
    if (host === 'bing.com' && /chat|copilot/.test(ref)) {
      return { traffic_channel: 'ai', ai_engine: 'Copilot', channel_source: host };
    }
    if (/(^|\.)(google|bing|yandex|duckduckgo|yahoo|baidu|ecosia)\./.test(host)) {
      return { traffic_channel: 'search', channel_source: host };
    }
    if (/(^|\.)(facebook|instagram|t\.me|telegram|vk\.com|x\.com|twitter|linkedin|youtube|tiktok|reddit)/.test(host)) {
      return { traffic_channel: 'social', channel_source: host };
    }
    if (!host) return { traffic_channel: 'direct' };
    return { traffic_channel: 'referral', channel_source: host };
  } catch {
    return { traffic_channel: 'unknown' };
  }
}

/** First-touch канал за сессию (внутренняя навигация не пересчитывает). */
function resolveTrafficChannel(): ReturnType<typeof detectTrafficChannel> {
  try {
    const cached = window.sessionStorage.getItem('seguro_traffic');
    if (cached) return JSON.parse(cached);
    const tc = detectTrafficChannel();
    window.sessionStorage.setItem('seguro_traffic', JSON.stringify(tc));
    return tc;
  } catch {
    return detectTrafficChannel();
  }
}

/**
 * Инициализирует PostHog. Безопасна: без ключа/вне браузера/на внутренней
 * поверхности (админка) — no-op.
 * Capture не начнётся, пока не вызовут setAnalyticsConsent(true) (или согласие
 * уже сохранено) — это требование GDPR.
 */
export function initAnalytics(opts: InitAnalyticsOptions = {}): void {
  if (initialized || typeof window === 'undefined') return;
  if (isInternalSurface()) return; // админка вне продуктовой аналитики
  const key = env('POSTHOG_KEY');
  if (!key) return; // ключ не задан — аналитика выключена, без ошибок

  const host = env('POSTHOG_HOST') ?? 'https://eu.i.posthog.com';
  const autocapture = opts.autocapture ?? true;
  const sessionRecording = opts.sessionRecording ?? true;

  try {
    posthog.init(key, {
      api_host: host,
      // Когда api_host — наш прокси (/ph), ui_host указывает PostHog, где живёт
      // дашборд (для тулбара/ссылок). EU-облако.
      ui_host: 'https://eu.posthog.com',
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
        // Канал трафика (ai/search/social/direct/referral) — super-property на
        // ВСЕ события, чтобы в PostHog различать GEO-трафик из AI-движков.
        try {
          ph.register(resolveTrafficChannel());
        } catch {
          /* не критично */
        }
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
