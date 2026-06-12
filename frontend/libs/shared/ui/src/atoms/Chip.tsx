/**
 * Атом Chip (Atomic Design → atoms).
 *
 * Интерактивная «таблетка» — быстрые ответы в чате (.quick button в прототипе
 * /Users/mike/Desktop/fun/index.html). В отличие от Badge это настоящая <button>:
 * бренд-обводка, при наведении/выборе заливается брендом.
 *
 * Используется в чат-флоу как быстрый выбор варианта и может работать как
 * toggle (проп `selected` + `aria-pressed`).
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Пропсы чипа: нативные атрибуты <button> + состояние выбора. */
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Чип выбран/активен (заливается брендом, ставит aria-pressed). */
  selected?: boolean;
}

/** Интерактивная таблетка быстрого выбора. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected = false, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand px-4 py-2 text-sm font-semibold',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
        selected
          ? 'bg-brand text-white'
          : 'bg-white text-brand-dark hover:bg-brand hover:text-white',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Chip.displayName = 'Chip';
