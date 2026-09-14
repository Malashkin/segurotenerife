/**
 * Клиент лёгкой аналитики воронки (POST /api/events).
 *
 * Фронтенд шлёт сюда события чата (chat_started / step_completed /
 * chat_completed / handoff_clicked), чтобы backend мог измерять ключевую метрику
 * гипотезы — handoff rate (завершившие чат → перешедшие к менеджеру).
 *
 * Принципы:
 *  - Fire-and-forget: аналитика НИКОГДА не влияет на UX. Любая ошибка сети/сервера
 *    проглатывается (только debug-лог), промис не реджектится.
 *  - «Голый fetch» в компонентах запрещён (api.md) — события шлются через эту
 *    функцию поверх apiRequest, а компоненты вызывают её как обычную утилиту.
 *  - session_id связывает события одного посетителя в воронку; хранится в
 *    sessionStorage (живёт в пределах вкладки/сессии, без долгого трекинга — privacy.md).
 */
import { apiRequest } from './client';
import { captureEvent } from './posthog';

/** Путь приёма событий на backend. */
const EVENTS_PATH = '/api/events';

/** Ключ session_id в sessionStorage. */
const SESSION_ID_KEY = 'seguro_session_id';

/** Ключ согласия на куки/аналитику (localStorage). */
const CONSENT_KEY = 'seguro_cookie_consent';

/**
 * Разрешена ли аналитика. Аналитика воронки — НЕОБЯЗАТЕЛЬНАЯ, поэтому включается
 * только при явном согласии ('accepted'). До согласия и при отказе ('necessary')
 * аналитика не работает (но сайт функционирует полностью — это требование GDPR).
 */
function analyticsAllowed(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/** Решение по кукам ещё не принято — баннер висит, выбора не было. */
function consentUndecided(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * Очередь событий, случившихся ДО решения по кукам.
 *
 * Зачем: `chat_started` шлётся один раз при монтировании виджета. Посетитель,
 * который согласился на куки уже после этого, терял событие навсегда — молча.
 * Так заход 2026-09-02 с двумя настоящими вопросами не попал ни в один
 * недельный отчёт, а воронка считала диалоги по событию, которого не было.
 *
 * Очередь живёт ТОЛЬКО в памяти вкладки и только пока выбор не сделан. Отказ
 * («necessary») её выбрасывает — ничего не отправляется и никуда не пишется.
 */
interface PendingEvent {
  event: FunnelEvent;
  opts: TrackOptions;
  at: number;
}

/** Больше этого не копим: защита от бесконечного роста на длинной странице. */
const PENDING_LIMIT = 20;

let pending: PendingEvent[] = [];

/**
 * Применяет решение по кукам к накопленной очереди: согласие → досылаем,
 * отказ → выбрасываем. Вызывается из баннера согласия.
 *
 * Досланное событие уходит с задержкой, поэтому в `meta.queued_for_ms`
 * проставляется, сколько оно пролежало: у backend время пишется на приёме
 * (`created_at DEFAULT now()`), и без этого отметки поехали бы.
 */
export function applyConsentToPendingEvents(granted: boolean): void {
  const queued = pending;
  pending = [];
  if (!granted) return;
  const now = Date.now();
  for (const item of queued) {
    void trackEvent(item.event, {
      ...item.opts,
      meta: { ...(item.opts.meta ?? {}), queued_for_ms: now - item.at },
    });
  }
}

/** Известные типы событий воронки (для автодополнения и единообразия). */
export type FunnelEvent =
  | 'chat_started'
  | 'step_completed'
  | 'chat_completed'
  | 'handoff_clicked'
  | 'question_asked'
  // Получен ответ агента (для воронки вопрос→ответ + сигнал handoff).
  | 'answer_received'
  // Агент недоступен/ошибка → показали фолбэк (метрика качества ответов).
  | 'agent_fallback'
  // Лид подтверждён бэкендом (POST /api/handoff ok) — конверсия в лид.
  | 'lead_submitted'
  // Клиент скопировал заготовку сообщения для Telegram.
  | 'tg_message_copied'
  // Явная смена языка интерфейса.
  | 'lang_switched';

/** Необязательный контекст события. */
export interface TrackOptions {
  /** Язык интерфейса на момент события (en|es|uk|ru). */
  lang?: string;
  /** Произвольный контекст (например выбранный шаг/мессенджер). */
  meta?: Record<string, unknown>;
}

/**
 * Возвращает идентификатор сессии посетителя, создавая его при первом обращении.
 * Безопасен вне браузера / в приватном режиме (тогда отдаёт пустую строку).
 */
export function getSessionId(): string {
  // Без согласия не создаём и не храним идентификатор сессии для аналитики.
  if (!analyticsAllowed()) return '';
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    // crypto.randomUUID есть во всех целевых браузерах; на всякий случай — фолбэк.
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    // sessionStorage недоступен — события уйдут без session_id, это не критично.
    return '';
  }
}

/**
 * Отправляет событие воронки. Никогда не бросает — аналитика не должна ломать UX.
 *
 * @param event - тип события (chat_started / step_completed / ...).
 * @param opts  - язык и произвольный meta-контекст.
 */
export async function trackEvent(event: FunnelEvent, opts: TrackOptions = {}): Promise<void> {
  // Аналитика только при согласии — иначе событие не отправляем.
  if (!analyticsAllowed()) {
    // Решение ещё не принято — придержим до ответа на баннер, а не потеряем.
    if (consentUndecided() && pending.length < PENDING_LIMIT) {
      pending.push({ event, opts, at: Date.now() });
    }
    return;
  }
  const sessionId = getSessionId();
  const body: Record<string, unknown> = { event };
  if (sessionId) body.session_id = sessionId;
  if (opts.lang) body.lang = opts.lang;
  if (opts.meta) body.meta = opts.meta;

  // Фан-аут в PostHog: тот же funnel-ивент с контекстом (no-op без ключа/согласия).
  captureEvent(event, { lang: opts.lang, ...(opts.meta ?? {}) });

  try {
    await apiRequest<void>(EVENTS_PATH, { method: 'POST', body });
  } catch {
    // Глотаем: событие потеряно, но пользователь ничего не замечает.
  }
}
