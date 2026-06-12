/**
 * Хук хранения admin-токена (ADMIN_API_TOKEN) в localStorage.
 *
 * Дашборд менеджера обращается к GET /api/leads с заголовком
 * `Authorization: Bearer <token>`. Сам токен вводит менеджер один раз и он
 * сохраняется в браузере, чтобы не вводить его на каждой перезагрузке.
 *
 * Возвращает:
 *   - token        — текущий токен (пустая строка, если не задан);
 *   - setToken     — сохранить токен (пишет в localStorage + state);
 *   - clearToken   — стереть токен (logout — удаляет из localStorage + state).
 *
 * Безопасность: это лишь удобство хранения на клиенте. Токен — секрет менеджера;
 * на проде дашборд должен раздаваться по защищённому адресу. Доступ к данным в
 * любом случае контролирует backend (он проверяет Bearer-токен).
 */
import { useCallback, useState } from 'react';

/** Ключ в localStorage, под которым хранится admin-токен. */
export const ADMIN_TOKEN_STORAGE_KEY = 'seguro_admin_token';

/** Безопасно читает токен из localStorage (SSR/приватный режим → ''). */
function readStoredToken(): string {
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    // localStorage может быть недоступен (приватный режим, отключённые куки).
    return '';
  }
}

/** Результат хука управления admin-токеном. */
export interface UseAdminTokenResult {
  /** Текущий токен (пустая строка, если не авторизован). */
  token: string;
  /** Сохранить токен (в state и localStorage). */
  setToken: (next: string) => void;
  /** Стереть токен (logout). */
  clearToken: () => void;
}

/**
 * Управляет admin-токеном с персистом в localStorage.
 *
 * Состояние инициализируется лениво из localStorage, поэтому при перезагрузке
 * страницы менеджер остаётся «залогинен».
 */
export function useAdminToken(): UseAdminTokenResult {
  const [token, setTokenState] = useState<string>(() => readStoredToken());

  const setToken = useCallback((next: string): void => {
    const trimmed = next.trim();
    setTokenState(trimmed);
    try {
      if (trimmed.length > 0) {
        window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Игнорируем ошибки записи (приватный режим) — токен всё равно живёт в state.
    }
  }, []);

  const clearToken = useCallback((): void => {
    setTokenState('');
    try {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // no-op
    }
  }, []);

  return { token, setToken, clearToken };
}
