/**
 * API-слой аутентификации менеджера (Волна 3).
 *
 * Дашборд логинится по паролю и получает короткоживущий access-токен (в памяти),
 * а долгоживущий refresh-токен backend кладёт в httpOnly-cookie. Поэтому ВСЕ
 * auth-запросы идут с `credentials: 'include'` — иначе браузер не примет/не пошлёт
 * cookie. «Голый fetch» не используем (api.md) — всё через apiRequest из shared/api.
 *
 * Контракт backend (routes/auth.rs):
 *   POST /api/auth/login   { password } -> { accessToken, expiresIn } + Set-Cookie
 *   POST /api/auth/refresh (cookie)      -> { accessToken, expiresIn }
 *   POST /api/auth/logout                -> 204 + очистка cookie
 */
import { apiRequest } from '@shared/api';

/** Путь группы auth-эндпоинтов. */
const AUTH_PATH = '/api/auth';

/** Ответ login/refresh: access-токен и его срок жизни (секунды). */
export interface AuthTokens {
  /** Access-JWT для заголовка Authorization: Bearer. Хранится только в памяти. */
  accessToken: string;
  /** Срок жизни access-токена в секундах (для упреждающего refresh). */
  expiresIn: number;
}

/**
 * Логин менеджера по паролю. При успехе backend выставит refresh-cookie.
 * @throws ApiError(401) при неверном пароле.
 */
export function loginManager(password: string): Promise<AuthTokens> {
  return apiRequest<AuthTokens>(`${AUTH_PATH}/login`, {
    method: 'POST',
    body: { password },
    credentials: 'include',
  });
}

/**
 * Тихое продление сессии по refresh-cookie. Используется при загрузке дашборда
 * (восстановить сессию после перезагрузки) и при 401 (access истёк).
 * @throws ApiError(401) если refresh-cookie отсутствует/просрочена.
 */
export function refreshSession(): Promise<AuthTokens> {
  return apiRequest<AuthTokens>(`${AUTH_PATH}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
}

/** Выход: backend стирает refresh-cookie. Access истечёт сам (минуты). */
export function logoutManager(): Promise<void> {
  return apiRequest<void>(`${AUTH_PATH}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
