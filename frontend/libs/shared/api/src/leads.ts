/**
 * API-слой и хуки TanStack Query для сущности «лид».
 *
 * Содержит:
 *   - createLead(payload)      — POST /api/leads (с zod-валидацией перед отправкой);
 *   - listLeads(token)         — GET  /api/leads (Bearer admin token);
 *   - leadKeys                 — фабрика query-ключей;
 *   - useCreateLead()          — мутация создания лида (web, форма/чат);
 *   - useLeads(token)          — запрос списка лидов (admin-дашборд).
 *
 * По api.md SOUL «голый fetch» в компонентах запрещён: компоненты используют
 * только эти хуки, а сетевой слой инкапсулирован в apiRequest (client.ts).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from './client';
import { validateLead } from './schema';
import type {
  CreateLeadRequest,
  CreateLeadResponse,
  LeadRow,
  ListLeadsResponse,
} from './types';

/** Путь к ресурсу лидов на backend. */
const LEADS_PATH = '/api/leads';

/**
 * Фабрика query-ключей для лидов (рекомендация TanStack Query — держать ключи в одном месте).
 *   leadKeys.all          -> ['leads']
 *   leadKeys.list(token)  -> ['leads', 'list', token]  (токен включён в ключ,
 *                            чтобы смена токена инвалидировала кэш списка)
 */
export const leadKeys = {
  all: ['leads'] as const,
  list: (token: string) => [...leadKeys.all, 'list', token] as const,
} satisfies Record<string, unknown>;

/**
 * Создаёт лид: валидирует payload zod-схемой и шлёт POST /api/leads.
 *
 * @param payload - данные лида (CreateLeadRequest). Перед отправкой валидируются:
 *                  при невалидных данных бросается ZodError (до похода в сеть).
 * @param signal  - опциональный AbortSignal (передаётся мутацией автоматически).
 * @returns промис с { id } созданного лида.
 * @throws ZodError при невалидном payload, ApiError при не-2xx ответе (например 400).
 */
export async function createLead(
  payload: CreateLeadRequest,
  signal?: AbortSignal,
): Promise<CreateLeadResponse> {
  // 1. Валидация на клиенте (consent === true, непустые name/contact, корректный messenger).
  const valid = validateLead(payload);
  // 2. Отправка. apiRequest сам выставит Content-Type и разберёт ответ/ошибку.
  const options: Parameters<typeof apiRequest>[1] = { method: 'POST', body: valid };
  if (signal !== undefined) {
    options.signal = signal;
  }
  return apiRequest<CreateLeadResponse>(LEADS_PATH, options);
}

/**
 * Получает список лидов для admin-дашборда: GET /api/leads с Bearer-токеном.
 *
 * @param token  - ADMIN_API_TOKEN (Bearer). Без него backend вернёт 401.
 * @param signal - опциональный AbortSignal (передаётся запросом автоматически).
 * @returns промис с массивом LeadRow.
 * @throws ApiError при не-2xx ответе (401 — неверный токен).
 */
export async function listLeads(token: string, signal?: AbortSignal): Promise<LeadRow[]> {
  const options: Parameters<typeof apiRequest>[1] = {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  };
  if (signal !== undefined) {
    options.signal = signal;
  }
  const data = await apiRequest<ListLeadsResponse>(LEADS_PATH, options);
  return data.leads;
}

/**
 * Мутация создания лида (TanStack Query).
 *
 * Использование (в фиче/виджете чата на web):
 *   const { mutateAsync, isPending, error } = useCreateLead();
 *   await mutateAsync(payload);
 *
 * После успеха инвалидирует кэш списка лидов, чтобы admin-дашборд (если открыт
 * в той же сессии) подтянул новый лид.
 *
 * @returns результат useMutation: mutate/mutateAsync(payload), isPending, error и т.д.
 */
export function useCreateLead(): UseMutationResult<
  CreateLeadResponse,
  unknown,
  CreateLeadRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeadRequest) => createLead(payload),
    onSuccess: () => {
      // Сбрасываем все списки лидов (любой токен) — данные устарели.
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Запрос списка лидов для admin-дашборда (TanStack Query).
 *
 * Запрос включён только когда передан непустой токен (enabled), поэтому хук
 * безопасно вызывать до авторизации — он просто не пойдёт в сеть.
 *
 * Использование:
 *   const { data: leads, isLoading, error } = useLeads(token);
 *
 * @param token - ADMIN_API_TOKEN (Bearer). Пустая строка -> запрос не выполняется.
 * @returns результат useQuery с data: LeadRow[].
 */
export function useLeads(token: string): UseQueryResult<LeadRow[]> {
  return useQuery({
    queryKey: leadKeys.list(token),
    queryFn: ({ signal }) => listLeads(token, signal),
    // Не дёргаем сервер без токена (например на экране входа admin).
    enabled: token.length > 0,
  });
}
