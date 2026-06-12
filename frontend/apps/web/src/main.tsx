/**
 * Точка входа web-приложения (app-слой FSD).
 *
 * Здесь собираются глобальные провайдеры в правильном порядке:
 *   1. initI18n() — инициализация i18next до первого рендера (язык: localStorage
 *      -> браузер -> en). Вызывается из @shared/i18n.
 *   2. QueryProvider из @shared/api — общий QueryClient (TanStack Query) для всех
 *      серверных запросов.
 *
 * Это единственное место, где приложение монтируется в DOM (#root).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from '@shared/api';
import { initI18n } from '@shared/i18n';
import { App } from './App';
import './index.css';

// Инициализируем i18n один раз до рендера (идемпотентно).
initI18n();

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Без точки монтирования рендерить некуда — это ошибка конфигурации index.html.
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
