/**
 * Организм Brand (Atomic Design → organisms / shared brand lockup).
 *
 * Логотип-локап «ST» + название Seguro Tenerife из прототипа
 * /Users/mike/Desktop/fun/index.html (.logo / .foot-logo): квадратная марка с
 * бренд-градиентом и подпись. Переиспользуется в NavBar и Footer, поэтому вынесен
 * отдельным компонентом.
 *
 * `tone` переключает цвет текста: light — для тёмного футера, dark — для светлой шапки.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface BrandProps {
  /** Подпись под названием (например, локализованное «Подбор страховки · Тенерифе»). */
  subtitle?: ReactNode;
  /** Цветовая схема текста: dark (по умолчанию) для светлого фона, light для тёмного. */
  tone?: 'dark' | 'light';
  /** href логотипа (по умолчанию «/»). */
  href?: string;
  /** Дополнительные классы. */
  className?: string;
}

/** Логотип-локап Seguro Tenerife. */
export function Brand({ subtitle, tone = 'dark', href = '/', className }: BrandProps) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 font-heading text-lg font-bold',
        'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        tone === 'light' ? 'text-white' : 'text-ink',
        className,
      )}
    >
      {/* Квадратная марка с бренд-градиентом. */}
      <span
        aria-hidden="true"
        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-brand to-sky text-sm font-extrabold text-white"
      >
        ST
      </span>
      <span className="leading-tight">
        Seguro Tenerife
        {subtitle != null && (
          <small className="block font-sans text-[0.68rem] font-medium tracking-[0.04em] text-muted">
            {subtitle}
          </small>
        )}
      </span>
    </a>
  );
}
