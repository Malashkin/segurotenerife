/**
 * Публичный API библиотеки shared/i18n (FSD public API).
 *
 * Приложения импортируют отсюда:
 *   - initI18n()      — вызвать один раз в app-слое перед рендером.
 *   - useLang()       — реактивный текущий язык + сеттер для переключателя.
 *   - changeLang() / changeLocale() — переключение языка (с персистом).
 *   - LOCALE_ORDER / LOCALE_LABELS — для рендера кнопок переключателя.
 *   - CHAT_FLOW       — 6-шаговый сценарий чата подбора страховки.
 *
 * useTranslation/Trans берутся напрямую из 'react-i18next' в компонентах —
 * их не нужно реэкспортировать здесь.
 */
export {
  type AppLocale,
  LOCALE_ORDER,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
} from './config';

export { detectLocale, persistLocale } from './detect';

export {
  resources,
  NAMESPACES,
  DEFAULT_NAMESPACE,
  type TranslationDict,
  type LocaleResources,
} from './resources';

export { initI18n, changeLocale, getCurrentLocale, i18n } from './init';

// React-хелперы языка (переключатель в шапке).
export { useLang, changeLang, type UseLangResult } from './useLang';

// Сценарий чат-подбора (6 шагов) — для chat-виджета в libs/widgets.
export {
  CHAT_FLOW,
  FLOW_STEPS_TOTAL,
  FLOW_LANG_TO_LOCALE,
  type FlowStep,
  type FlowOption,
  type FlowStepKind,
} from './flow';
