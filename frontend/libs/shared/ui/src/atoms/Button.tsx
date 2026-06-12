/**
 * Атом Button (Atomic Design → atoms).
 *
 * Shadcn-style примитив: варианты задаются через class-variance-authority (cva),
 * стили — через Tailwind-классы, ссылающиеся на бренд-токены из tailwind.preset.cjs.
 * Это базовая кнопка, которую переиспользуют molecules/organisms и фичи.
 *
 * Намеренно минимальный набор вариантов — контентные агенты расширят его при
 * необходимости (например `ghost`, размеры), не ломая публичный API.
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Варианты внешнего вида кнопки.
 * - variant: визуальный стиль (основная бренд-кнопка или нейтральная «призрачная»).
 * - size: размер (обычный / крупный для hero-CTA).
 */
const buttonVariants = cva(
  // Базовые классы — общие для всех вариантов.
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-dark',
        ghost: 'bg-white text-ink border border-gray-200 hover:border-brand hover:text-brand-dark',
      },
      size: {
        md: 'px-6 py-3.5 text-base',
        lg: 'px-7 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

/** Пропсы кнопки: нативные атрибуты <button> + варианты cva. */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/**
 * Базовая кнопка приложения.
 * forwardRef — чтобы фичи могли получить доступ к DOM-узлу (фокус, измерения).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
