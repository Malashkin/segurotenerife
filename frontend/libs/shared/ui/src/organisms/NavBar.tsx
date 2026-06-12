/**
 * Организм NavBar (Atomic Design → organisms) — оболочка верхней навигации.
 *
 * Sticky-шапка из прототипа /Users/mike/Desktop/fun/index.html (header.nav):
 * полупрозрачный фон с blur, бренд-локап слева, ссылки по центру, справа —
 * слот для переключателя языков и CTA-кнопки.
 *
 * Это «shell»: конкретный контент (бренд, список ссылок, LangSwitcher, CTA)
 * передаётся пропсами/слотами из widgets-слоя, чтобы shared/ui не зависел от
 * i18n и роутинга. На мобильных ссылки скрываются (как в прототипе) — мобильное
 * меню реализует widgets-слой при необходимости.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Описание навигационной ссылки. */
export interface NavLink {
  /** href/anchor (например, «#types»). */
  href: string;
  /** Видимый текст (уже локализованный). */
  label: ReactNode;
}

export interface NavBarProps {
  /** Бренд-локап слева (обычно <Brand />). */
  brand: ReactNode;
  /** Центральные навигационные ссылки (скрыты на мобильных). */
  links?: readonly NavLink[];
  /** Слот справа: переключатель языков, CTA-кнопка и т. п. */
  actions?: ReactNode;
  /** Доступная подпись для <nav> (локализованная). По умолчанию «Main». */
  navAriaLabel?: string;
  /** Дополнительные классы <header>. */
  className?: string;
}

/** Оболочка верхней навигации. */
export function NavBar({
  brand,
  links = [],
  actions,
  navAriaLabel = 'Main',
  className,
}: NavBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-gray-200 bg-gray-50/85 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1160px] items-center gap-4 px-5">
        {brand}

        {links.length > 0 && (
          <nav aria-label={navAriaLabel} className="ml-4 hidden gap-6 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded text-[0.95rem] font-medium text-gray-600 transition-colors hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {actions != null && <div className="ml-auto flex items-center gap-3.5">{actions}</div>}
      </div>
    </header>
  );
}
