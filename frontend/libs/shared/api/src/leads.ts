/**
 * API-слой сущности «лид» (низкоуровневые функции поверх apiRequest).
 *
 * Содержит:
 *   - createLead(payload) — POST /api/leads (с zod-валидацией перед отправкой);
 *   - listLeads(token)    — GET  /api/leads (Bearer access-токен менеджера).
 *
 * TanStack Query-хуки (useCreateLead / useLeads) и query-ключи живут в слое
 * `entities/lead` (FSD: доменная логика чтения/записи сущности — это entities,
 * а shared/api держит лишь generic-клиент и контракт). Компоненты используют
 * хуки из entities, а не эти функции напрямую — «голый fetch» запрещён (api.md).
 */
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
 * @param token  - access-JWT менеджера (Bearer). Без него backend вернёт 401.
 * @param signal - опциональный AbortSignal (передаётся запросом автоматически).
 * @returns промис с массивом LeadRow.
 * @throws ApiError при не-2xx ответе (401 — неверный/просроченный токен).
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
