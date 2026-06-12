/**
 * Атом Input (Atomic Design → atoms).
 *
 * Базовое текстовое поле в стиле shadcn/ui: нейтральная рамка, бренд-обводка
 * при фокусе, корректная доступность (наследует все нативные атрибуты <input>,
 * включая `aria-*`, `id`, `required`). Подписи/ошибки добавляет молекула
 * FieldRow — сам Input остаётся «глупым» примитивом.
 *
 * Стили портированы из прототипа /Users/mike/Desktop/fun/index.html (.field input).
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Пропсы поля ввода.
 * - invalid: визуально подсветить поле как ошибочное (рамка краснеет).
 *   Семантику для скринридеров (`aria-invalid`) выставляет вызывающий код /
 *   FieldRow, чтобы не дублировать логику.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Подсветить поле как невалидное. */
  invalid?: boolean;
}

/**
 * Текстовое поле приложения.
 * forwardRef — чтобы формы (react-hook-form и т. п.) могли управлять фокусом.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        // Базовый вид: мобайл-фёрст, крупная зона нажатия, читаемый текст.
        'w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-ink',
        'placeholder:text-muted transition-colors',
        // Фокус: бренд-обводка вместо системной (доступно и в тон бренду).
        'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        'disabled:cursor-not-allowed disabled:opacity-60',
        // Ошибка: красная рамка + красная обводка при фокусе.
        invalid && 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-400/40',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
