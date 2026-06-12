/**
 * Деривация списка пузырьков чата из состояния стора + i18n.
 *
 * Прототип строил DOM императивно (addBot/addUser) и при смене языка вызывал
 * rebuildChat(), перерисовывая всю историю. Здесь мы делаем то же декларативно:
 * на каждый рендер из стора (stepIndex / answers / picked / phase) и текущего
 * языка (ct) ВЫЧИСЛЯЕМ полный упорядоченный список сообщений. React сам
 * перерисует их; смена языка меняет ct → пересчёт всех подписей без перезагрузки.
 *
 * Это и есть «re-render chat in new language on language switch»: история,
 * вопросы и подписи опций берутся из i18n по сохранённым ключам, а не хранятся
 * как готовый текст.
 */
import { useTranslation } from 'react-i18next';
import {
  CHAT_FLOW,
  CHAT_STEP_COUNT,
  useChatStore,
  type ChatAnswers,
  type ChatPhase,
  type PickedOption,
} from '@shared/store';
import { pickedLabel } from './options';

/** Тип одного пузырька в истории чата. */
export interface ChatMessage {
  /** Стабильный id для React key. */
  id: string;
  /** Автор: бот или пользователь. */
  author: 'bot' | 'user';
  /** Готовый к показу текст пузырька. */
  text: string;
}

/** Параметры построения сводки выбора пользователя в одну строку. */
function contactSummary(answers: ChatAnswers): string | null {
  if (!answers.name) return null;
  // Зеркало addUser(name · messenger · contact) прототипа.
  return [answers.name, answers.messenger, answers.contact].filter(Boolean).join(' · ');
}

/**
 * Строит полный список сообщений по текущему состоянию чата.
 * @param ct - переводчик чата (useChatI18n().ct)
 */
export function useChatMessages(ct: (key: string) => string): ChatMessage[] {
  // Подписка на react-i18next, чтобы пересобирать подписи при смене языка.
  useTranslation();

  const stepIndex = useChatStore((s) => s.stepIndex);
  const phase = useChatStore((s) => s.phase);
  const answers = useChatStore((s) => s.answers);
  const picked = useChatStore((s) => s.picked);

  const messages: ChatMessage[] = [];

  // 1. Приветствие бота (всегда первое, как greeting в startChat()).
  messages.push({ id: 'greeting', author: 'bot', text: ct('greeting') });

  // 2. Пройденные шаги: вопрос бота + ответ пользователя.
  //    Идём до min(stepIndex, последний пройденный) — как цикл rebuildChat().
  const passed = Math.min(stepIndex, CHAT_STEP_COUNT);
  for (let i = 0; i < passed; i++) {
    const step = CHAT_FLOW[i];
    if (!step) continue;
    messages.push({ id: `q-${i}`, author: 'bot', text: ct(step.questionKey) });

    const choice: PickedOption | undefined = picked[i];
    if (choice) {
      messages.push({ id: `a-${i}`, author: 'user', text: pickedLabel(choice, ct) });
    } else {
      // form-шаг (contact) выбора-кнопки не имеет — сводка добавится ниже.
      const key = step.key;
      const value = answers[key as keyof ChatAnswers];
      if (typeof value === 'string' && value) {
        messages.push({ id: `a-${i}`, author: 'user', text: value });
      }
    }
  }

  // 3. Текущий открытый вопрос (если чат не завершён и есть активный шаг).
  //    На фазах quick/form показываем вопрос текущего шага под кнопками/формой.
  if (phase !== 'done' && stepIndex < CHAT_STEP_COUNT) {
    const cur = CHAT_FLOW[stepIndex];
    if (cur) {
      messages.push({ id: `q-cur-${stepIndex}`, author: 'bot', text: ct(cur.questionKey) });
    }
  }

  // 4. Экран отправки/завершения (фаза done): сводка контакта + загрузка + готово.
  if (phase === 'done') {
    // Вопрос последнего (form) шага уже не добавлен в п.3 — добавим его явно,
    // чтобы история была полной (как в rebuildChat при phase==='done').
    const formStep = CHAT_FLOW[CHAT_STEP_COUNT - 1];
    if (formStep) {
      messages.push({ id: 'q-form', author: 'bot', text: ct(formStep.questionKey) });
    }
    const summary = contactSummary(answers);
    if (summary) messages.push({ id: 'a-form', author: 'user', text: summary });

    messages.push({ id: 'load', author: 'bot', text: ct('load_h') });
    messages.push({ id: 'done', author: 'bot', text: `${ct('done_h')} — ${ct('done_p')}` });
  }

  return messages;
}

/** Утилита: булева «чат в активной фазе» (не idle). */
export function isActivePhase(phase: ChatPhase): boolean {
  return phase !== 'idle';
}
