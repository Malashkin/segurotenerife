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

/** Путь приёма событий на backend. */
const EVENTS_PATH = '/api/events';

/** Ключ session_id в sessionStorage. */
const SESSION_ID_KEY = 'seguro_session_id';

/** Известные типы событий воронки (для автодополнения и единообразия). */
export type FunnelEvent =
  | 'chat_started'
  | 'step_completed'
  | 'chat_completed'
  | 'handoff_clicked'
  | 'question_asked';

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
  const sessionId = getSessionId();
  const body: Record<string, unknown> = { event };
  if (sessionId) body.session_id = sessionId;
  if (opts.lang) body.lang = opts.lang;
  if (opts.meta) body.meta = opts.meta;

  try {
    await apiRequest<void>(EVENTS_PATH, { method: 'POST', body });
  } catch {
    // Глотаем: событие потеряно, но пользователь ничего не замечает.
  }
}
