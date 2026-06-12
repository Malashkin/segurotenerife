/**
 * Публичный API библиотеки shared/store (FSD public API).
 *
 * Реэкспортирует доменные Zustand-сторы. Каждый домен — отдельный файл;
 * новые домены (chat, user, ...) добавляются строкой реэкспорта ниже.
 */
export { useUiStore } from './uiStore';

/**
 * Chat-домен: стор мастера чат-подбора (6 шагов из прототипа index.html),
 * структура сценария и доменные типы.
 */
export {
  useChatStore,
  CHAT_FLOW,
  CHAT_STEP_COUNT,
  DEFAULT_MESSENGER,
} from './chatStore';
export type {
  ChatState,
  ChatAnswers,
  ChatPhase,
  ChatStep,
  ChatStepKey,
  ChatStepKind,
  ChatMessenger,
  PickedOption,
} from './chatStore';
