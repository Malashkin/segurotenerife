/**
 * Экран входа в дашборд менеджера (auth gate).
 *
 * Показывается, пока не задан admin-токен. Менеджер вводит ADMIN_API_TOKEN,
 * который затем уходит в заголовок `Authorization: Bearer <token>` запроса
 * GET /api/leads и сохраняется в localStorage (см. useAdminToken).
 *
 * Доступность:
 *   - форма с <label for> для поля токена;
 *   - submit по Enter (нативная отправка формы);
 *   - токен — пароль (type="password"), скрыт от посторонних глаз;
 *   - кнопка отправки заблокирована, пока поле пустое.
 *
 * Интерфейс админки — англоязычный (EN-only), как разрешено в задаче.
 */
import { useState, type FormEvent } from 'react';
import { Button, cn } from '@shared/ui';

/** Пропсы экрана входа. */
export interface TokenGateProps {
  /** Колбэк сохранения введённого токена (поднимает его в App → useAdminToken). */
  onSubmit: (token: string) => void;
  /**
   * Сообщение об ошибке предыдущей попытки (например «Invalid token» после 401).
   * Если задано — показываем подсказку, что токен не подошёл.
   */
  errorMessage?: string;
}

/** Форма ввода admin-токена. */
export function TokenGate({ onSubmit, errorMessage }: TokenGateProps): JSX.Element {
  // Локальное значение поля до отправки (в localStorage попадёт только по submit).
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
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
            <label htmlFor="admin-token" className="text-sm font-medium text-slate-700">
              Admin API token
            </label>
            <input
              id="admin-token"
              name="admin-token"
              type="password"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste your ADMIN_API_TOKEN"
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? 'admin-token-error' : undefined}
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900',
                'placeholder:text-slate-400 transition-colors',
                'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                errorMessage &&
                  'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-400/40',
              )}
            />
            {errorMessage ? (
              <p id="admin-token-error" role="alert" className="text-sm text-red-600">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            Sign in
          </Button>

          <p className="text-center text-xs text-slate-400">
            The token is stored only in your browser and sent as a Bearer header.
          </p>
        </form>
      </section>
    </main>
  );
}
