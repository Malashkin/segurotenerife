/**
 * Подвал лендинга (Footer) с нейтральным дисклеймером.
 *
 * Портирован из `footer` прототипа /Users/mike/Desktop/fun/index.html.
 * КЛЮЧЕВОЕ требование продукта — дисклеймер `foot_disclaimer`: сервис
 * информационный, НЕ страховая компания и НЕ брокер; заявки передаются
 * лицензированному офису-партнёру, который делает расчёт и оформление полиса.
 *
 * Четыре колонки: бренд+дисклеймер, «Страховки», «Сайт», «Правовое».
 * Все ссылки — якоря на секции лендинга (#types, #how, ...). Все тексты —
 * через @shared/i18n.
 */
import { useTranslation } from 'react-i18next';

/** Ссылка в колонке footer: якорь + i18n-ключ подписи. */
interface FootLink {
  href: string;
  key: string;
}

/** Колонка ссылок: ключ заголовка + список ссылок. */
const COLUMNS: ReadonlyArray<{ headingKey: string; links: ReadonlyArray<FootLink> }> = [
  {
    headingKey: 'foot_h1', // «Страховки»
    links: [
      { href: '#types', key: 'foot_l1' }, // Для визы и ВНЖ
      { href: '#types', key: 'c4_t' }, // Стоматология
      { href: '#types', key: 'foot_l2' }, // Семейная
      { href: '#types', key: 'foot_l3' }, // Для бизнеса
    ],
  },
  {
    headingKey: 'foot_h2', // «Сайт»
    links: [
      { href: '#how', key: 'nav_how' },
      { href: '#articles', key: 'nav_articles' },
      { href: '#faq', key: 'nav_faq' },
      { href: '#quiz', key: 'foot_l4' }, // Подобрать
    ],
  },
  {
    headingKey: 'foot_h3', // «Правовое»
    links: [
      { href: '#privacy', key: 'foot_l5' }, // Политика конфиденциальности
      { href: '#terms', key: 'foot_l6' }, // Условия использования
      { href: '#cookies', key: 'foot_cookies' }, // Cookies
      { href: '#contact', key: 'foot_l7' }, // Контакты
    ],
  },
];

/** Подвал с дисклеймером, колонками ссылок и копирайтом. */
export function Footer() {
  const { t } = useTranslation();

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
              {column.links.map((link, i) => (
                <a
                  key={`${link.key}-${i}`}
                  href={link.href}
                  className="block py-1 text-[0.92rem] text-[#94a3b8] transition-colors hover:text-white"
                >
                  {t(link.key)}
                </a>
              ))}
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
