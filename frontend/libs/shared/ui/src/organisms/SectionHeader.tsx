/**
 * Организм SectionHeader (Atomic Design → organisms).
 *
 * Заголовочный блок секции из прототипа /Users/mike/Desktop/fun/index.html
 * (.sec-head): эйбрау-бейдж, крупный H2 (Sora) и опциональный лид-абзац.
 * Может центрироваться (вариант `center` в прототипе).
 *
 * Контент (тексты) приходит пропсами — организм только верстает и отвечает за
 * семантику заголовка (уровень настраивается через `as`, по умолчанию h2).
 */
import type { ElementType, ReactNode } from 'react';
import { Badge } from '../atoms/Badge';
import { cn } from '../lib/cn';

export interface SectionHeaderProps {
  /** Текст эйбрау над заголовком (необязательно). */
  eyebrow?: ReactNode;
  /** Заголовок секции. */
  title: ReactNode;
  /** Подзаголовок/лид-абзац (необязательно). */
  subtitle?: ReactNode;
  /** Центрировать блок (как .center в прототипе). */
  centered?: boolean;
  /** Тег заголовка для корректной иерархии (h1/h2/h3). По умолчанию h2. */
  as?: ElementType;
  /** Дополнительные классы обёртки. */
  className?: string;
}

/** Заголовочный блок секции. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  centered = false,
  as: Heading = 'h2',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        centered && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow != null && (
        <Badge eyebrow className={centered ? 'mx-auto' : undefined}>
          {eyebrow}
        </Badge>
      )}
      <Heading
        className={cn(
          'mt-3.5 font-heading text-3xl font-bold leading-tight text-ink sm:text-4xl',
        )}
      >
        {title}
      </Heading>
      {subtitle != null && (
        <p className="mt-3 text-lg text-gray-600">{subtitle}</p>
      )}
    </div>
  );
}
