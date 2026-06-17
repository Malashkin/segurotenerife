/**
 * Клиент чат-консультанта (Волна C): POST /api/chat.
 *
 * Отправляет свободный вопрос пользователя и получает ответ, который backend
 * генерирует через Claude API по базе знаний ASISA. Если фича не настроена на
 * сервере (нет ключа/каталога), backend отвечает 503 — здесь это трактуется как
 * «ассистент недоступен» (возвращаем null), и UI молча откатывается к обычному
 * гайдовому чату/хендоффу. «Голый fetch» в компонентах запрещён — только эта
 * функция поверх apiRequest (api.md).
 */
import { apiRequest, ApiError } from './client';

/** Ответ ассистента. */
interface ChatAnswer {
  answer: string;
}

/**
 * Спрашивает ассистента по базе знаний ASISA.
 *
 * @param question - вопрос пользователя.
 * @param lang - язык ответа (en|es|uk|ru).
 * @param intent - интент текущего шага чата (med|dental|pet|...), уточняет ретривал.
 * @returns текст ответа, либо null если ассистент недоступен (503).
 * @throws ApiError при прочих ошибках (например 500/сеть) — UI покажет фолбэк.
 */
export async function askQuestion(
  question: string,
  lang: string,
  intent?: string,
): Promise<string | null> {
  try {
    const data = await apiRequest<ChatAnswer>('/api/chat', {
      method: 'POST',
      body: intent ? { question, lang, intent } : { question, lang },
    });
    return data.answer;
  } catch (e) {
    // 503 — фича выключена на сервере (нет ключа/каталога): тихий фолбэк.
    if (e instanceof ApiError && e.status === 503) return null;
    throw e;
  }
}
