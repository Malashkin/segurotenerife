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
 *   - createLead / listLeads — функции API-слоя поверх apiRequest (использует entities/lead).
 *   - trackEvent / getSessionId — лёгкая аналитика воронки (POST /api/events).
 *   - createLeadSchema / validateLead / MESSENGERS — zod-валидация payload лида.
 *
 * TanStack Query-хуки (useCreateLead / useLeads) и leadKeys переехали в
 * `entities/lead` (Волна 3) — берите их оттуда (`@entities`), не из shared/api.
 */
export { getApiBaseUrl } from './config';
export { apiRequest, ApiError, type RequestOptions } from './client';
export { createQueryClient } from './queryClient';
export { QueryProvider, type QueryProviderProps } from './QueryProvider';

export { createLead, listLeads } from './leads';

export { trackEvent, getSessionId } from './events';

export {
  initAnalytics,
  setAnalyticsConsent,
  captureEvent,
  type InitAnalyticsOptions,
} from './posthog';

export { askQuestion, forwardHandoff, type ChatReply, type ChatTurn } from './chat';

export { createLeadSchema, validateLead, MESSENGERS } from './schema';

export type {
  Messenger,
  CreateLeadRequest,
  LeadInput,
  CreateLeadResponse,
  LeadRow,
  ListLeadsResponse,
} from './types';
