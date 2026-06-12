/**
 * Публичный API библиотеки shared/api (FSD public API).
 *
 * Отсюда приложения и слои берут:
 *   - QueryProvider          — обернуть дерево в app-слое.
 *   - createQueryClient      — фабрика QueryClient (для тестов/кастомизации).
 *   - apiRequest / ApiError  — низкоуровневый HTTP-клиент (использовать в api/ слоёв,
 *                              НЕ напрямую в компонентах — там только хуки Query).
 *   - getApiBaseUrl          — базовый URL из VITE_API_URL.
 *   - Типы контракта лидов   — CreateLeadRequest/LeadInput, LeadRow и т.д.
 *   - createLead / listLeads — функции API-слоя поверх apiRequest.
 *   - useCreateLead / useLeads — хуки TanStack Query для компонентов.
 *   - leadKeys               — фабрика query-ключей.
 *   - createLeadSchema / validateLead / MESSENGERS — zod-валидация payload лида.
 */
export { getApiBaseUrl } from './config';
export { apiRequest, ApiError, type RequestOptions } from './client';
export { createQueryClient } from './queryClient';
export { QueryProvider, type QueryProviderProps } from './QueryProvider';

export {
  createLead,
  listLeads,
  leadKeys,
  useCreateLead,
  useLeads,
} from './leads';

export { createLeadSchema, validateLead, MESSENGERS } from './schema';

export type {
  Messenger,
  CreateLeadRequest,
  LeadInput,
  CreateLeadResponse,
  LeadRow,
  ListLeadsResponse,
} from './types';
