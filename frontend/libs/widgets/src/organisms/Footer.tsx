/**
 * Подвал лендинга (Footer) с нейтральным дисклеймером и РАБОЧИМИ ссылками.
 *
 * Ключевое требование продукта — дисклеймер `foot_disclaimer`: сервис
 * информационный, НЕ страховая компания и НЕ брокер.
 *
 * Колонки и действия ссылок:
 *  - «Страховки» → открывают чат с релевантным интентом (тип предвыбран).
 *  - «Сайт» → якоря на секции лендинга (#how/#articles/#faq) и открытие чата.
 *  - «Правовое» → открывают правовую модалку (privacy/terms/cookies).
 * Контакты и «Для бизнеса» убраны (бизнес пока не консультируем; контактов нет).
 */
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@shared/store';

/**
 * Ссылка футера — действие зависит от типа:
 *  - anchor: переход по якорю на секцию;
 *  - intent: открыть чат с интентом карточки;
 *  - chat:   открыть чат (обычный старт);
 *  - legal:  открыть правовую модалку.
 */
type FootLink =
  | { kind: 'anchor'; href: string; key: string }
  | { kind: 'intent'; intent: string; key: string }
  | { kind: 'chat'; key: string }
  | { kind: 'legal'; doc: string; key: string };

const COLUMNS: ReadonlyArray<{ headingKey: string; links: readonly FootLink[] }> = [
  {
    headingKey: 'foot_h1', // «Страховки»
    links: [
      { kind: 'intent', intent: 'med', key: 'foot_l1' }, // Для визы и ВНЖ
      { kind: 'intent', intent: 'dental', key: 'c4_t' }, // Стоматология
      { kind: 'intent', intent: 'family', key: 'foot_l2' }, // Семейная
    ],
  },
  {
    headingKey: 'foot_h2', // «Сайт»
    links: [
      { kind: 'anchor', href: '#how', key: 'nav_how' },
      { kind: 'anchor', href: '#articles', key: 'nav_articles' },
      { kind: 'anchor', href: '#faq', key: 'nav_faq' },
      { kind: 'chat', key: 'foot_l4' }, // Подобрать
    ],
  },
  {
    headingKey: 'foot_h3', // «Правовое»
    links: [
      { kind: 'legal', doc: 'privacy', key: 'foot_l5' },
      { kind: 'legal', doc: 'terms', key: 'foot_l6' },
      { kind: 'legal', doc: 'cookies', key: 'foot_cookies' },
    ],
  },
];

/** Подвал с дисклеймером, колонками ссылок и копирайтом. */
export function Footer() {
  const { t } = useTranslation();
  const openChat = useUiStore((s) => s.openChat);
  const openChatWithIntent = useUiStore((s) => s.openChatWithIntent);
  const openLegal = useUiStore((s) => s.openLegal);

  /** Единый стиль ссылки/кнопки в колонке. */
  const linkClass =
    'block w-full py-1 text-left text-[0.92rem] text-[#94a3b8] transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none';

  return (
    <footer className="mt-16 bg-[#0b1220] py-[54px] pb-[30px] text-[#cbd5e1]">
      <div className="mx-auto w-[min(1160px,calc(100vw-40px))]">
        <div className="grid grid-cols-1 gap-[30px] sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Бренд + нейтральный дисклеймер */}
          <div>
            <div className="mb-3.5 flex items-center gap-2.5 font-heading text-lg font-bold text-white">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-brand to-sky font-extrabold">
                ST
              </span>
              Seguro Tenerife
            </div>
            <p className="max-w-[40ch] text-[0.82rem] text-[#64748b]">{t('foot_disclaimer')}</p>
          </div>

          {/* Колонки ссылок */}
          {COLUMNS.map((column) => (
            <nav key={column.headingKey} aria-label={t(column.headingKey)}>
              <h4 className="mb-3.5 font-heading text-base text-white">{t(column.headingKey)}</h4>
              {column.links.map((link) => {
                if (link.kind === 'anchor') {
                  return (
                    <a key={link.key} href={link.href} className={linkClass}>
                      {t(link.key)}
                    </a>
                  );
                }
                const onClick =
                  link.kind === 'intent'
                    ? () => openChatWithIntent(link.intent)
                    : link.kind === 'legal'
                      ? () => openLegal(link.doc)
                      : () => openChat();
                return (
                  <button key={link.key} type="button" onClick={onClick} className={linkClass}>
                    {t(link.key)}
                  </button>
                );
              })}
            </nav>
          ))}
        </div>

        {/* Нижняя строка: копирайт + локация */}
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#1e293b] pt-[22px] text-[0.82rem] text-[#64748b]">
          <span>{t('foot_rights')}</span>
          <span>{t('foot_location')}</span>
        </div>
      </div>
    </footer>
  );
}
