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
import { QueryProvider } from '@shared/api';
import { ChatLauncher, LegalModal, CookieConsent } from '@widgets';

export default function Overlays({ locale }: { locale: AppLocale }): JSX.Element {
  // Инициализация до первого рендера детей (идемпотентна, задаём язык страницы).
  initI18n({ lng: locale });

  useEffect(() => {
    const onUi = (e: Event): void => {
      const detail = (e as CustomEvent).detail ?? {};
      const st = useUiStore.getState();
      if (detail.ui === 'intent' && detail.intent) st.openChatWithIntent(detail.intent);
      else if (detail.ui === 'legal' && detail.doc) st.openLegal(detail.doc);
      else st.openChat();
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
