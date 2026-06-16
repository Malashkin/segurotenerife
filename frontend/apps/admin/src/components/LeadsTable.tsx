/**
 * Таблица лидов дашборда менеджера.
 *
 * Данные берутся из useLeads(token) (@entities → GET /api/leads, Bearer-токен).
 * Компонент сам отрисовывает все состояния запроса:
 *   - loading  — спиннер «Loading leads…»;
 *   - error    — карточка ошибки с кнопкой Retry (и спец-текст для 401);
 *   - empty    — «No leads yet», когда массив пуст;
 *   - success  — доступная HTML-таблица лидов.
 *
 * Авторизация (Волна 3): на 401 (access-токен истёк) компонент один раз дергает
 * onUnauthorized() — попытку продлить сессию по refresh-cookie. При успехе токен
 * обновится в App и запрос повторится автоматически; иначе App уйдёт на логин.
 *
 * Колонки (по контракту LeadRow): created_at, name, contact, messenger, lang,
 * goal, city, urgency, status.
 *
 * Доступность: семантическая <table> с <caption> (sr-only), <th scope="col">
 * для шапки и <th scope="row"> для имени; даты — через <time dateTime>.
 * Интерфейс англоязычный (EN-only).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@shared/api';
import { useLeads, type LeadRow } from '@entities';
import { cn } from '@shared/ui';

/** Пропсы таблицы лидов. */
export interface LeadsTableProps {
  /** Access-токен менеджера (запрос идёт только при непустом токене). */
  token: string;
  /**
   * Попытка продлить сессию при 401 (access истёк). Возвращает true при успехе.
   * Вызывается не более одного раза на каждый токен, чтобы не зациклиться.
   */
  onUnauthorized: () => Promise<boolean>;
}

/** Форматтер даты создания лида (локаль браузера, дата + время). */
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Безопасно форматирует ISO-дату; на нераспознаваемой строке отдаёт исходник. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMATTER.format(date);
}

/** Заголовки колонок (порядок = порядок ячеек в строке). */
const COLUMNS = [
  'Created',
  'Name',
  'Contact',
  'Messenger',
  'Lang',
  'Goal',
  'City',
  'Urgency',
  'Status',
] as const;

/** Подбирает цвет статус-бейджа по строке статуса (мягкая эвристика). */
function statusClasses(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('new')) return 'bg-blue-100 text-blue-700';
  if (s.includes('done') || s.includes('closed') || s.includes('won')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (s.includes('progress') || s.includes('contact') || s.includes('open')) {
    return 'bg-amber-100 text-amber-700';
  }
  if (s.includes('lost') || s.includes('reject') || s.includes('spam')) {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-slate-100 text-slate-600';
}

/** Отображает значение ячейки или прочерк для null/пустых строк. */
function CellValue({ value }: { value: string | null }): JSX.Element {
  if (value === null || value.trim().length === 0) {
    return <span className="text-slate-300">—</span>;
  }
  return <>{value}</>;
}

/** Статус-бейдж лида (единый вид в таблице и в мобильных карточках). */
function StatusBadge({ status }: { status: string }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
        statusClasses(status),
      )}
    >
      {status}
    </span>
  );
}

/** Обёртка-контейнер для любого состояния (центрированная карточка). */
function StateBox({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      {children}
    </div>
  );
}

/** Таблица лидов со всеми состояниями запроса. */
export function LeadsTable({ token, onUnauthorized }: LeadsTableProps): JSX.Element {
  const { data, isLoading, isError, error, refetch, isFetching } = useLeads(token);

  // Фильтр по статусу ('all' = все). Список статусов — из самих данных, чтобы
  // не зашивать значения и не расходиться с backend. Хуки до ранних return.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const statuses = useMemo(
    () => Array.from(new Set((data ?? []).map((l) => l.status))).sort(),
    [data],
  );

  // На 401 (access истёк) ровно один раз для данного токена пробуем продлить
  // сессию по refresh-cookie. Успех → App обновит токен → запрос повторится сам.
  const refreshedForToken = useRef<string | null>(null);
  useEffect(() => {
    const isAuthErr = isError && error instanceof ApiError && error.status === 401;
    if (!isAuthErr) return;
    if (refreshedForToken.current === token) return;
    refreshedForToken.current = token;
    void onUnauthorized();
  }, [isError, error, token, onUnauthorized]);

  // --- Загрузка ---
  if (isLoading) {
    return (
      <StateBox>
        <span
          role="status"
          aria-label="Loading leads"
          className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-brand-tint border-t-brand"
        />
        <p className="text-sm text-slate-500">Loading leads…</p>
      </StateBox>
    );
  }

  // --- Ошибка ---
  if (isError) {
    // Спец-текст для проблем авторизации (неверный/просроченный токен).
    const isAuth = error instanceof ApiError && (error.status === 401 || error.status === 403);
    return (
      <StateBox>
        <p className="text-base font-semibold text-red-600">
          {isAuth ? 'Session expired' : 'Could not load leads'}
        </p>
        <p className="max-w-md text-sm text-slate-500">
          {isAuth
            ? 'Your session expired. Refreshing… if this keeps happening, sign out and sign in again.'
            : 'The server returned an error. Check that the API is running and try again.'}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Retry
        </button>
      </StateBox>
    );
  }

  const leads: LeadRow[] = data ?? [];

  // --- Пусто ---
  if (leads.length === 0) {
    return (
      <StateBox>
        <p className="text-base font-semibold text-slate-700">No leads yet</p>
        <p className="max-w-md text-sm text-slate-500">
          New leads submitted from the website will appear here automatically.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Refresh
        </button>
      </StateBox>
    );
  }

  // --- Успех: фильтр + таблица (десктоп) / карточки (мобайл) ---
  const filteredLeads =
    statusFilter === 'all' ? leads : leads.filter((lead) => lead.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
      {/* Фильтр по статусу: чипсы «All» + по статусу из данных. На мобиле скроллятся
          по горизонтали, не ломая раскладку. */}
      {statuses.length > 1 && (
        <div
          role="group"
          aria-label="Filter leads by status"
          className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        >
          <FilterChip
            label="All"
            count={leads.length}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          {statuses.map((s) => (
            <FilterChip
              key={s}
              label={s}
              count={leads.filter((lead) => lead.status === s).length}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Полоса прогресса при фоновом рефетче (refetch/refresh), чтобы было видно обновление. */}
        {isFetching ? (
          <div
            role="status"
            aria-label="Refreshing leads"
            className="h-1 w-full animate-pulse bg-brand/40"
          />
        ) : null}

        {filteredLeads.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No leads with status “{statusFilter}”.
          </p>
        ) : (
          <>
            {/* Десктоп/планшет: классическая таблица с горизонтальным скроллом. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Leads submitted from the website</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {COLUMNS.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-100 align-top transition-colors last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        <time dateTime={lead.created_at}>{formatCreatedAt(lead.created_at)}</time>
                      </td>
                      <th
                        scope="row"
                        className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-900"
                      >
                        <CellValue value={lead.name} />
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <CellValue value={lead.contact} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{lead.messenger}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <CellValue value={lead.comm_lang ?? lead.ui_lang} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <CellValue value={lead.goal} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <CellValue value={lead.city} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <CellValue value={lead.urgency} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Мобайл: карточки вместо горизонтального скролла таблицы. */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredLeads.map((lead) => (
                <li key={lead.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        <CellValue value={lead.name} />
                      </p>
                      <p className="truncate text-sm text-slate-600">
                        <CellValue value={lead.contact} />
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <LeadField label="Messenger" value={lead.messenger} />
                    <LeadField label="Lang" value={lead.comm_lang ?? lead.ui_lang} />
                    <LeadField label="Goal" value={lead.goal} />
                    <LeadField label="City" value={lead.city} />
                    <LeadField label="Urgency" value={lead.urgency} />
                  </dl>
                  <time dateTime={lead.created_at} className="text-xs text-slate-400">
                    {formatCreatedAt(lead.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Чип-фильтр статуса с счётчиком. */
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand-dark',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs font-semibold tabular-nums',
          active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500',
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Поле «лейбл + значение» в мобильной карточке лида. */
function LeadField({ label, value }: { label: string; value: string | null }): JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-700">
        <CellValue value={value} />
      </dd>
    </div>
  );
}
