/**
 * Публичный API слоя entities (FSD public API).
 *
 * Доменные сущности. Сейчас здесь `lead`: TanStack Query-хуки (useCreateLead /
 * useLeads), query-ключи и реэкспорт типов контракта лида. Хуки переехали сюда
 * из shared/api на Волне 3 (доменная логика сущности — уровень entities).
 *
 * Как добавить сущность: создать src/<entity>/{model,api,ui}, затем
 * реэкспортировать публичные части отсюда.
 */
export {
  leadKeys,
  useCreateLead,
  useLeads,
  type Messenger,
  type CreateLeadRequest,
  type LeadInput,
  type CreateLeadResponse,
  type LeadRow,
} from './lead';
