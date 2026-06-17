/**
 * Определение и сохранение языка интерфейса.
 *
 * Логика портирована из прототипа (detectLang):
 *   1. Если в localStorage уже сохранён валидный выбор пользователя — берём его.
 *   2. Иначе перебираем языки браузера (navigator.languages) и маппим первый
 *      подходящий через BROWSER_LANG_MAP (be -> ru и т.д.).
 *   3. Если ничего не подошло — фоллбэк на en.
 *
 * Работает вне React-дерева, поэтому язык можно определить до рендера и до
 * инициализации i18next.
 */
import {
  BROWSER_LANG_MAP,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type AppLocale,
} from './config';

/** Проверяет, что строка — поддерживаемый код языка. */
function isSupported(value: string | null): value is AppLocale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Возвращает язык, который нужно показать пользователю при загрузке.
 * Приоритет: сохранённый выбор (localStorage) → язык браузера → фоллбэк.
 * Безопасно работает в окружениях без window (вернёт фоллбэк).
 *
 * Примечание: публичный сайт переехал на Astro — там язык задаётся URL-роутингом
 * (страницы по локалям), а острова инициализируют i18n явной локалью через
 * initI18n({ lng }). Эта функция используется для admin (SPA без локальных URL).
 */
export function detectLocale(): AppLocale {
  // Шаг 1: сохранённый выбор пользователя.
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSupported(saved)) return saved;
    } catch {
      // localStorage может быть недоступен (приватный режим) — молча идём дальше.
    }
  }

  // Шаг 2: смотрим на языки браузера и маппим первый подходящий.
  if (typeof navigator !== 'undefined') {
    const candidates =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language || FALLBACK_LOCALE];
    for (const lang of candidates) {
      const code = (lang || '').slice(0, 2).toLowerCase();
      const mapped = BROWSER_LANG_MAP[code];
      if (mapped) return mapped;
    }
  }

  // Шаг 3: ничего не подошло — базовый язык.
  return FALLBACK_LOCALE;
}

/**
 * Сохраняет выбор языка в localStorage, чтобы он пережил перезагрузку.
 * @param locale - выбранный пользователем язык
 */
export function persistLocale(locale: AppLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Не критично, если сохранить не удалось — выбор просто не переживёт перезагрузку.
  }
}
