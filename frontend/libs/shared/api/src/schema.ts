/**
 * Zod-схемы валидации контракта лидов.
 *
 * Валидируем payload ПЕРЕД отправкой на backend (POST /api/leads), чтобы:
 *   - не слать заведомо невалидные запросы (пустое имя/контакт, нет согласия);
 *   - получить понятные ошибки на фронте до похода в сеть;
 *   - держать единый источник правды о форме данных рядом с типами контракта.
 *
 * Схема намеренно совпадает по полям с `CreateLeadRequest` (types.ts):
 * тип выводится из схемы (`z.infer`) и сверяется с интерфейсом контракта,
 * поэтому рассинхронизация типа и валидации поймается компилятором.
 */
import { z } from 'zod';
import type { CreateLeadRequest } from './types';

/** Список поддерживаемых мессенджеров (Instagram НЕ предлагаем). */
export const MESSENGERS = ['WhatsApp', 'Telegram', 'Viber'] as const;

/**
 * Zod-схема тела запроса на создание лида.
 *
 * Обязательные поля (name, contact, messenger, consent) проверяются строго;
 * остальные — необязательный контекст подбора (trim, без пустых строк нет смысла,
 * но допускаем их отсутствие).
 */
export const createLeadSchema = z.object({
  /** Имя клиента — непустое после trim. */
  name: z.string().trim().min(1, 'name_required'),
  /** Контакт (телефон или @username) — непустой после trim. */
  contact: z.string().trim().min(1, 'contact_required'),
  /** Мессенджер для связи — строго один из разрешённых. */
  messenger: z.enum(MESSENGERS),
  /** Язык общения, выбранный в чате. */
  comm_lang: z.string().trim().min(1).optional(),
  /** Цель страховки. */
  goal: z.string().trim().min(1).optional(),
  /** Кого страхуем. */
  who: z.string().trim().min(1).optional(),
  /** Район Тенерифе. */
  city: z.string().trim().min(1).optional(),
  /** Срочность подбора. */
  urgency: z.string().trim().min(1).optional(),
  /** Язык интерфейса на момент отправки (en|es|uk|ru). */
  ui_lang: z.string().trim().min(1).optional(),
  /** Согласие на обработку данных — обязано быть true, иначе backend вернёт 400. */
  consent: z.literal(true, {
    errorMap: () => ({ message: 'consent_required' }),
  }),
});

/**
 * Тип, выведенный из zod-схемы. Совпадает по форме с `CreateLeadRequest`
 * (types.ts). Используется как возвращаемый тип валидатора — так компилятор
 * сам сверяет схему с контрактом: если поля разойдутся, упадёт typecheck в местах,
 * где `LeadInput` ожидается там, где приходит `SchemaShape`, и наоборот.
 */
export type SchemaShape = z.infer<typeof createLeadSchema>;

/**
 * Валидирует payload лида zod-схемой и нормализует необязательные поля.
 *
 * Под `exactOptionalPropertyTypes` контракт `CreateLeadRequest` трактует
 * `comm_lang?: string` как «ключа нет ИЛИ строка», а не «строка | undefined».
 * Поэтому ключи с `undefined`-значением вырезаем, а не оставляем со значением
 * undefined — так результат точно соответствует контракту и не шлёт лишних полей.
 *
 * @param payload - произвольные данные (например из стейта формы/чата)
 * @returns типизированный `CreateLeadRequest`, готовый к отправке
 * @throws ZodError при невалидных данных (поля .issues с кодами сообщений)
 */
export function validateLead(payload: unknown): CreateLeadRequest {
  const parsed = createLeadSchema.parse(payload);

  // Обязательные поля присутствуют всегда (гарантировано схемой).
  const result: CreateLeadRequest = {
    name: parsed.name,
    contact: parsed.contact,
    messenger: parsed.messenger,
    consent: parsed.consent,
  };

  // Необязательные поля добавляем только если они заданы (без undefined-ключей).
  if (parsed.comm_lang !== undefined) result.comm_lang = parsed.comm_lang;
  if (parsed.goal !== undefined) result.goal = parsed.goal;
  if (parsed.who !== undefined) result.who = parsed.who;
  if (parsed.city !== undefined) result.city = parsed.city;
  if (parsed.urgency !== undefined) result.urgency = parsed.urgency;
  if (parsed.ui_lang !== undefined) result.ui_lang = parsed.ui_lang;

  return result;
}
