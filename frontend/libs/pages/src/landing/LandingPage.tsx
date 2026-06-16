/**
 * LandingPage — целая страница лендинга Seguro Tenerife (FSD pages-слой).
 *
 * Композиция виджетов в продуктовом порядке (см. ТЗ интеграции):
 *   NavBar → Hero → InsuranceTypes → HowItWorks → Articles → Faq → Footer,
 *   плюс плавающий чат-подбор (ChatLauncher: FAB + попап).
 *
 * Страница НЕ содержит собственной бизнес-логики и копирайта — только склейку
 * секций и вёрстку-обёртку. Все тексты живут в @shared/i18n (namespace common)
 * и в самодостаточном словаре чата, поэтому переключатель языка в NavBar
 * перерисовывает весь UI (включая чат) вживую, без перезагрузки.
 *
 * Подбор открывается из CTA (NavBar/Hero) и плавающей кнопки — все вызывают
 * chat-попап. Виджеты-секции выставляют свои id сами (#types, #how, #articles,
 * #faq); отдельной секции #quiz больше нет (дедуп по UX-обзору).
 */
import {
  NavBar,
  Hero,
  InsuranceTypes,
  HowItWorks,
  Articles,
  Faq,
  Footer,
  ChatLauncher,
  CookieConsent,
  LegalModal,
} from '@widgets';
import { Reveal } from '@shared/ui';

/**
 * Главная страница web-приложения: стек секций лендинга + чат-подбор.
 *
 * Дедуп (UX-обзор): отдельная секция-CTA «Подберём вашу страховку» (#quiz)
 * убрана — она была почти пустым дублем (чат стал попапом). Запуск подбора —
 * через CTA в hero/навбаре и плавающую кнопку (все открывают чат-попап).
 */
export function LandingPage(): JSX.Element {
  return (
    <div id="top" className="min-h-screen bg-bg text-ink">
      <NavBar />
      <main>
        {/* Reveal — мягкое появление секций (CSS-усиление, контент видим всегда).
            Hero без Reveal: он над сгибом и показывается сразу. */}
        <Hero />
        <Reveal>
          <InsuranceTypes />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <Articles />
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
      </main>
      <Footer />
      {/* Плавающий чат-бот: кнопка в углу + всплывающее окно подбора. */}
      <ChatLauncher />
      {/* Правовые страницы (privacy/terms/cookies) в модалке из футера. */}
      <LegalModal />
      {/* Баннер согласия на куки/аналитику (отказ не блокирует сайт). */}
      <CookieConsent />
    </div>
  );
}
