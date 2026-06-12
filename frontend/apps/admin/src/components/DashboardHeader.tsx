/**
 * Шапка дашборда менеджера: бренд-заголовок и кнопка выхода (sign out).
 *
 * Sign out очищает admin-токен (см. useAdminToken.clearToken) — после чего App
 * показывает экран входа TokenGate снова.
 *
 * Интерфейс англоязычный (EN-only).
 */
import { Button } from '@shared/ui';

/** Пропсы шапки дашборда. */
export interface DashboardHeaderProps {
  /** Выход: стирает токен и возвращает на экран входа. */
  onSignOut: () => void;
}

/** Верхняя панель дашборда. */
export function DashboardHeader({ onSignOut }: DashboardHeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Seguro Tenerife</h1>
          <p className="text-xs text-slate-500">Leads dashboard</p>
        </div>
        <Button type="button" variant="ghost" onClick={onSignOut} className="px-4 py-2 text-sm">
          Sign out
        </Button>
      </div>
    </header>
  );
}
