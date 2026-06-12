/**
 * Централизованный HTTP-клиент поверх fetch.
 *
 * По api.md SOUL «голый fetch» в компонентах запрещён — все запросы идут через
 * этот тонкий клиент, а в компонентах используются хуки TanStack Query.
 * Клиент задаёт базовый URL, JSON-заголовки, разбор ответа и единый формат ошибок.
 *
 * Намеренно без axios (code-weight.md): нативного fetch достаточно.
 */
import { getApiBaseUrl } from './config';

/**
 * Ошибка HTTP-запроса с сохранённым статусом и (по возможности) телом ответа.
 * Позволяет фичам отличать 400 (валидация) от 401/500 и показывать нужный текст.
 */
export class ApiError extends Error {
  /** HTTP-статус ответа (например 400, 401, 500). */
  readonly status: number;
  /** Разобранное тело ошибки, если сервер прислал JSON. */
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Опции одного запроса. */
export interface RequestOptions {
  /** HTTP-метод. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Тело запроса — будет сериализовано в JSON. */
  body?: unknown;
  /** Дополнительные заголовки (например Authorization для admin). */
  headers?: Record<string, string>;
  /** AbortSignal для отмены (TanStack Query передаёт его автоматически). */
  signal?: AbortSignal;
}

/**
 * Выполняет запрос к API и возвращает разобранный JSON-ответ типа T.
 *
 * Шаги:
 *   1. Склеиваем базовый URL и путь.
 *   2. Ставим Content-Type: application/json для запросов с телом.
 *   3. Бросаем ApiError, если статус не 2xx.
 *   4. Возвращаем JSON (или undefined для пустого тела, например 204).
 *
 * @param path - путь, начинающийся со слэша, например '/api/leads'
 * @param options - метод, тело, заголовки, signal
 * @returns промис с разобранным ответом типа T
 * @throws ApiError при не-2xx ответе
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const finalHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  // Собираем RequestInit без undefined-полей: при exactOptionalPropertyTypes
  // нельзя присваивать `undefined` опциональным свойствам body/signal.
  const init: RequestInit = { method, headers: finalHeaders };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (signal !== undefined) {
    init.signal = signal;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, init);

  // Пытаемся разобрать тело как JSON; пустой ответ (204) -> undefined.
  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${response.status}`, parsed);
  }

  return parsed as T;
}
