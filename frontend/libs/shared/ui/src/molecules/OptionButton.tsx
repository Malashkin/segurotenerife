/**
 * Молекула OptionButton (Atomic Design → molecules).
 *
 * Крупная кнопка-вариант ответа в чат-флоу (.opt в прототипе
 * /Users/mike/Desktop/fun/index.html): эмодзи слева, текст варианта, выравнивание
 * по левому краю, бренд-обводка и лёгкий подъём при наведении.
 *
 * Используется на шагах квиза «язык / цель / кто / срочность» как одиночный
 * выбор. Поддерживает состояние `selected` (aria-pressed) для подсветки выбора.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Эмодзи/иконка слева (необязательно). */
  emoji?: ReactNode;
  /** Вариант выбран (подсветка + aria-pressed). */
  selected?: boolean;
}

/** Кнопка-вариант ответа на шаге квиза. */
export const OptionButton = forwardRef<HTMLButtonElement, OptionButtonProps>(
  ({ className, emoji, selected = false, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-[1.5px] px-[18px] py-4 text-left text-base font-medium text-ink',
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected
          ? 'border-brand bg-brand-tint2 -translate-y-px'
          : 'border-gray-200 bg-white hover:-translate-y-px hover:border-brand hover:bg-brand-tint2',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {emoji != null && (
        <span aria-hidden="true" className="text-xl leading-none">
          {emoji}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </button>
  ),
);
OptionButton.displayName = 'OptionButton';
