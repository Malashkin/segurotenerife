/**
 * Молекула LangSwitcher (Atomic Design → molecules).
 *
 * Переключатель языков-«пилюля» из прототипа /Users/mike/Desktop/fun/index.html
 * (.langs): ряд капсул EN/ES/UA/RU, активная заливается брендом.
 *
 * ВАЖНО — развязка слоёв: shared/ui НЕ зависит от shared/i18n. Порядок и подписи
 * языков передаются пропсами `locales` (например, из LOCALE_ORDER) и `labels`
 * (например, LOCALE_LABELS, где uk → «UA»). Текущий язык и колбэк смены —
 * тоже пропсы. Это держит UI-библиотеку чистой и переиспользуемой/тестируемой.
 *
 * Доступность: role="group" с подписью, активная кнопка помечена aria-pressed,
 * фокус виден (focus-visible ring). Управление с клавиатуры — нативное (Tab).
 */
import { cn } from '../lib/cn';

export interface LangSwitcherProps<TLocale extends string = string> {
  /** Список кодов языков в порядке отображения (например, LOCALE_ORDER). */
  locales: readonly TLocale[];
  /** Подписи кнопок по коду языка (например, LOCALE_LABELS: uk → «UA»). */
  labels: Record<TLocale, string>;
  /** Текущий выбранный язык. */
  current: TLocale;
  /** Колбэк смены языка. */
  onChange: (locale: TLocale) => void;
  /** Доступная подпись группы (локализованное «Язык»). По умолчанию «Language». */
  ariaLabel?: string;
  /** Дополнительные классы контейнера. */
  className?: string;
}

/** Переключатель языков (EN/ES/UA/RU). */
export function LangSwitcher<TLocale extends string = string>({
  locales,
  labels,
  current,
  onChange,
  ariaLabel = 'Language',
  className,
}: LangSwitcherProps<TLocale>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex gap-1 rounded-full border border-gray-200 bg-white p-1',
        className,
      )}
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            onClick={() => onChange(locale)}
            className={cn(
              'rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              active ? 'bg-brand text-white' : 'text-muted hover:text-brand-dark',
            )}
          >
            {labels[locale]}
          </button>
        );
      })}
    </div>
  );
}
