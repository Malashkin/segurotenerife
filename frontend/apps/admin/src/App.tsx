/**
 * Корневой компонент приложения менеджера — дашборд лидов.
 *
 * Одностраничный экран:
 *   1. Хранит admin-токен в localStorage (useAdminToken).
 *   2. Auth gate: без токена показывает форму входа (TokenGate).
 *   3. С токеном показывает шапку (DashboardHeader) + таблицу лидов (LeadsTable),
 *      которая сама обрабатывает состояния loading / empty / error.
 *
 * Серверные данные тянутся через TanStack Query (QueryProvider уже обёрнут в
 * main.tsx) хуком useLeads(token) из @shared/api. Интерфейс англоязычный (EN-only),
 * как разрешено в задаче.
 */
import { useAdminToken } from './lib/useAdminToken';
import { TokenGate } from './components/TokenGate';
import { DashboardHeader } from './components/DashboardHeader';
import { LeadsTable } from './components/LeadsTable';

/** Корень дашборда: auth gate → таблица лидов. */
export function App(): JSX.Element {
  const { token, setToken, clearToken } = useAdminToken();

  // Нет токена → экран входа. Сам токен (если введён неверный) отбракует backend
  // на этапе запроса; ошибку авторизации показывает LeadsTable.
  if (token.length === 0) {
    return <TokenGate onSubmit={setToken} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader onSignOut={clearToken} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h2 className="sr-only">Leads</h2>
        <LeadsTable token={token} />
      </main>
    </div>
  );
}
