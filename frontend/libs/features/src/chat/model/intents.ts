/**
 * Интенты чата по карточкам «Виды страховок».
 *
 * Клик по карточке открывает чат с уже выбранным типом страховки (цель
 * предзаполняется → шаг «какая страховка нужна» пропускается) и сразу задаёт
 * релевантный следующий вопрос. Для питомцев это специальный вопрос
 * «Скажите, какой у вас питомец?» со своими быстрыми ответами — вместо общего
 * «кого страхуем».
 *
 * Маппинг id интента → ключ цели (i18n) + опциональный override шага `who`.
 */
import type { StepOption } from './options';

/** Описание интента карточки. */
export interface ChatIntent {
  /** i18n-ключ метки цели страхования (запишется как answers.goal). */
  goalKey: string;
  /**
   * Переопределение шага `who`: свой вопрос + быстрые ответы вместо «кого
   * страхуем». Задаётся там, где общий вопрос нерелевантен (напр. питомцы).
   */
  customWho?: { askKey: string; options: readonly StepOption[] };
}

/** id интентов = соответствуют карточкам InsuranceTypes (c1…c9). */
export const CHAT_INTENTS: Record<string, ChatIntent> = {
  med: { goalKey: 'o_med' },
  family: { goalKey: 'o_family' },
  student: { goalKey: 'o_student' },
  travel: { goalKey: 'o_travel' },
  dental: { goalKey: 'o_dental' },
  reembolso: { goalKey: 'o_reembolso' },
  life: { goalKey: 'o_life' },
  decesos: { goalKey: 'o_decesos' },
  pet: {
    goalKey: 'o_pet',
    customWho: {
      askKey: 'q_pet',
      options: [{ optionKey: 'op_dog' }, { optionKey: 'op_cat' }, { optionKey: 'op_pet_other' }],
    },
  },
  // Бизнес-страховку (autónomos) пока не консультируем — карточка/опция убраны.
};
