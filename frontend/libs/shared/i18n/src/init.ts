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
import {
  DEFAULT_URL_LOCALE,
  detectLocale,
  localeFromPath,
  pathForLocale,
  persistLocale,
} from './detect';

/**
 * Приводит URL в соответствие активному языку (RU → `/`, остальные → `/<l>/…`).
 * @param replace - true: replaceState (старт, без записи в историю);
 *                  false: pushState (явная смена языка пользователем).
 */
function syncUrlToLocale(locale: AppLocale, replace: boolean): void {
  if (typeof window === 'undefined') return;
  const next = pathForLocale(locale, window.location);
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
}

/** Опции инициализации i18n. */
export interface InitI18nOptions {
  /** Явный стартовый язык. Если не задан — определяется detectLocale(). */
  lng?: AppLocale;
  /**
   * Выравнивать ли URL под активный язык на старте (replaceState).
   * SPA (Vite): true по умолчанию (язык в localStorage → префикс пути).
   * Astro: false — язык задаётся самим URL/страницей, трогать адрес нельзя.
   */
  syncUrl?: boolean;
}

/**
 * Инициализирует и возвращает общий инстанс i18next.
 * Идемпотентна: повторный вызов лишь переключит язык (если задан `lng`).
 *
 * @returns настроенный инстанс i18next (тот же `i18n` из пакета i18next)
 */
export function initI18n(opts: InitI18nOptions = {}): I18nInstance {
  // Уже инициализирован (в т.ч. другим островом Astro) — только язык.
  if (i18n.isInitialized) {
    if (opts.lng && i18n.language !== opts.lng) void i18n.changeLanguage(opts.lng);
    return i18n;
  }

  void i18n.use(initReactI18next).init({
    resources,
    lng: opts.lng ?? detectLocale(),
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

  // Приводим URL к активному языку на старте (только если просили — SPA).
  // В Astro адрес авторитетен (per-locale страницы), поэтому syncUrl=false.
  if (opts.syncUrl !== false && typeof window !== 'undefined') {
    const active = (i18n.language as AppLocale) ?? DEFAULT_URL_LOCALE;
    const urlLocale = localeFromPath(window.location.pathname) ?? DEFAULT_URL_LOCALE;
    if (urlLocale !== active) syncUrlToLocale(active, true);
  }

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
  // Обновляем URL (pushState), чтобы выбор языка отражался в адресе: ссылка
  // становится шарабельной, а перезагрузка отдаст правильную пререндер-версию.
  syncUrlToLocale(locale, false);
}

/** Текущий активный язык приложения (узкий тип AppLocale). */
export function getCurrentLocale(): AppLocale {
  return (i18n.language as AppLocale) ?? FALLBACK_LOCALE;
}

export { i18n };
