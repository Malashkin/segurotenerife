/**
 * Билд-тайм переводчик для .astro-компонентов.
 *
 * Берёт те же словари (resources из @shared/i18n, namespace `common`), что и
 * React-приложение, поэтому тексты статичных секций попадают прямо в HTML на
 * этапе сборки (это и есть SEO-выигрыш — контент в выдаче, а не после JS).
 * Острова (React) продолжают использовать i18next независимо.
 */
import { resources, FALLBACK_LOCALE, type AppLocale } from '@shared/i18n';

export type Translator = (key: string) => string;

/** Возвращает t(key) для локали с фоллбэком на базовый язык, затем на сам ключ. */
export function getT(locale: AppLocale): Translator {
  const dict = (resources[locale]?.common ?? {}) as Record<string, string>;
  const fallback = (resources[FALLBACK_LOCALE]?.common ?? {}) as Record<string, string>;
  return (key) => dict[key] ?? fallback[key] ?? key;
}

/** Прямой доступ к словарю локали (для сборки JSON-LD FAQPage и т.п.). */
export function dictFor(locale: AppLocale): Record<string, string> {
  return (resources[locale]?.common ?? {}) as Record<string, string>;
}
