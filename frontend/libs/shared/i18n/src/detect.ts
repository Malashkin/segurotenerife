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
 * Язык по умолчанию для «голого» URL (`/`). Это основная аудитория (RU) и язык,
 * которым пререндерится корневой index.html. Отличается от FALLBACK_LOCALE (en),
 * который используется лишь как фоллбэк для отсутствующих ключей перевода.
 */
export const DEFAULT_URL_LOCALE: AppLocale = 'ru';

/**
 * Достаёт локаль из префикса пути: `/es`, `/uk/...`, `/en` → код языка.
 * Корень `/` (или путь без языкового префикса) → null (язык по умолчанию).
 * RU специально БЕЗ префикса: `/` — это русская (каноническая) версия.
 */
export function localeFromPath(pathname: string): AppLocale | null {
  const seg = pathname.replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? '';
  if (seg === 'ru') return null; // /ru не используем — русская версия живёт на `/`
  return isSupported(seg) ? seg : null;
}

/**
 * Строит путь для локали, сохраняя «хвост» пути, query и hash.
 * RU → без префикса (`/…`); остальные → `/<locale>/…`.
 */
export function pathForLocale(
  locale: AppLocale,
  loc: { pathname: string; search: string; hash: string },
): string {
  const current = localeFromPath(loc.pathname);
  let rest = loc.pathname;
  if (current) rest = rest.replace(new RegExp(`^/${current}(?=/|$)`), '');
  if (!rest.startsWith('/')) rest = `/${rest}`;
  const base = locale === DEFAULT_URL_LOCALE ? rest : `/${locale}${rest === '/' ? '/' : rest}`;
  return `${base}${loc.search}${loc.hash}`;
}

/**
 * Возвращает язык, который нужно показать пользователю при загрузке.
 * Приоритет: префикс URL (авторитетен для SEO) → сохранённый выбор → язык
 * браузера → язык по умолчанию (RU). Безопасно работает без window (вернёт RU).
 */
export function detectLocale(): AppLocale {
  // Шаг 0: язык из URL-префикса важнее всего — он должен совпадать с контентом
  // (иначе hreflang/canonical будут «врать»).
  if (typeof window !== 'undefined') {
    const fromPath = localeFromPath(window.location.pathname);
    if (fromPath) return fromPath;
  }

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

  // Шаг 3: ничего не подошло — язык по умолчанию для корня (RU).
  return DEFAULT_URL_LOCALE;
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
