/**
 * Hero-блок лендинга.
 *
 * Портирован из секции `.hero` прототипа /Users/mike/Desktop/fun/index.html.
 * Заголовок универсальный — «страховка под вашу ситуацию» (без «15 минут»):
 * текст берётся из ключа `hero_h1`, а выделенное бренд-цветом слово — из
 * `hero_h1_hl` (рендерится отдельным <span>, без HTML в словаре).
 *
 * Trust-пойнты включают «быстрый ответ менеджера» (НЕ «15 минут»). Справа —
 * карточка «Как это устроено» с 4 мини-шагами и CTA «Начать подбор».
 *
 * Все строки — через @shared/i18n. CTA ведут на якоря секций (#quiz, #types).
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants, cn } from '@shared/ui';

/** Trust-пойнты под CTA (галочка + i18n-ключ). */
const TRUST_KEYS = ['hero_trust1', 'hero_trust2', 'hero_trust3'] as const;

/** Мини-шаги в правой карточке: номер + заголовок + подпись. */
const MINI_STEPS: ReadonlyArray<{ titleKey: string; subKey: string }> = [
  { titleKey: 'hc_s1b', subKey: 'hc_s1s' },
  { titleKey: 'hc_s2b', subKey: 'hc_s2s' },
  { titleKey: 'hc_s3b', subKey: 'hc_s3s' },
  { titleKey: 'hc_s4b', subKey: 'hc_s4s' },
];

/**
 * Подсвечивает выделенное слово внутри заголовка.
 * Если выделенное слово (`hero_h1_hl`) встречается в полном заголовке, оборачиваем
 * именно его в бренд-цвет; иначе — показываем заголовок как есть (защита от
 * рассинхрона переводов).
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

/** Главный экран: заголовок, подзаголовок, CTA, trust-пойнты и карточка-схема. */
export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="py-16 pb-10">
      <div className="mx-auto grid w-[min(1160px,calc(100vw-40px))] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Левая колонка: контент */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            {t('hero_eyebrow')}
          </span>

          <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
            <HighlightedHeadline full={t('hero_h1')} highlight={t('hero_h1_hl')} />
          </h1>

          <p className="mt-[18px] max-w-[46ch] text-lg text-slate">{t('hero_sub')}</p>

          <div className="mt-7 flex flex-wrap gap-3.5">
            <a
              href="#quiz"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
            >
              {t('hero_cta1')}
            </a>
            <a
              href="#types"
              className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }))}
            >
              {t('hero_cta2')}
            </a>
          </div>

          <ul className="mt-[26px] flex flex-wrap gap-x-[22px] gap-y-2">
            {TRUST_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-2.5 text-[0.92rem] font-medium text-slate">
                <span aria-hidden className="font-extrabold text-brand">
                  ✓
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* Правая колонка: карточка «Как это устроено» */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-[26px] shadow-[0_24px_60px_rgba(13,148,136,0.16)]">
          <h2 className="font-heading text-lg font-bold text-ink">{t('hc_title')}</h2>
          <p className="mb-[18px] mt-1 text-[0.92rem] text-muted">{t('hc_lede')}</p>

          <ol className="grid gap-3">
            {MINI_STEPS.map((step, i) => (
              <li key={step.titleKey} className="flex items-start gap-3.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-brand-tint text-sm font-bold text-brand-dark">
                  {i + 1}
                </span>
                <span>
                  <b className="text-[0.96rem] text-ink">{t(step.titleKey)}</b>
                  <span className="block text-[0.86rem] text-muted">{t(step.subKey)}</span>
                </span>
              </li>
            ))}
          </ol>

          <a
            href="#quiz"
            className={cn(buttonVariants({ variant: 'primary' }), 'mt-5 w-full')}
          >
            {t('hc_btn')}
          </a>
        </aside>
      </div>
    </section>
  );
}
