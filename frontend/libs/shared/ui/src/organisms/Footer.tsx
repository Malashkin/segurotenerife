/**
 * Организм Footer (Atomic Design → organisms) — оболочка подвала.
 *
 * Тёмный многоколоночный футер из прототипа /Users/mike/Desktop/fun/index.html
 * (footer): бренд-локап + дисклеймер в первой колонке, далее колонки ссылок,
 * нижняя строка с копирайтом и локацией.
 *
 * ВАЖНО (требование продукта): дисклеймер обязателен — сервис информационный,
 * НЕ страховая и НЕ брокер; заявки идут в лицензированный офис-партнёр. Текст
 * приходит пропсом `disclaimer` (локализованный), но место под него
 * предусмотрено всегда.
 *
 * Это «shell»: бренд, колонки ссылок и тексты передаются из widgets-слоя,
 * чтобы shared/ui оставался независимым от i18n/роутинга.
 */
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Колонка ссылок в футере. */
export interface FooterColumn {
  /** Заголовок колонки (локализованный). */
  title: ReactNode;
  /** Ссылки колонки. */
  links: ReadonlyArray<{ href: string; label: ReactNode }>;
}

export interface FooterProps {
  /** Бренд-локап (обычно <Brand tone="light" />). */
  brand: ReactNode;
  /**
   * Обязательный дисклеймер: информационный сервис, не страховая/брокер,
   * заявки — в лицензированный офис-партнёр. Локализованный текст.
   */
  disclaimer: ReactNode;
  /** Колонки ссылок (страховки, сайт, правовое). */
  columns?: readonly FooterColumn[];
  /** Строка копирайта слева внизу (локализованная). */
  copyright?: ReactNode;
  /** Текст справа внизу (например, «Tenerife, Islas Canarias, España»). */
  locationLabel?: ReactNode;
  /** Дополнительные классы <footer>. */
  className?: string;
}

/** Оболочка подвала. */
export function Footer({
  brand,
  disclaimer,
  columns = [],
  copyright,
  locationLabel = 'Tenerife, Islas Canarias, España',
  className,
}: FooterProps) {
  return (
    <footer className={cn('mt-16 bg-[#0b1220] pb-8 pt-14 text-gray-300', className)}>
      <div className="mx-auto w-full max-w-[1160px] px-5">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Колонка бренда + обязательный дисклеймер. */}
          <div>
            <div className="mb-3.5">{brand}</div>
            <p className="max-w-[40ch] text-[0.82rem] leading-relaxed text-gray-500">
              {disclaimer}
            </p>
          </div>

          {/* Колонки ссылок. */}
          {columns.map((col, i) => (
            <nav key={i} aria-label={typeof col.title === 'string' ? col.title : undefined}>
              <h4 className="mb-3.5 font-heading text-base text-white">{col.title}</h4>
              {col.links.map((link, j) => (
                <a
                  key={j}
                  href={link.href}
                  className="block rounded py-1 text-[0.92rem] text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>

        {/* Нижняя строка: копирайт + локация. */}
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-gray-800 pt-5 text-[0.82rem] text-gray-500">
          {copyright != null && <span>{copyright}</span>}
          <span>{locationLabel}</span>
        </div>
      </div>
    </footer>
  );
}
