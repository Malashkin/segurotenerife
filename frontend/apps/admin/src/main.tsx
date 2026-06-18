/**
 * Точка входа приложения менеджера (app-слой FSD).
 *
 * Те же глобальные провайдеры, что и в web (i18n + TanStack Query), т.к. дашборд
 * тоже мультиязычный и работает с серверными данными. Монтируется в #root.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryProvider,
  initAnalytics,
  setAnalyticsConsent,
  captureEvent,
} from '@shared/api';
import { initI18n } from '@shared/i18n';
import { App } from './App';
import './index.css';

initI18n();

// PostHog для admin: БЕЗ autocapture и записи сессий — на экранах видны PII лидов,
// логируем только явные продуктовые события. Это внутренний инструмент за логином
// (не публичные посетители), поэтому включаем трекинг явно, без куки-баннера.
initAnalytics({ autocapture: false, sessionRecording: false });
setAnalyticsConsent(true);
captureEvent('admin_opened');

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
