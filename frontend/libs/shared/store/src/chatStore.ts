/**
 * Chat-стор (Zustand) — состояние мастера чат-подбора страховки.
 *
 * Зеркалит пошаговый сценарий из прототипа /Users/mike/Desktop/fun/index.html
 * (константа FLOW + функции pick / startChat / rebuildChat / submitForm).
 * Шесть шагов:
 *   0 lang     — выбор языка общения (quick)
 *   1 goal     — цель страхования (quick)
 *   2 who      — кого страхуем (quick)
 *   3 city     — город на Тенерифе (quick)
 *   4 urgency  — срочность (quick)
 *   5 contact  — контактная форма (form): name / messenger / contact / consent
 *
 * Дизайн-принципы (frontend.md SOUL):
 *  - Это КЛИЕНТСКОЕ состояние → Zustand (серверное — в TanStack Query, не мешаем).
 *  - Стор framework-agnostic: работает и вне React-дерева (см. примечание ниже).
 *  - Обновления только через set() (иммутабельность) — без прямых мутаций.
 *  - Стор не знает про i18n/api библиотеки: тексты вопросов/опций живут в слое
 *    UI (widgets) и i18n-словарях, а стор хранит лишь нейтральные ответы/индексы.
 *    Поэтому здесь объявлены ЛОКАЛЬНЫЕ типы Messenger/значений, совпадающие с
 *    контрактом shared/api (CreateLeadRequest), но без импорта оттуда — чтобы
 *    shared/store оставался листовой зависимостью.
 *
 * РАБОТА ВНЕ REACT: vanilla-стор Zustand — это объект с методами getState /
 * setState / subscribe. Хук useChatStore сам по себе и есть такой стор
 * (create() возвращает функцию-хук с прикреплёнными vanilla-методами), поэтому:
 *   useChatStore.getState().pick('o_med');
 *   const unsub = useChatStore.subscribe((s) => console.log(s.stepIndex));
 * можно вызывать из любого кода (тесты, аналитика, императивная логика).
 */
import { create } from 'zustand';

/* ===================== Типы домена ===================== */

/**
 * Мессенджеры, предлагаемые на этапе контакта.
 * Совпадает с shared/api `Messenger`. ВАЖНО: Instagram не предлагаем
 * (см. global-контекст и комментарии в коде). Прототип отдаёт WhatsApp/Telegram,
 * контракт бэкенда допускает ещё Viber — оставляем все три валидными.
 */
export type ChatMessenger = 'WhatsApp' | 'Telegram' | 'Viber';

/** Мессенджер по умолчанию (как `checked` в форме прототипа). */
export const DEFAULT_MESSENGER: ChatMessenger = 'WhatsApp';

/**
 * Ключи шагов сценария — стабильные идентификаторы вопросов.
 * Совпадают с `FLOW[i].key` в прототипе.
 */
export type ChatStepKey =
  | 'lang'
  | 'goal'
  | 'who'
  | 'city'
  | 'urgency'
  | 'contact';

/** Вид шага: быстрый выбор кнопками либо контактная форма. */
export type ChatStepKind = 'quick' | 'form';

/** Описание одного шага сценария (структура, без текстов — тексты в i18n). */
export interface ChatStep {
  /** Стабильный ключ шага (== поле в answers). */
  readonly key: ChatStepKey;
  /** Тип шага. */
  readonly kind: ChatStepKind;
  /**
   * i18n-ключ заголовка-вопроса (как `FLOW[i].q` в прототипе: 's1_h'..'s6_h').
   * Сам перевод подтягивает UI через shared/i18n; стор хранит лишь ключ.
   */
  readonly questionKey: string;
}

/**
 * Сценарий из 6 шагов — точное зеркало FLOW прототипа (без массивов опций:
 * опции и их подписи — забота UI/словарей, стор хранит только выбранное значение).
 */
export const CHAT_FLOW: readonly ChatStep[] = [
  // Шаг выбора языка убран (Волна B, F2): язык общения берётся из языка страницы
  // (comm_lang = текущая локаль), чтобы не спрашивать дважды и сократить путь.
  { key: 'goal', kind: 'quick', questionKey: 's2_h' },
  { key: 'who', kind: 'quick', questionKey: 's3_h' },
  { key: 'city', kind: 'quick', questionKey: 's4_h' },
  { key: 'urgency', kind: 'quick', questionKey: 's5_h' },
  { key: 'contact', kind: 'form', questionKey: 's6_h' },
] as const;

/** Всего шагов в сценарии. */
export const CHAT_STEP_COUNT = CHAT_FLOW.length;

/**
 * Фаза диалога (зеркало переменной `phase` прототипа).
 *  - 'idle'     — чат ещё не запущен (виджет свёрнут / приветствие не показано);
 *  - 'thinking' — бот «печатает» очередной вопрос;
 *  - 'quick'    — показаны кнопки быстрого ответа текущего шага;
 *  - 'form'     — показана контактная форма (последний шаг);
 *  - 'done'     — лид отправлен, показан экран завершения/хендоффа.
 */
export type ChatPhase = 'idle' | 'thinking' | 'quick' | 'form' | 'done';

/**
 * Ответы пользователя. Поля совпадают с ключами шагов + контактные данные.
 * Все опциональны до момента заполнения (exactOptionalPropertyTypes ON:
 * отсутствующее поле = ключ отсутствует, а не `undefined`-значение).
 */
export interface ChatAnswers {
  /** Шаг 1: язык общения (метка выбранной опции, напр. '🇬🇧 English'). */
  lang?: string;
  /** Шаг 2: цель страхования (метка опции). */
  goal?: string;
  /** Шаг 3: кого страхуем (метка опции). */
  who?: string;
  /** Шаг 4: город (метка опции или свободный ввод). */
  city?: string;
  /** Шаг 5: срочность (метка опции). */
  urgency?: string;
  /** Шаг 6: имя из формы. */
  name?: string;
  /** Шаг 6: выбранный мессенджер. */
  messenger?: ChatMessenger;
  /** Шаг 6: контакт (телефон / ник). */
  contact?: string;
  /** Шаг 6: согласие на обработку (обязательно для отправки). */
  consent?: boolean;
}

/**
 * Выбранная на «quick»-шаге опция. Зеркало `picked[stepIndex] = o` прототипа,
 * где опция имела форму `{ k?: string; v?: string }` (k — i18n-ключ опции,
 * v — литеральное значение). Храним обе формы плюс готовую подпись, чтобы
 * UI мог пере-отрисовать историю при смене языка (как rebuildChat()).
 */
export interface PickedOption {
  /** i18n-ключ опции (если опция переводимая, напр. 'o_med'). */
  optionKey?: string;
  /** Литеральное значение опции (если не переводится, напр. 'Santa Cruz'). */
  value?: string;
  /** Готовая подпись на момент выбора (то, что увидел пользователь). */
  label: string;
}

/* ===================== Состояние и действия ===================== */

/** Полное состояние chat-домена. */
export interface ChatState {
  /** Индекс текущего шага в CHAT_FLOW (0..CHAT_STEP_COUNT). */
  stepIndex: number;
  /** Текущая фаза диалога. */
  phase: ChatPhase;
  /** Накопленные ответы пользователя. */
  answers: ChatAnswers;
  /**
   * Выбранные опции по индексам шагов (picked[i] — выбор на шаге i).
   * Разрежённый по смыслу массив; на «form»-шаге элемент отсутствует.
   */
  picked: (PickedOption | undefined)[];

  /* --- Действия (мутации только через set) --- */

  /** Запустить/перезапустить чат: сброс + переход к первому вопросу (thinking). */
  start: () => void;

  /**
   * Выбрать опцию на текущем «quick»-шаге: записать ответ, сохранить picked,
   * перейти к следующему шагу. Зеркало pick(o) прототипа.
   * Принимает либо готовую опцию, либо короткие формы (см. перегрузку логики).
   */
  pick: (option: PickedOption) => void;

  /**
   * Вернуться на один шаг назад. Чистит ответ/выбор последнего пройденного шага
   * и ставит фазу под тип шага (quick/form). Не уходит ниже нуля.
   * (В прототипе кнопки «назад» нет — добавлено как rebuild-friendly действие,
   *  не ломающее зеркальность вперёд идущего сценария.)
   */
  back: () => void;

  /** Установить имя из контактной формы. */
  setName: (name: string) => void;
  /** Установить выбранный мессенджер. */
  setMessenger: (messenger: ChatMessenger) => void;
  /** Установить контакт (телефон/ник) из формы. */
  setContact: (contact: string) => void;
  /** Установить флаг согласия. */
  setConsent: (consent: boolean) => void;

  /**
   * Явно задать фазу (например 'thinking' на время «печати» бота, затем
   * 'quick'/'form'/'done'). Вынесено отдельно, т.к. тайминги печати —
   * забота UI-слоя (виджета), а не стора.
   */
  setPhase: (phase: ChatPhase) => void;

  /**
   * Перейти к следующему шагу без выбора (для form→done и служебных переходов).
   * Не выходит за пределы CHAT_STEP_COUNT.
   */
  next: () => void;

  /** Пометить диалог завершённым (лид отправлен) — фаза 'done'. */
  complete: () => void;

  /** Полный сброс к начальному состоянию (как startChat() очищает всё). */
  reset: () => void;

  /* --- Селекторы-помощники (производное состояние) --- */

  /** Текущий шаг сценария (undefined, если индекс за пределами — фаза done). */
  currentStep: () => ChatStep | undefined;
  /** Готов ли лид к отправке (заполнены обязательные поля формы + consent). */
  isSubmittable: () => boolean;
}

/** Начальное (пустое) состояние — общая точка для start/reset. */
const INITIAL: Pick<ChatState, 'stepIndex' | 'phase' | 'answers' | 'picked'> = {
  stepIndex: 0,
  phase: 'idle',
  answers: {},
  picked: [],
};

/**
 * Хук/стор chat-домена.
 *
 * Подписывайтесь селектором, чтобы избежать лишних ре-рендеров, напр.:
 *   const phase = useChatStore((s) => s.phase);
 *   const step  = useChatStore((s) => s.currentStep());
 *
 * Вне React используйте vanilla-API: useChatStore.getState() / .subscribe().
 */
export const useChatStore = create<ChatState>((set, get) => ({
  ...INITIAL,

  start: () =>
    set({
      stepIndex: 0,
      // 'thinking' — бот начинает «печатать» первый вопрос (как startChat()).
      phase: 'thinking',
      answers: {},
      picked: [],
    }),

  pick: (option) =>
    set((state) => {
      const step = CHAT_FLOW[state.stepIndex];
      // Защита: pick валиден только на существующем «quick»-шаге.
      if (!step || step.kind !== 'quick') return state;

      // Иммутабельно записываем ответ под ключ текущего шага.
      const answers: ChatAnswers = { ...state.answers, [step.key]: option.label };

      // Иммутабельно фиксируем выбранную опцию по индексу шага.
      const picked = state.picked.slice();
      picked[state.stepIndex] = option;

      const nextIndex = state.stepIndex + 1;
      const nextStep = CHAT_FLOW[nextIndex];

      return {
        answers,
        picked,
        stepIndex: nextIndex,
        // После выбора бот «печатает» следующий вопрос; если шагов больше нет —
        // оставляем thinking (UI доведёт до done после отправки). Для последнего
        // form-шага фаза станет 'form' через setPhase из UI после «печати».
        phase: nextStep ? 'thinking' : state.phase,
      };
    }),

  back: () =>
    set((state) => {
      if (state.stepIndex <= 0) return state;

      const prevIndex = state.stepIndex - 1;
      const prevStep = CHAT_FLOW[prevIndex];

      // Чистим ответ и выбор шага, на который возвращаемся.
      const answers: ChatAnswers = { ...state.answers };
      if (prevStep) delete answers[prevStep.key];

      const picked = state.picked.slice();
      picked[prevIndex] = undefined;

      return {
        stepIndex: prevIndex,
        answers,
        picked,
        // Возвращаемся к интерактивной фазе соответствующего шага.
        phase: prevStep?.kind === 'form' ? 'form' : 'quick',
      };
    }),

  setName: (name) =>
    set((state) => ({ answers: { ...state.answers, name } })),

  setMessenger: (messenger) =>
    set((state) => ({ answers: { ...state.answers, messenger } })),

  setContact: (contact) =>
    set((state) => ({ answers: { ...state.answers, contact } })),

  setConsent: (consent) =>
    set((state) => ({ answers: { ...state.answers, consent } })),

  setPhase: (phase) => set({ phase }),

  next: () =>
    set((state) => {
      const nextIndex = Math.min(state.stepIndex + 1, CHAT_STEP_COUNT);
      return { stepIndex: nextIndex };
    }),

  complete: () => set({ phase: 'done' }),

  reset: () => set({ ...INITIAL }),

  currentStep: () => CHAT_FLOW[get().stepIndex],

  isSubmittable: () => {
    const { name, contact, messenger, consent } = get().answers;
    return Boolean(
      name && name.trim() && contact && contact.trim() && messenger && consent,
    );
  },
}));
