/**
 * Шапка лендинга (sticky NavBar).
 *
 * Портирована из `header.nav` прототипа /Users/mike/Desktop/fun/index.html:
 * логотип Seguro Tenerife с подзаголовком, навигационные якоря (Страховки /
 * Как это работает / Статьи / Вопросы), переключатель языков и CTA-кнопка.
 *
 * Все тексты — через @shared/i18n (namespace common). Якоря ведут на секции
 * лендинга по id (#types, #how, #articles, #faq, #quiz) — id выставляют сами
 * виджеты-секции и интеграционная страница.
 *
 * Доступность: семантический <header> + <nav aria-label>, мобильная навигация
 * скрывается (как в прототипе), переключатель языков и CTA остаются.
 */
import { useTranslation } from 'react-i18next';
import { buttonVariants, cn } from '@shared/ui';
import { LangSwitcher } from '../molecules/LangSwitcher';

/** Якоря навигации: id целевой секции + i18n-ключ подписи. */
const NAV_LINKS: ReadonlyArray<{ href: string; key: string }> = [
  { href: '#types', key: 'nav_types' },
  { href: '#how', key: 'nav_how' },
  { href: '#articles', key: 'nav_articles' },
  { href: '#faq', key: 'nav_faq' },
];

/** Sticky-шапка с логотипом, навигацией, переключателем языка и CTA. */
export function NavBar() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] w-[min(1160px,calc(100vw-40px))] items-center gap-4">
        {/* Логотип */}
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand to-sky font-heading text-sm font-extrabold text-white">
            ST
          </span>
          {/* Текст бренда скрыт на узких экранах (иначе шапка переполняется);
              на мобиле остаётся знак «ST». */}
          <span className="hidden font-heading text-lg font-bold leading-tight text-ink sm:block">
            Seguro Tenerife
            <small className="block font-sans text-[0.68rem] font-medium tracking-wide text-muted">
              {t('logo_sub')}
            </small>
          </span>
        </a>

        {/* Навигация — на десктопе (lg), иначе перекрывается с языком/CTA. */}
        <nav aria-label="Primary" className="ml-[18px] hidden gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.95rem] font-medium text-slate transition-colors hover:text-brand-dark"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>

        {/* Правый блок: язык + CTA. CTA скрыта на мобиле (есть плавающий чат и
            CTA в секции подбора) — это убирает переполнение шапки. */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-3.5">
          <LangSwitcher />
          {/*
            CTA-якорь, стилизованный как primary-кнопка: переиспользуем
            buttonVariants() из @shared/ui, чтобы внешний вид совпадал с Button,
            но семантически это ссылка на секцию подбора (#quiz).
          */}
          <a
            href="#quiz"
            className={cn(
              buttonVariants({ variant: 'primary' }),
              'hidden whitespace-nowrap px-5 py-2.5 text-[0.95rem] md:inline-flex',
            )}
          >
            {t('nav_cta')}
          </a>
        </div>
      </div>
    </header>
  );
}
