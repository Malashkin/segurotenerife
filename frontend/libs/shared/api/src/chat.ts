/**
 * Клиент чат-консультанта: POST /api/chat.
 *
 * Отправляет вопрос пользователя и получает ответ агента + флаг `handoff`
 * (агент сам решает, когда пора передать менеджеру — нет вопросов / просят
 * человека). Если фича не настроена на сервере (нет ключа/корпуса), backend
 * отвечает 503 — здесь это трактуется как «ассистент недоступен» (возвращаем
 * null), и UI предлагает сразу связаться с менеджером. «Голый fetch» в
 * компонентах запрещён — только эта функция поверх apiRequest (api.md).
 */
import { apiRequest, ApiError } from './client';
import { getSessionId } from './events';

/** Ответ агента: текст + сигнал «передать менеджеру». */
export interface ChatReply {
  answer: string;
  handoff: boolean;
}

interface ChatAnswerDto {
  answer: string;
  handoff?: boolean;
}

/** Реплика истории диалога (для удержания контекста на бэкенде). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Спрашивает агента подбора.
 *
 * @param question - вопрос пользователя.
 * @param lang - язык ответа (en|es|uk|ru).
 * @param intent - интент карточки (med|dental|pet|...), уточняет ретривал.
 * @returns { answer, handoff }, либо null если ассистент недоступен (503).
 * @throws ApiError при прочих ошибках (например 500/сеть) — UI покажет фолбэк.
 */
export async function askQuestion(
  question: string,
  lang: string,
  intent?: string,
  history?: ChatTurn[],
): Promise<ChatReply | null> {
  try {
    const body: Record<string, unknown> = { question, lang };
    if (intent) body.intent = intent;
    if (history && history.length > 0) body.history = history;
    // session_id (если есть согласие на аналитику) группирует диалог в Langfuse.
    const sid = getSessionId();
    if (sid) body.session_id = sid;
    const data = await apiRequest<ChatAnswerDto>('/api/chat', { method: 'POST', body });
    return { answer: data.answer, handoff: data.handoff ?? false };
  } catch (e) {
    // 503 — фича выключена на сервере (нет ключа/корпуса): тихий фолбэк.
    if (e instanceof ApiError && e.status === 503) return null;
    throw e;
  }
}
