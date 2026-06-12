/**
 * Корневой компонент web-приложения.
 *
 * Рендерит готовую страницу лендинга из @pages (FSD pages-слой). Глобальные
 * провайдеры (i18next init + TanStack Query) подключены выше — в main.tsx.
 *
 * LandingPage сам стекует виджеты в продуктовом порядке:
 *   NavBar → Hero → InsuranceTypes → HowItWorks → ChatWidget («подбор») →
 *   Articles → Faq → Footer.
 * Переключатель языка в NavBar меняет весь UI (включая чат) вживую.
 */
import { LandingPage } from '@pages';

/** Корень приложения: страница лендинга. */
export function App(): JSX.Element {
  return <LandingPage />;
}
