/**
 * Экран входа менеджера по паролю (auth gate, Волна 3).
 *
 * Заменил ввод статичного токена (TokenGate): менеджер вводит пароль, дашборд
 * шлёт POST /api/auth/login и получает access-токен (в память) + refresh-cookie.
 * При неверном пароле backend отвечает 401 — показываем сообщение об ошибке.
 *
 * Доступность: форма с <label for>, submit по Enter, поле type="password",
 * кнопка заблокирована, пока поле пустое или идёт запрос. Интерфейс EN-only.
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '@shared/api';
import { Button, cn } from '@shared/ui';

/** Пропсы экрана входа. */
export interface LoginGateProps {
  /** Логин по паролю (useManagerAuth.login). Реджектит ApiError(401) при ошибке. */
  onSubmit: (password: string) => Promise<void>;
}

/** Форма входа менеджера по паролю. */
export function LoginGate({ onSubmit }: LoginGateProps): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      // Успех: App переключится на дашборд; локально ничего не делаем.
    } catch (e) {
      // 401 — неверный пароль; прочее — проблема сети/сервера.
      const isAuth = e instanceof ApiError && e.status === 401;
      setError(
        isAuth
          ? 'Incorrect password. Please try again.'
          : 'Could not sign in. Check your connection and try again.',
      );
      setValue('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section
        aria-labelledby="admin-login-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <header className="mb-6 text-center">
          <h1
            id="admin-login-title"
            className="text-2xl font-extrabold tracking-tight text-slate-900"
          >
            Seguro Tenerife
          </h1>
          <p className="mt-1 text-sm text-slate-500">Leads dashboard — manager sign in</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manager-password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="manager-password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter your password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'manager-password-error' : undefined}
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900',
                'placeholder:text-slate-400 transition-colors',
                'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                error &&
                  'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-400/40',
              )}
            />
            {error ? (
              <p id="manager-password-error" role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-center text-xs text-slate-400">
            Your session is kept in a secure, http-only cookie.
          </p>
        </form>
      </section>
    </main>
  );
}
