/**
 * Hero-блок лендинга.
 *
 * Заголовок универсальный — «страховка под вашу ситуацию»: текст из `hero_h1`,
 * выделенное бренд-цветом слово — `hero_h1_hl` (без HTML в словаре).
 *
 * Дедуп (UX-обзор): пошаговая схема живёт ТОЛЬКО в секции «Как проходит подбор».
 * Правая карточка hero теперь — компактная панель «доверие + быстрый старт»
 * (заголовок + лид + trust-пойнты + кнопка), а не дубль шагов. CTA открывают
 * чат-попап (а не якорь на удалённую секцию #quiz).
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@shared/store';
import { buttonVariants, cn } from '@shared/ui';

/** Trust-пойнты (галочка + i18n-ключ) — показываем в правой карточке. */
const TRUST_KEYS = ['hero_trust1', 'hero_trust2', 'hero_trust3'] as const;

/**
 * Подсвечивает выделенное слово внутри заголовка (защита от рассинхрона переводов).
 */
function HighlightedHeadline({ full, highlight }: { full: string; highlight: string }): ReactNode {
  const idx = highlight ? full.indexOf(highlight) : -1;
  if (idx === -1) return <>{full}</>;
  const before = full.slice(0, idx);
  const after = full.slice(idx + highlight.length);
  return (
    <>
      {before}
      <span className="text-brand">{highlight}</span>
      {after}
    </>
  );
}

/** Главный экран: заголовок, подзаголовок, CTA и компактная карточка-панель. */
export function Hero() {
  const { t } = useTranslation();
  const openChat = useUiStore((s) => s.openChat);

  return (
    <section className="py-16 pb-10">
      <div className="mx-auto grid w-[min(1160px,calc(100vw-40px))] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Левая колонка: контент + CTA */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            {t('hero_eyebrow')}
          </span>

          <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
            <HighlightedHeadline full={t('hero_h1')} highlight={t('hero_h1_hl')} />
          </h1>

          <p className="mt-[18px] max-w-[46ch] text-lg text-slate">{t('hero_sub')}</p>

          <div className="mt-7 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={openChat}
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
            >
              {t('hero_cta1')}
            </button>
            <a href="#types" className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }))}>
              {t('hero_cta2')}
            </a>
          </div>
        </div>

        {/* Правая колонка: компактная панель «доверие + быстрый старт» */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-[26px] shadow-[0_24px_60px_rgba(13,148,136,0.16)]">
          <h2 className="font-heading text-lg font-bold text-ink">{t('hc_title')}</h2>
          <p className="mb-[18px] mt-1 text-[0.92rem] text-muted">{t('hc_lede')}</p>

          <ul className="grid gap-3">
            {TRUST_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3 text-[0.95rem] font-medium text-ink">
                <span
                  aria-hidden
                  className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-tint text-[0.8rem] font-extrabold text-brand-dark"
                >
                  ✓
                </span>
                {t(key)}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={openChat}
            className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 w-full')}
          >
            {t('hc_btn')}
          </button>
        </aside>
      </div>
    </section>
  );
}
