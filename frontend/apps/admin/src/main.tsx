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
