/**
 * Опции быстрых ответов (quick-reply) для каждого шага чата.
 *
 * Зеркало массивов `FLOW[i].opts` из прототипа /Users/mike/Desktop/fun/index.html.
 * Структура сценария (ключи шагов, порядок, kind, questionKey) живёт в
 * shared/store (CHAT_FLOW); здесь — ТОЛЬКО варианты ответов, т.к. они касаются
 * представления (UI) и переводов, а не доменного состояния.
 *
 * Опция описывается так же, как в прототипе:
 *  - { optionKey } — переводимая опция (подпись берётся из i18n по ключу o_*);
 *  - { value }     — литеральная опция (флаг языка, название города) без перевода.
 * Это совпадает с типом PickedOption из shared/store, что упрощает запись выбора.
 */
import type { ChatStepKey, PickedOption } from '@shared/store';

/** Опция шага до вычисления подписи: ключ перевода ИЛИ литерал. */
export interface StepOption {
  /** i18n-ключ опции (o_*), если опция переводимая. */
  optionKey?: string;
  /** Литеральное значение (город / язык с флагом), если не переводится. */
  value?: string;
}

/**
 * Опции по ключу шага. Шаги kind:'form' (contact) опций не имеют.
 * Порядок и набор — точно как в FLOW прототипа.
 */
export const STEP_OPTIONS: Partial<Record<ChatStepKey, readonly StepOption[]>> = {
  // Шаг 1 — язык общения: литеральные подписи с флагами (как в прототипе).
  lang: [
    { value: '🇬🇧 English' },
    { value: '🇪🇸 Español' },
    { value: '🇺🇦 Українська' },
    { value: '🇷🇺 Русский' },
  ],
  // Шаг 2 — цель страхования.
  // (Бизнес/autónomos пока не консультируем — опции o_biz нет.)
  goal: [
    { optionKey: 'o_med' },
    { optionKey: 'o_dental' },
    { optionKey: 'o_family' },
    { optionKey: 'o_other' },
  ],
  // Шаг 3 — кого страхуем.
  who: [
    { optionKey: 'o_one' },
    { optionKey: 'o_pair' },
    { optionKey: 'o_familyk' },
  ],
  // Шаг 4 — район Тенерифе: города литеральные + «другой район» (переводимый).
  city: [
    { value: 'Santa Cruz' },
    { value: 'La Laguna' },
    { value: 'Adeje / Costa Adeje' },
    { value: 'Arona / Los Cristianos' },
    { value: 'Puerto de la Cruz' },
    { optionKey: 'o_othercity' },
  ],
  // Шаг 5 — срочность.
  urgency: [
    { optionKey: 'o_urgent' },
    { optionKey: 'o_soon' },
    { optionKey: 'o_browsing' },
  ],
};

/**
 * Превращает опцию шага в PickedOption (с готовой подписью) для записи в стор.
 * @param opt - опция шага (ключ или литерал)
 * @param ct  - переводчик чата (useChatI18n().ct)
 */
export function toPicked(opt: StepOption, ct: (key: string) => string): PickedOption {
  const label = opt.optionKey ? ct(opt.optionKey) : (opt.value ?? '');
  const picked: PickedOption = { label };
  if (opt.optionKey !== undefined) picked.optionKey = opt.optionKey;
  if (opt.value !== undefined) picked.value = opt.value;
  return picked;
}

/**
 * Восстанавливает актуальную подпись ранее выбранной опции на ТЕКУЩЕМ языке.
 * Переводимые опции (optionKey) переводятся заново; литеральные — как есть.
 * Зеркало optLabel(picked[i]) при rebuildChat() в прототипе.
 * @param picked - сохранённый в сторе выбор
 * @param ct     - переводчик чата
 */
export function pickedLabel(picked: PickedOption, ct: (key: string) => string): string {
  if (picked.optionKey) return ct(picked.optionKey);
  if (picked.value !== undefined) return picked.value;
  return picked.label;
}
