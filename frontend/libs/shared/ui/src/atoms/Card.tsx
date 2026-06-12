/**
 * Атом Card (Atomic Design → atoms).
 *
 * Базовая карточка-контейнер: белый фон, мягкая рамка, скруглённые углы и
 * тень — «спокойная» поверхность для блоков контента (виды страховок, статьи,
 * чат-виджет). Портировано из прототипа /Users/mike/Desktop/fun/index.html
 * (.ins-card / .art-card / общие поверхности).
 *
 * Поставляется небольшим набором подкомпонентов (CardHeader/Title/Content) в
 * стиле shadcn/ui — их можно комбинировать, но они не обязательны.
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Варианты тени/наведения карточки.
 * - elevation: глубина тени (sm — статичные блоки, md — приподнятые).
 * - interactive: добавить hover-эффект подъёма (для кликабельных карточек).
 */
const cardVariants = cva('rounded-card border border-gray-200 bg-white text-ink', {
  variants: {
    elevation: {
      sm: 'shadow-sm',
      md: 'shadow-md',
    },
    interactive: {
      true: 'transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md',
      false: '',
    },
  },
  defaultVariants: {
    elevation: 'sm',
    interactive: false,
  },
});

/** Пропсы карточки: нативные атрибуты <div> + варианты cva. */
export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/** Контейнер-карточка. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ elevation, interactive }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

/** Шапка карточки (отступы + вертикальный ритм). */
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

/** Заголовок карточки (heading-шрифт Sora). */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-heading text-lg font-semibold leading-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

/** Тело карточки (контент с отступами). */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0 text-muted', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export { cardVariants };
