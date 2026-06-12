/**
 * Инициализация i18next + react-i18next для приложений Seguro Tenerife.
 *
 * Здесь живёт ЕДИНАЯ точка инициализации i18n для всего фронтенда. И web,
 * и admin вызывают `initI18n()` один раз на старте (в app-слое), после чего
 * используют хук `useTranslation` из react-i18next.
 *
 * Решения:
 * - Стартовый язык определяется `detectLocale()` (localStorage -> браузер -> en).
 * - Фоллбэк — en (показываем базовый язык, а не пустую строку).
 * - `escapeValue: false` у interpolation — React сам экранирует значения в JSX,
 *   двойное экранирование тут не нужно.
 * - Ресурсы переводов пока пустые (см. resources.ts) — контент добавят позже.
 */
import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_NAMESPACE,
  NAMESPACES,
  resources,
} from './resources';
import { FALLBACK_LOCALE, SUPPORTED_LOCALES, type AppLocale } from './config';
import { detectLocale, persistLocale } from './detect';

/** Флаг, чтобы повторные вызовы initI18n не реинициализировали инстанс. */
let initialized = false;

/**
 * Инициализирует и возвращает общий инстанс i18next.
 * Идемпотентна: повторный вызов вернёт уже готовый инстанс.
 *
 * @returns настроенный инстанс i18next (тот же `i18n` из пакета i18next)
 */
export function initI18n(): I18nInstance {
  if (initialized) return i18n;

  void i18n.use(initReactI18next).init({
    resources,
    lng: detectLocale(),
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    interpolation: {
      // React экранирует значения сам — отключаем экранирование i18next.
      escapeValue: false,
    },
    // Не падать в проде, если ключ отсутствует — вернётся ключ/фоллбэк.
    returnNull: false,
  });

  // Держим <html lang> в синхронизации с активным языком (важно для SEO и a11y).
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.language;
    i18n.on('languageChanged', (lng) => {
      document.documentElement.lang = lng;
    });
  }

  initialized = true;
  return i18n;
}

/**
 * Переключает язык приложения и сохраняет выбор в localStorage.
 * Используется переключателем языков в шапке.
 *
 * @param locale - целевой язык (en | es | uk | ru)
 */
export async function changeLocale(locale: AppLocale): Promise<void> {
  persistLocale(locale);
  await i18n.changeLanguage(locale);
}

/** Текущий активный язык приложения (узкий тип AppLocale). */
export function getCurrentLocale(): AppLocale {
  return (i18n.language as AppLocale) ?? FALLBACK_LOCALE;
}

export { i18n };
