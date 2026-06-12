/**
 * Типы запросов и ответов backend REST API (контракт лидов).
 *
 * Соответствует контракту:
 *   POST {base}/api/leads -> 201 { id } | 400 при ошибке валидации / !consent
 *   GET  {base}/api/leads (Bearer admin token) -> { leads: LeadRow[] }
 *
 * Типы описаны в shared/api, т.к. ими пользуются и web (создание лида),
 * и admin (список лидов). Доменные сущности/фичи могут импортировать их отсюда.
 */

/** Мессенджер, через который менеджер свяжется с клиентом. Instagram НЕ предлагаем. */
export type Messenger = 'WhatsApp' | 'Telegram' | 'Viber';

/**
 * Тело запроса на создание лида (POST /api/leads).
 * Обязательны: name, contact, messenger, consent. Остальное — контекст подбора.
 */
export interface CreateLeadRequest {
  /** Имя клиента. */
  name: string;
  /** Контакт: телефон или @username для выбранного мессенджера. */
  contact: string;
  /** Выбранный мессенджер для связи. */
  messenger: Messenger;
  /** Язык общения, выбранный в чате (необязательно). */
  comm_lang?: string;
  /** Цель страховки (медицина/виза/стоматология/...). */
  goal?: string;
  /** Кого страхуем (один человек / пара / семья). */
  who?: string;
  /** Район Тенерифе. */
  city?: string;
  /** Срочность подбора. */
  urgency?: string;
  /** Язык интерфейса на момент отправки (en|es|uk|ru). */
  ui_lang?: string;
  /** Согласие на обработку данных. Без него backend вернёт 400. */
  consent: boolean;
}

/**
 * Псевдоним входных данных для создания лида.
 * Совпадает с `CreateLeadRequest`; имя `LeadInput` используется в формах/чате
 * как «то, что вводит пользователь до отправки».
 */
export type LeadInput = CreateLeadRequest;

/** Ответ на успешное создание лида (201). */
export interface CreateLeadResponse {
  /** Идентификатор созданного лида. */
  id: string;
}

/**
 * Строка лида в дашборде менеджера (GET /api/leads).
 * Возвращается backend вместе с серверными полями (created_at, status).
 */
export interface LeadRow {
  id: string;
  /** ISO-дата создания лида (форматируется на фронте через Intl.DateTimeFormat). */
  created_at: string;
  name: string;
  contact: string;
  messenger: Messenger;
  comm_lang: string | null;
  goal: string | null;
  who: string | null;
  city: string | null;
  urgency: string | null;
  ui_lang: string | null;
  /** Статус обработки лида менеджером. */
  status: string;
}

/** Ответ списка лидов (GET /api/leads). */
export interface ListLeadsResponse {
  leads: LeadRow[];
}
