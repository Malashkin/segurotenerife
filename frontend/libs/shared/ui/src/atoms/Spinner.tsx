/**
 * Атом Spinner (Atomic Design → atoms).
 *
 * Кольцевой индикатор загрузки для шага «Подбираем менеджера…» в чат-флоу
 * (.spinner в прототипе /Users/mike/Desktop/fun/index.html): бренд-тинт кольцо
 * с бренд-цветной активной дугой, бесконечное вращение.
 *
 * Доступность: role="status" + визуально скрытая подпись (`label`), чтобы
 * скринридеры объявили состояние загрузки. Анимация — стандартный
 * `animate-spin` Tailwind.
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/** Размеры спиннера. */
const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-brand-tint border-t-brand',
  {
    variants: {
      size: {
        sm: 'h-5 w-5 border-2',
        md: 'h-8 w-8 border-[3px]',
        lg: 'h-[54px] w-[54px] border-[5px]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** Пропсы спиннера. */
export interface SpinnerProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  /** Текст для скринридеров (по умолчанию «Loading…»). */
  label?: string;
}

/** Кольцевой индикатор загрузки. */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size, label = 'Loading…', ...props }, ref) => (
    <span ref={ref} role="status" className={cn('inline-flex', className)} {...props}>
      <span className={spinnerVariants({ size })} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  ),
);
Spinner.displayName = 'Spinner';

/**
 * Атом TypingDots — три «прыгающие» точки печатающего бота
 * (.msg.typing в прототипе). Используется в чат-пузыре, пока бот «печатает».
 *
 * Анимация задержки точек задаётся inline-стилем `animationDelay` (Tailwind
 * `animate-bounce` един для всех; смещаем фазу через delay).
 */
export interface TypingDotsProps extends HTMLAttributes<HTMLSpanElement> {
  /** Текст для скринридеров (по умолчанию «Typing…»). */
  label?: string;
}

export const TypingDots = forwardRef<HTMLSpanElement, TypingDotsProps>(
  ({ className, label = 'Typing…', ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    >
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-[7px] w-[7px] animate-bounce rounded-full bg-gray-300"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  ),
);
TypingDots.displayName = 'TypingDots';

export { spinnerVariants };
