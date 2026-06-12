/**
 * Хук сессии менеджера (Волна 3) — заменил статичный токен из localStorage.
 *
 * Access-токен живёт ТОЛЬКО в памяти (не в localStorage) — это требование auth.md
 * (защита от кражи через XSS). Сессия между перезагрузками держится на httpOnly
 * refresh-cookie: при монтировании хук тихо дергает /refresh и, если cookie ещё
 * жива, восстанавливает доступ без повторного ввода пароля.
 *
 * Состояния:
 *   - 'loading' — идёт первичная попытка восстановить сессию (silent refresh);
 *   - 'anon'    — не авторизован (показываем форму логина);
 *   - 'authed'  — есть валидный access-токен (показываем дашборд).
 */
import { useCallback, useEffect, useState } from 'react';
import { loginManager, logoutManager, refreshSession } from './managerAuth';

/** Статус авторизации менеджера. */
export type AuthStatus = 'loading' | 'anon' | 'authed';

/** Результат хука сессии менеджера. */
export interface UseManagerAuthResult {
  /** Текущий статус сессии. */
  status: AuthStatus;
  /** Access-токен (пустая строка, если не авторизован). */
  token: string;
  /** Логин по паролю. Пробрасывает ApiError(401) наружу — форма покажет ошибку. */
  login: (password: string) => Promise<void>;
  /** Выход: стирает refresh-cookie на сервере и сбрасывает локальную сессию. */
  logout: () => Promise<void>;
  /**
   * Продлить access-токен по refresh-cookie. Возвращает true при успехе.
   * Вызывается на 401 от защищённых запросов (access истёк, refresh ещё жив).
   * При неудаче переводит сессию в 'anon'.
   */
  refresh: () => Promise<boolean>;
}

/** Управляет сессией менеджера (login/refresh/logout) с access-токеном в памяти. */
export function useManagerAuth(): UseManagerAuthResult {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string>('');

  // Первичное восстановление сессии: тихий refresh по cookie при загрузке.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { accessToken } = await refreshSession();
        if (!cancelled) {
          setToken(accessToken);
          setStatus('authed');
        }
      } catch {
        if (!cancelled) setStatus('anon');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (password: string): Promise<void> => {
    // Ошибку (401) НЕ глотаем — её ловит форма логина и показывает сообщение.
    const { accessToken } = await loginManager(password);
    setToken(accessToken);
    setStatus('authed');
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutManager();
    } catch {
      // Даже если сервер недоступен — локально разлогиниваемся.
    }
    setToken('');
    setStatus('anon');
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const { accessToken } = await refreshSession();
      setToken(accessToken);
      setStatus('authed');
      return true;
    } catch {
      setToken('');
      setStatus('anon');
      return false;
    }
  }, []);

  return { status, token, login, logout, refresh };
}
