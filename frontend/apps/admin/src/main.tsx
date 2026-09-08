/**
 * Точка входа приложения менеджера (app-слой FSD).
 *
 * Те же глобальные провайдеры, что и в web (i18n + TanStack Query), т.к. дашборд
 * тоже мультиязычный и работает с серверными данными. Монтируется в #root.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from '@shared/api';
import { initI18n } from '@shared/i18n';
import { App } from './App';
import './index.css';

initI18n();

// PostHog здесь НЕ инициализируется: админка — внутренний инструмент за логином,
// её визиты не продуктовые. Раньше они шли в общий проект и завышали события,
// сессии и просмотры (`admin_opened` отфильтровывали в отчётах, а `$pageview`
// админки — нет). Страховка на случай, если обёртку позовут отсюда косвенно, —
// `isInternalSurface()` в `shared/api/src/posthog.ts`.

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
