/**
 * Секция «Как проходит подбор» — 4 шага.
 *
 * Портирована из секции `#how` (`.how`) прототипа
 * /Users/mike/Desktop/fun/index.html. Четыре нумерованные карточки:
 * отвечаете на вопросы → подбираем менеджера → менеджер пишет вам →
 * расчёт и оформление.
 *
 * Все тексты — через @shared/i18n (hw1_t..hw4_p). Заголовок секции центрирован,
 * фон — мягкий бренд-градиент (как в прототипе).
 */
import { useTranslation } from 'react-i18next';
import { SectionHead } from '../lib/SectionHead';

/** Шаг процесса: номер «01..04» + ключи заголовка/описания. */
const STEPS: ReadonlyArray<{ n: string; titleKey: string; descKey: string }> = [
  { n: '01', titleKey: 'hw1_t', descKey: 'hw1_p' },
  { n: '02', titleKey: 'hw2_t', descKey: 'hw2_p' },
  { n: '03', titleKey: 'hw3_t', descKey: 'hw3_p' },
  { n: '04', titleKey: 'hw4_t', descKey: 'hw4_p' },
];

/** Блок из 4 шагов процесса подбора. */
export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how" className="bg-gradient-to-b from-brand-tint2 to-white py-16">
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <SectionHead eyebrow={t('how_eyebrow')} title={t('how_h2')} subtitle={t('how_p')} centered />

        <ol className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-card border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="font-heading text-2xl font-extrabold text-brand">{step.n}</div>
              <h3 className="mb-1.5 mt-2.5 font-heading text-[1.08rem] font-bold text-ink">
                {t(step.titleKey)}
              </h3>
              <p className="text-[0.92rem] text-muted">{t(step.descKey)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
