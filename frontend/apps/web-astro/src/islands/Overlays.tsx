/**
 * Единый React-остров плавающего UI лендинга: чат-лончер + правовая модалка +
 * баннер куки. Один остров = один корень с QueryProvider и общим Zustand-store,
 * поэтому статичные .astro-кнопки управляют им через делегированные события
 * `seguro:ui` (см. мост в Layout): { ui: 'open-chat' | 'intent' | 'legal',
 * intent?, doc? }.
 *
 * i18n инициализируем явной локалью страницы. Грузится client:idle.
 */
import { useEffect } from 'react';
import { initI18n, type AppLocale } from '@shared/i18n';
import { useUiStore } from '@shared/store';
import { QueryProvider, initAnalytics, captureEvent } from '@shared/api';
import { ChatLauncher, LegalModal, CookieConsent } from '@widgets';

export default function Overlays({ locale }: { locale: AppLocale }): JSX.Element {
  // Инициализация до первого рендера детей (идемпотентна, задаём язык страницы).
  initI18n({ lng: locale });
  // PostHog: автозахват кликов/просмотров + запись сессий (capture включится
  // только после согласия на куки). Без ключа в env — тихий no-op.
  initAnalytics();

  useEffect(() => {
    const onUi = (e: Event): void => {
      const detail = (e as CustomEvent).detail ?? {};
      const st = useUiStore.getState();
      // Семантические события воронки (помимо autocapture) — с контекстом.
      if (detail.ui === 'intent' && detail.intent) {
        captureEvent('insurance_intent_selected', { intent: detail.intent, locale });
        st.openChatWithIntent(detail.intent);
      } else if (detail.ui === 'legal' && detail.doc) {
        captureEvent('legal_opened', { doc: detail.doc, locale });
        st.openLegal(detail.doc);
      } else {
        captureEvent('chat_opened', { source: 'cta', locale });
        st.openChat();
      }
    };
    window.addEventListener('seguro:ui', onUi);
    return () => window.removeEventListener('seguro:ui', onUi);
  }, []);

  return (
    <QueryProvider>
      <ChatLauncher />
      <LegalModal />
      <CookieConsent />
    </QueryProvider>
  );
}
