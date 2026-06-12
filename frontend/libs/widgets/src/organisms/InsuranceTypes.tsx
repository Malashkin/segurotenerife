/**
 * Секция «Виды страховки» — 9 карточек типов полисов.
 *
 * Портирована из секции `#types` прототипа /Users/mike/Desktop/fun/index.html.
 * Девять карточек (медицинская для ВНЖ/визы, студенты, международная, стоматология,
 * с возмещением, жизнь, похоронная, питомцы, бизнес) с эмодзи-иконкой, заголовком,
 * описанием и ссылкой «Подобрать →» на секцию подбора (#quiz).
 *
 * Все тексты — через @shared/i18n (ключи c1_t..c9_d, ins_pick). Иконки-эмодзи
 * берём 1:1 из прототипа (декоративные, помечены aria-hidden).
 */
import { useTranslation } from 'react-i18next';
import { SectionHead } from '../lib/SectionHead';

/** Карточка типа страховки: эмодзи + ключи заголовка/описания. */
const TYPES: ReadonlyArray<{ icon: string; titleKey: string; descKey: string }> = [
  { icon: '🏥', titleKey: 'c1_t', descKey: 'c1_d' },
  { icon: '🎓', titleKey: 'c2_t', descKey: 'c2_d' },
  { icon: '✈️', titleKey: 'c3_t', descKey: 'c3_d' },
  { icon: '🦷', titleKey: 'c4_t', descKey: 'c4_d' },
  { icon: '💳', titleKey: 'c5_t', descKey: 'c5_d' },
  { icon: '🛡️', titleKey: 'c6_t', descKey: 'c6_d' },
  { icon: '🕊️', titleKey: 'c7_t', descKey: 'c7_d' },
  { icon: '🐾', titleKey: 'c8_t', descKey: 'c8_d' },
  { icon: '💼', titleKey: 'c9_t', descKey: 'c9_d' },
];

/** Сетка карточек видов страховки. */
export function InsuranceTypes() {
  const { t } = useTranslation();

  return (
    <section id="types" className="py-16">
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <SectionHead eyebrow={t('types_eyebrow')} title={t('types_h2')} subtitle={t('types_p')} />

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((type) => (
            <a
              key={type.titleKey}
              href="#quiz"
              className="flex flex-col gap-2.5 rounded-card border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-[3px] hover:border-[#cfeae6] hover:shadow-md"
            >
              <span
                aria-hidden
                className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-brand-tint text-[1.4rem]"
              >
                {type.icon}
              </span>
              <h3 className="font-heading text-[1.14rem] font-bold text-ink">{t(type.titleKey)}</h3>
              <p className="text-[0.94rem] text-muted">{t(type.descKey)}</p>
              <span className="mt-auto pt-2 text-[0.9rem] font-semibold text-brand-dark">
                {t('ins_pick')}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
