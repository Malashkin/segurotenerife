/**
 * Секция «Виды страховки» — 9 карточек типов полисов.
 *
 * Портирована из секции `#types` прототипа /Users/mike/Desktop/fun/index.html.
 * Восемь карточек (медицинская для ВНЖ/визы, студенты, международная, стоматология,
 * с возмещением, жизнь, похоронная, питомцы) с эмодзи-иконкой, заголовком и
 * описанием. Вся карточка кликабельна и открывает чат-попап с релевантным
 * интентом (дедуп по UX-обзору: отдельный текст «Подобрать →» убран).
 *
 * Все тексты — через @shared/i18n (ключи c1_t..c8_d). Иконки-эмодзи берём 1:1
 * из прототипа (декоративные, помечены aria-hidden).
 */
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@shared/store';
import { SectionHead } from '../lib/SectionHead';

/**
 * Карточка типа страховки: эмодзи + ключи заголовка/описания + intent.
 * intent открывает чат с предвыбранным типом и релевантным вопросом
 * (для питомцев — «какой у вас питомец?»). Бизнес/autónomos пока не показываем.
 */
const TYPES: ReadonlyArray<{
  icon: string;
  titleKey: string;
  descKey: string;
  intent: string;
}> = [
  { icon: '🏥', titleKey: 'c1_t', descKey: 'c1_d', intent: 'med' },
  { icon: '🎓', titleKey: 'c2_t', descKey: 'c2_d', intent: 'student' },
  { icon: '✈️', titleKey: 'c3_t', descKey: 'c3_d', intent: 'travel' },
  { icon: '🦷', titleKey: 'c4_t', descKey: 'c4_d', intent: 'dental' },
  { icon: '💳', titleKey: 'c5_t', descKey: 'c5_d', intent: 'reembolso' },
  { icon: '🛡️', titleKey: 'c6_t', descKey: 'c6_d', intent: 'life' },
  { icon: '🕊️', titleKey: 'c7_t', descKey: 'c7_d', intent: 'decesos' },
  { icon: '🐾', titleKey: 'c8_t', descKey: 'c8_d', intent: 'pet' },
];

/** Сетка карточек видов страховки. Клик открывает чат с релевантным вопросом. */
export function InsuranceTypes() {
  const { t } = useTranslation();
  const openChatWithIntent = useUiStore((s) => s.openChatWithIntent);

  return (
    <section id="types" className="py-16">
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <SectionHead eyebrow={t('types_eyebrow')} title={t('types_h2')} subtitle={t('types_p')} />

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((type) => (
            <button
              key={type.titleKey}
              type="button"
              onClick={() => openChatWithIntent(type.intent)}
              className="group flex flex-col items-start gap-2.5 rounded-card border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-[3px] hover:border-[#cfeae6] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span
                aria-hidden
                className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-brand-tint text-[1.4rem]"
              >
                {type.icon}
              </span>
              {/* Вся карточка кликабельна → отдельный текст «Подобрать» убран
                  (дедуп); понятный hover: заголовок подсвечивается бренд-цветом. */}
              <h3 className="font-heading text-[1.14rem] font-bold text-ink transition-colors group-hover:text-brand-dark">
                {t(type.titleKey)}
              </h3>
              <p className="text-[0.94rem] text-muted">{t(type.descKey)}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
