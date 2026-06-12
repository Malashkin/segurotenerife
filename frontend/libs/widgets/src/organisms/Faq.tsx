/**
 * Секция FAQ — аккордеон из 6 вопросов.
 *
 * Портирована из секции `#faq` прототипа /Users/mike/Desktop/fun/index.html.
 * Шесть пар вопрос/ответ (ключи faq1..faq6). Поведение прототипа: открыт
 * максимум один пункт за раз (клик по открытому — закрывает).
 *
 * Доступность:
 * - каждый вопрос — <button> с aria-expanded и aria-controls;
 * - панель ответа связана с кнопкой через id (role region), скрывается через
 *   `hidden`, что корректно убирает её из таб-порядка и для скринридеров;
 * - управление с клавиатуры работает «из коробки» (нативные кнопки).
 *
 * Все тексты — через @shared/i18n.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHead } from '../lib/SectionHead';

/** Пары ключей «вопрос/ответ» FAQ (faq1..faq6). */
const FAQ_KEYS: ReadonlyArray<{ qKey: string; aKey: string }> = [
  { qKey: 'faq1_q', aKey: 'faq1_a' },
  { qKey: 'faq2_q', aKey: 'faq2_a' },
  { qKey: 'faq3_q', aKey: 'faq3_a' },
  { qKey: 'faq4_q', aKey: 'faq4_a' },
  { qKey: 'faq5_q', aKey: 'faq5_a' },
  { qKey: 'faq6_q', aKey: 'faq6_a' },
];

/** Аккордеон частых вопросов (один открытый пункт за раз). */
export function Faq() {
  const { t } = useTranslation();
  // Индекс открытого пункта (null — все закрыты).
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Базовый id для связки кнопка<->панель (уникален на инстанс компонента).
  const baseId = useId();

  return (
    <section id="faq" className="py-16">
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <SectionHead eyebrow={t('faq_eyebrow')} title={t('faq_h2')} centered />

        <div className="mx-auto max-w-[820px]">
          {FAQ_KEYS.map((item, index) => {
            const isOpen = openIndex === index;
            const btnId = `${baseId}-q-${index}`;
            const panelId = `${baseId}-a-${index}`;
            return (
              <div
                key={item.qKey}
                className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    id={btnId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-[22px] py-5 text-left font-heading text-[1.05rem] font-semibold text-ink"
                  >
                    <span>{t(item.qKey)}</span>
                    {/* Знак +/× — поворачивается при открытии (как в прототипе) */}
                    <span
                      aria-hidden
                      className={`flex-none text-2xl text-brand transition-transform duration-200 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  hidden={!isOpen}
                >
                  <p className="px-[22px] pb-5 text-slate">{t(item.aKey)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
