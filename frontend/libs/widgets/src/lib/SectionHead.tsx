/**
 * Внутренний помощник widgets: заголовок секции (eyebrow + h2 + подзаголовок).
 *
 * Повторяется почти во всех блоках лендинга (InsuranceTypes, HowItWorks,
 * Articles, Faq). Вынесен сюда, чтобы не дублировать разметку и держать
 * единый ритм отступов/типографики. НЕ часть публичного API — используется
 * только внутри слоя widgets.
 *
 * Тексты приходят уже переведёнными (вызывающий виджет дёргает t()).
 */
import type { ReactNode } from 'react';
import { cn } from '@shared/ui';

export interface SectionHeadProps {
  /** Надпись-«бровка» над заголовком (UPPERCASE-пилюля). */
  eyebrow: string;
  /** Основной заголовок секции. */
  title: string;
  /** Необязательный подзаголовок/описание. */
  subtitle?: string;
  /** Центрировать содержимое (для секций «Как это работает», FAQ). */
  centered?: boolean;
}

/** Шапка секции лендинга: бровка, заголовок и описание. */
export function SectionHead({ eyebrow, title, subtitle, centered = false }: SectionHeadProps): ReactNode {
  return (
    <div className={cn('mb-9 max-w-2xl', centered && 'mx-auto text-center')}>
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
        {eyebrow}
      </span>
      <h2 className="mt-3.5 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-lg text-slate">{subtitle}</p> : null}
    </div>
  );
}
