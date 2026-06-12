/**
 * TanStack Query-хуки сущности «лид» (FSD entities/lead/model).
 *
 * Переехали сюда из shared/api (Волна 3): доменная логика чтения/записи сущности
 * — это уровень entities, а shared/api держит лишь generic-клиент и контракт.
 * Низкоуровневые функции (createLead / listLeads) и типы по-прежнему живут в
 * shared/api; здесь — только React-обвязка (мутации/запросы + query-ключи).
 *
 * Компоненты (чат на web, таблица в admin) импортируют эти хуки из `@entities`,
 * а не делают «голый fetch» (api.md SOUL).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createLead,
  listLeads,
  type CreateLeadRequest,
  type CreateLeadResponse,
  type LeadRow,
} from '@shared/api';

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
 * Мутация создания лида (TanStack Query).
 *
 * Использование (в фиче/виджете чата на web):
 *   const { mutateAsync, isPending, error } = useCreateLead();
 *   await mutateAsync(payload);
 *
 * После успеха инвалидирует кэш списка лидов, чтобы admin-дашборд (если открыт
 * в той же сессии) подтянул новый лид.
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
 * @param token - access-JWT менеджера (Bearer). Пустая строка -> запрос не выполняется.
 */
export function useLeads(token: string): UseQueryResult<LeadRow[]> {
  return useQuery({
    queryKey: leadKeys.list(token),
    queryFn: ({ signal }) => listLeads(token, signal),
    // Не дёргаем сервер без токена (например на экране входа admin).
    enabled: token.length > 0,
  });
}
