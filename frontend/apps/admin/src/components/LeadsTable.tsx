/**
 * Таблица лидов дашборда менеджера.
 *
 * Данные берутся из useLeads(token) (@shared/api → GET /api/leads, Bearer-токен).
 * Компонент сам отрисовывает все состояния запроса:
 *   - loading  — спиннер «Loading leads…»;
 *   - error    — карточка ошибки с кнопкой Retry (и спец-текст для 401);
 *   - empty    — «No leads yet», когда массив пуст;
 *   - success  — доступная HTML-таблица лидов.
 *
 * Колонки (по контракту LeadRow): created_at, name, contact, messenger, lang,
 * goal, city, urgency, status.
 *
 * Доступность: семантическая <table> с <caption> (sr-only), <th scope="col">
 * для шапки и <th scope="row"> для имени; даты — через <time dateTime>.
 * Интерфейс англоязычный (EN-only).
 */
import { ApiError, useLeads, type LeadRow } from '@shared/api';
import { cn } from '@shared/ui';

/** Пропсы таблицы лидов. */
export interface LeadsTableProps {
  /** Admin Bearer-токен (запрос идёт только при непустом токене). */
  token: string;
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

/** Обёртка-контейнер для любого состояния (центрированная карточка). */
function StateBox({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      {children}
    </div>
  );
}

/** Таблица лидов со всеми состояниями запроса. */
export function LeadsTable({ token }: LeadsTableProps): JSX.Element {
  const { data, isLoading, isError, error, refetch, isFetching } = useLeads(token);

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
          {isAuth ? 'Access denied' : 'Could not load leads'}
        </p>
        <p className="max-w-md text-sm text-slate-500">
          {isAuth
            ? 'The admin token was rejected by the server. Sign out and enter a valid token.'
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

  // --- Успех: таблица ---
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Полоса прогресса при фоновом рефетче (refetch/refresh), чтобы было видно обновление. */}
      {isFetching ? (
        <div
          role="status"
          aria-label="Refreshing leads"
          className="h-1 w-full animate-pulse bg-brand/40"
        />
      ) : null}
      <div className="overflow-x-auto">
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
            {leads.map((lead) => (
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
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                      statusClasses(lead.status),
                    )}
                  >
                    {lead.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
