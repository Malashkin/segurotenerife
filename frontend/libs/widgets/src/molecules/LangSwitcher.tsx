/**
 * Переключатель языков (EN · ES · UA · RU).
 *
 * Портирован из блока `.langs` прототипа /Users/mike/Desktop/fun/index.html.
 * Порядок кнопок строго EN, ES, UA, RU (LOCALE_ORDER из @shared/i18n).
 * Украинский подписан «UA», но внутренний код языка — `uk`.
 *
 * Поведение:
 * - переключение через changeLocale() (персистит выбор в localStorage и
 *   меняет язык i18next — детект/персист реализованы в shared/i18n);
 * - активная кнопка подсвечивается бренд-цветом;
 * - доступность: role="group" + aria-label, у каждой кнопки aria-pressed.
 */
import { useTranslation } from 'react-i18next';
import {
  LOCALE_ORDER,
  LOCALE_LABELS,
  changeLocale,
  getCurrentLocale,
  type AppLocale,
} from '@shared/i18n';
import { cn } from '@shared/ui';

export interface LangSwitcherProps {
  /** Доп. классы для внешнего контейнера. */
  className?: string;
}

/** Сегментированный переключатель из 4 языков в порядке EN, ES, UA, RU. */
export function LangSwitcher({ className }: LangSwitcherProps) {
  // i18n из useTranslation нужен, чтобы компонент перерисовывался при смене языка
  // (подписка на languageChanged). Текущий язык читаем через getCurrentLocale.
  const { i18n } = useTranslation();
  const current = getCurrentLocale();

  // Явно используем i18n.language как зависимость подписки (избегаем «висячего» значения).
  void i18n.language;

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        'flex gap-1 rounded-full border border-slate-200 bg-white p-1',
        className,
      )}
    >
      {LOCALE_ORDER.map((locale: AppLocale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={active}
            onClick={() => {
              // changeLocale асинхронна; выбор персистится внутри неё.
              void changeLocale(locale);
            }}
            className={cn(
              'cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              active
                ? 'bg-brand text-white'
                : 'text-muted hover:text-brand-dark',
            )}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
