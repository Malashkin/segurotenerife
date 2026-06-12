/**
 * Атом Badge (Atomic Design → atoms).
 *
 * Небольшая «капсула»-метка для статусов и эйбрау (eyebrow) над заголовками.
 * Портировано из прототипа /Users/mike/Desktop/fun/index.html
 * (.eyebrow / .art-tag / статусные плашки): бренд-тинт фон + бренд-тёмный текст,
 * аптуристый верхний регистр и трекинг.
 *
 * В отличие от Chip — Badge неинтерактивен (просто <span>), используется как
 * визуальный маркер, а не как кнопка выбора.
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Варианты бейджа.
 * - variant: цветовая семантика (brand — по умолчанию; neutral/success/warning
 *   для статусов в админке — список лидов).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        brand: 'bg-brand-tint text-brand-dark',
        neutral: 'bg-gray-100 text-gray-600',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber/15 text-amber',
      },
      /** uppercase + трекинг для эйбрау над секциями (как в прототипе). */
      eyebrow: {
        true: 'uppercase tracking-[0.08em]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'brand',
      eyebrow: false,
    },
  },
);

/** Пропсы бейджа: нативные атрибуты <span> + варианты cva. */
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** Неинтерактивная метка-капсула. */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, eyebrow, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, eyebrow }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';

export { badgeVariants };
