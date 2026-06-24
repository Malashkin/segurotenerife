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

/** Ответ агента: текст + сигнал «передать менеджеру» + тема (вид страховки). */
export interface ChatReply {
  answer: string;
  handoff: boolean;
  topic?: string;
}

interface ChatAnswerDto {
  answer: string;
  handoff?: boolean;
  topic?: string | null;
}

/** Реплика истории диалога (для удержания контекста на бэкенде). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Параметры передачи лида менеджеру (имя обязательно). */
export interface HandoffInput {
  name: string;
  question?: string;
  /** Вид страховки (интент: med|dental|travel…). */
  topic?: string;
  /** Выбранный мессенджер (WhatsApp|Telegram|Viber). */
  messenger?: string;
  /** UUID лида, сгенерированный клиентом (для Telegram ?start=<lead_id>). */
  leadId?: string;
  lang: string;
}

/**
 * Сохраняет лид на backend и пересылает менеджеру в Telegram. Не бросает: при
 * любой ошибке/недоступности возвращает false (фронт всё равно откроет чат
 * мессенджера). Имя обязательно — карточка не даёт нажать без него.
 */
export async function forwardHandoff(input: HandoffInput): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { name: input.name, lang: input.lang };
    if (input.question) body.question = input.question;
    if (input.topic) body.topic = input.topic;
    if (input.messenger) body.messenger = input.messenger;
    if (input.leadId) body.lead_id = input.leadId;
    const data = await apiRequest<{ ok?: boolean }>('/api/handoff', { method: 'POST', body });
    return data.ok === true;
  } catch {
    return false;
  }
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
    const reply: ChatReply = { answer: data.answer, handoff: data.handoff ?? false };
    if (data.topic) reply.topic = data.topic;
    return reply;
  } catch (e) {
    // 503 — фича выключена на сервере (нет ключа/корпуса): тихий фолбэк.
    if (e instanceof ApiError && e.status === 503) return null;
    throw e;
  }
}
