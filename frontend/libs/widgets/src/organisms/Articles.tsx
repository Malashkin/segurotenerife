/**
 * Секция «Статьи и гайды» — 6 карточек базы знаний.
 *
 * Портирована из секции `#articles` прототипа /Users/mike/Desktop/fun/index.html.
 * Шесть карточек-статей (ВНЖ/визы, цифровой кочевник, частная медицина,
 * сравнение полисов, семья, бизнес) с тегом-категорией, заголовком, превью и
 * ссылкой «Читать →». Ссылки пока ведут на «#» (контент статей вне MVP),
 * как и в прототипе.
 *
 * Все тексты — через @shared/i18n (a1_tag..a6_p, art_read).
 */
import { useTranslation } from 'react-i18next';
import { SectionHead } from '../lib/SectionHead';

/** Статья: ключи тега, заголовка и превью. */
const ARTICLES: ReadonlyArray<{ tagKey: string; titleKey: string; descKey: string }> = [
  { tagKey: 'a1_tag', titleKey: 'a1_t', descKey: 'a1_p' },
  { tagKey: 'a2_tag', titleKey: 'a2_t', descKey: 'a2_p' },
  { tagKey: 'a3_tag', titleKey: 'a3_t', descKey: 'a3_p' },
  { tagKey: 'a4_tag', titleKey: 'a4_t', descKey: 'a4_p' },
  { tagKey: 'a5_tag', titleKey: 'a5_t', descKey: 'a5_p' },
  { tagKey: 'a6_tag', titleKey: 'a6_t', descKey: 'a6_p' },
];

/** Сетка карточек статей/гайдов. */
export function Articles() {
  const { t } = useTranslation();

  return (
    <section
      id="articles"
      className="bg-gradient-to-b from-white to-brand-tint2 py-16"
    >
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <SectionHead eyebrow={t('art_eyebrow')} title={t('art_h2')} subtitle={t('art_p')} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <a
              key={article.titleKey}
              href="#"
              className="flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-md"
            >
              {/* Декоративная градиентная «обложка» статьи */}
              <span aria-hidden className="h-2 bg-gradient-to-r from-brand to-sky" />
              <div className="flex flex-1 flex-col gap-2.5 p-[22px]">
                <span className="text-[0.76rem] font-bold uppercase tracking-wider text-brand-dark">
                  {t(article.tagKey)}
                </span>
                <h3 className="font-heading text-[1.12rem] font-bold text-ink">
                  {t(article.titleKey)}
                </h3>
                <p className="text-[0.92rem] text-muted">{t(article.descKey)}</p>
                <span className="mt-auto pt-1.5 text-[0.9rem] font-semibold text-brand-dark">
                  {t('art_read')}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
