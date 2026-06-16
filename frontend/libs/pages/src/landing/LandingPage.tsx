/**
 * LandingPage — целая страница лендинга Seguro Tenerife (FSD pages-слой).
 *
 * Композиция виджетов в продуктовом порядке (см. ТЗ интеграции):
 *   NavBar → Hero → InsuranceTypes → HowItWorks → ChatWidget («подбор») →
 *   Articles → Faq → Footer.
 *
 * Страница НЕ содержит собственной бизнес-логики и копирайта — только склейку
 * секций и вёрстку-обёртку. Все тексты живут в @shared/i18n (namespace common)
 * и в самодостаточном словаре чата, поэтому переключатель языка в NavBar
 * перерисовывает весь UI (включая чат) вживую, без перезагрузки.
 *
 * Секция чата получает id="quiz" — на него ведут CTA-якоря из NavBar/Hero/Footer
 * (#quiz). Виджеты-секции выставляют свои id сами (#types, #how, #articles, #faq).
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
import { useUiStore } from '@shared/store';
import { Reveal } from '@shared/ui';
import { useTranslation } from 'react-i18next';

/**
 * Секция «подбор» (quiz) с центральным чат-виджетом.
 *
 * Обёрнута отдельно, чтобы навесить якорь #quiz, заголовок секции и ограничить
 * ширину контента. Заголовок берётся из i18n-ключей квиза (quiz_h / quiz_sub),
 * портированных из прототипа.
 */
function QuizSection(): JSX.Element {
  const { t } = useTranslation();
  // Чат теперь — плавающий виджет (ChatLauncher). Эта секция стала CTA, которая
  // его открывает, поэтому пользователь не теряет контекст и видит привычный
  // чат-бот в углу страницы.
  const openChat = useUiStore((s) => s.openChat);
  return (
    <section id="quiz" className="bg-gradient-to-b from-white to-brand-tint2 py-16">
      <div className="mx-auto w-[min(720px,calc(100vw-40px))]">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            {t('quiz_eyebrow')}
          </span>
          <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {t('quiz_h2')}
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-lg text-slate">{t('quiz_p')}</p>
          <button
            type="button"
            onClick={openChat}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
          >
            {t('chat_fab')}
          </button>
          <p className="mt-5 text-[0.86rem] text-muted">{t('quiz_note')}</p>
        </div>
      </div>
    </section>
  );
}

/** Главная страница web-приложения: стек секций лендинга + чат-подбор. */
export function LandingPage(): JSX.Element {
  return (
    <div id="top" className="min-h-screen bg-bg text-ink">
      <NavBar />
      <main>
        {/* Мягкое появление секций при прокрутке (Reveal) — без рывков.
            Hero без Reveal: он над сгибом и должен показываться сразу. */}
        <Hero />
        <Reveal>
          <InsuranceTypes />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <QuizSection />
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
