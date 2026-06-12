/**
 * Публичный API сущности «лид» (FSD entities/lead).
 *
 * Экспортирует доменные хуки (useCreateLead / useLeads), query-ключи и — для
 * удобства потребителей — реэкспорт типов контракта лида из shared/api, чтобы
 * компонент мог взять и хук, и тип из одного места (`@entities`).
 */
export { leadKeys, useCreateLead, useLeads } from './model/leadQueries';

export type {
  Messenger,
  CreateLeadRequest,
  LeadInput,
  CreateLeadResponse,
  LeadRow,
} from '@shared/api';
