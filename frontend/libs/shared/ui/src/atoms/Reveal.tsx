/**
 * Reveal — мягкое появление блока (CSS-усиление, без скрытия контента).
 *
 * Раньше блок прятался через opacity-0 до попадания в зону видимости
 * (IntersectionObserver). Это рисково для SEO/без-JS (контент скрыт до
 * срабатывания JS) и могло оставлять страницу «пустой». Теперь контент ВИДИМ
 * по умолчанию, а появление — чистая CSS-анимация (motion-safe), которая
 * завершается в видимом состоянии. Краулеры и пользователи без JS/с
 * prefers-reduced-motion всегда видят контент.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface RevealProps {
  children: ReactNode;
  /** Доп. классы внешнего контейнера. */
  className?: string;
}

export function Reveal({ children, className }: RevealProps): JSX.Element {
  return <div className={cn('motion-safe:animate-fadeInUp', className)}>{children}</div>;
}
