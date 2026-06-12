/**
 * Корневой компонент приложения менеджера — дашборд лидов.
 *
 * Одностраничный экран с сессией на JWT (Волна 3, заменил статичный токен):
 *   1. useManagerAuth держит access-токен в памяти и тихо восстанавливает сессию
 *      по httpOnly refresh-cookie при загрузке.
 *   2. Auth gate: 'loading' → сплэш; 'anon' → форма входа по паролю (LoginGate);
 *      'authed' → шапка (DashboardHeader) + таблица лидов (LeadsTable).
 *   3. На 401 от списка лидов (access истёк) LeadsTable дергает refresh — при
 *      успехе токен обновляется и запрос повторяется, иначе уходим на логин.
 *
 * Серверные данные — через TanStack Query (QueryProvider обёрнут в main.tsx).
 * Интерфейс англоязычный (EN-only), как разрешено в задаче.
 */
import { useManagerAuth } from './lib/useManagerAuth';
import { LoginGate } from './components/LoginGate';
import { DashboardHeader } from './components/DashboardHeader';
import { LeadsTable } from './components/LeadsTable';

/** Корень дашборда: auth gate (loading/anon/authed) → таблица лидов. */
export function App(): JSX.Element {
  const { status, token, login, logout, refresh } = useManagerAuth();

  // Первичное восстановление сессии по refresh-cookie — короткий сплэш.
  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-brand-tint border-t-brand"
        />
      </main>
    );
  }

  // Не авторизован → экран входа по паролю.
  if (status !== 'authed') {
    return <LoginGate onSubmit={login} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader onSignOut={() => void logout()} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h2 className="sr-only">Leads</h2>
        <LeadsTable token={token} onUnauthorized={refresh} />
      </main>
    </div>
  );
}
