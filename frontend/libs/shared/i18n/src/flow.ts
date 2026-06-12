/**
 * Конфигурация 6-шагового чат-флоу подбора страховки.
 *
 * Портирована ВЕРБАТИМ из массива FLOW прототипа
 * /Users/mike/Desktop/fun/index.html. Это «контракт» сценария чата: какие шаги,
 * в каком порядке, какие варианты ответов. Сами тексты вопросов и вариантов
 * НЕ хранятся здесь — шаги ссылаются на ключи перевода (`q`, `opts[].k`) из
 * namespace `common` (см. resources.ts), а локализованные подписи берутся через
 * t(). Это держит сценарий и переводы раздельно (DRY) и совместимо с FSD: chat-
 * виджет (libs/widgets) импортирует CHAT_FLOW отсюда и рендерит шаги.
 *
 * Ключи ответов сохраняются под `FlowStep.key` и затем маппятся в поля лида
 * бэкенда: goal / who / city / urgency / contact (+ comm_lang из шага `lang`).
 */
import type { AppLocale } from './config';

/**
 * Вариант быстрого ответа (кнопка) в шаге типа `quick`.
 * - `k` — ключ перевода в namespace `common` (подпись локализуется через t(k));
 * - `v` — готовая подпись «как есть» (для значений, не требующих перевода:
 *   флаги языков, названия городов Тенерифе).
 * Ровно одно из полей задано (взаимоисключающие), как в прототипе.
 */
export type FlowOption =
  | { readonly k: string; readonly v?: undefined }
  | { readonly v: string; readonly k?: undefined };

/** Тип шага: быстрый выбор кнопками или финальная форма контакта. */
export type FlowStepKind = 'quick' | 'form';

/** Один шаг чат-сценария. */
export interface FlowStep {
  /** Машинный ключ ответа (попадает в лид: goal/who/city/urgency/contact/lang). */
  readonly key: 'lang' | 'goal' | 'who' | 'city' | 'urgency' | 'contact';
  /** Ключ перевода вопроса в namespace `common` (например 's1_h'). */
  readonly q: string;
  /** Тип шага. */
  readonly kind: FlowStepKind;
  /** Варианты ответа для шагов `quick` (для `form` отсутствуют). */
  readonly opts?: readonly FlowOption[];
}

/**
 * Полный сценарий из 6 шагов (порядок строго как в прототипе):
 *   1. lang     — язык общения (флаги, готовые подписи);
 *   2. goal     — цель страховки (ключи o_med/o_dental/o_family/o_biz/o_other);
 *   3. who      — кого страхуем (o_one/o_pair/o_familyk);
 *   4. city      — район Тенерифе (города как есть + o_othercity);
 *   5. urgency  — срочность (o_urgent/o_soon/o_browsing);
 *   6. contact  — финальная форма (имя, мессенджер, контакт, согласие).
 *
 * ВНИМАНИЕ по мессенджерам: на шаге языка варианты — это просто подписи языков.
 * Выбор мессенджера происходит в форме шага `contact`. По требованию продукта
 * на хэндофе предлагаются WhatsApp / Telegram / Viber (НЕ Instagram); этот
 * список — забота chat-виджета/формы, здесь сценарий его не фиксирует.
 */
export const CHAT_FLOW: readonly FlowStep[] = [
  {
    key: 'lang',
    q: 's1_h',
    kind: 'quick',
    opts: [
      { v: '🇬🇧 English' },
      { v: '🇪🇸 Español' },
      { v: '🇺🇦 Українська' },
      { v: '🇷🇺 Русский' },
    ],
  },
  {
    key: 'goal',
    q: 's2_h',
    kind: 'quick',
    opts: [{ k: 'o_med' }, { k: 'o_dental' }, { k: 'o_family' }, { k: 'o_biz' }, { k: 'o_other' }],
  },
  {
    key: 'who',
    q: 's3_h',
    kind: 'quick',
    opts: [{ k: 'o_one' }, { k: 'o_pair' }, { k: 'o_familyk' }],
  },
  {
    key: 'city',
    q: 's4_h',
    kind: 'quick',
    opts: [
      { v: 'Santa Cruz' },
      { v: 'La Laguna' },
      { v: 'Adeje / Costa Adeje' },
      { v: 'Arona / Los Cristianos' },
      { v: 'Puerto de la Cruz' },
      { k: 'o_othercity' },
    ],
  },
  {
    key: 'urgency',
    q: 's5_h',
    kind: 'quick',
    opts: [{ k: 'o_urgent' }, { k: 'o_soon' }, { k: 'o_browsing' }],
  },
  {
    key: 'contact',
    q: 's6_h',
    kind: 'form',
  },
] as const;

/** Количество шагов сценария (для индикатора «Вопрос N из 6»). */
export const FLOW_STEPS_TOTAL = CHAT_FLOW.length;

/**
 * Маппинг подписи языка (выбранной на шаге `lang`) в код приложения AppLocale.
 * Нужен, чтобы по выбору «🇺🇦 Українська» переключить UI и записать comm_lang.
 * Ключи — ровно те `v`, что заданы в CHAT_FLOW[0].opts.
 */
export const FLOW_LANG_TO_LOCALE: Readonly<Record<string, AppLocale>> = {
  '🇬🇧 English': 'en',
  '🇪🇸 Español': 'es',
  '🇺🇦 Українська': 'uk',
  '🇷🇺 Русский': 'ru',
};
