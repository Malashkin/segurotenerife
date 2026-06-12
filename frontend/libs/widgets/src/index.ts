/**
 * Публичный API слоя widgets (FSD public API).
 *
 * Композиционные блоки лендинга Seguro Tenerife. Контент портирован из
 * прототипа /Users/mike/Desktop/fun/index.html и локализован через @shared/i18n
 * (namespace common). Виджеты НЕ собирают страницу сами — композиция секций
 * в нужном порядке делается на этапе интеграции (слой pages).
 *
 * Состав:
 *   - NavBar      — sticky-шапка с логотипом, навигацией, LangSwitcher и CTA.
 *   - Hero        — главный экран (универсальный заголовок + карточка-схема).
 *   - InsuranceTypes — 9 карточек видов страховки.
 *   - HowItWorks  — 4 шага процесса подбора.
 *   - Articles    — 6 карточек базы знаний.
 *   - Faq         — аккордеон из 6 вопросов (faq1..faq6).
 *   - Footer      — нейтральный дисклеймер + колонки ссылок.
 *   - LangSwitcher — переключатель языков EN · ES · UA · RU (реэкспорт для
 *     повторного использования вне NavBar при необходимости).
 *
 * Как добавить виджет: создать файл в src/organisms (или molecules) и добавить
 * строку реэкспорта ниже. Внутренние пути напрямую не импортируются.
 */

// --- Molecules ---
export { LangSwitcher, type LangSwitcherProps } from './molecules/LangSwitcher';

// --- Organisms (секции лендинга) ---
export { NavBar } from './organisms/NavBar';
export { Hero } from './organisms/Hero';
export { InsuranceTypes } from './organisms/InsuranceTypes';
export { HowItWorks } from './organisms/HowItWorks';
export { Articles } from './organisms/Articles';
export { Faq } from './organisms/Faq';
export { Footer } from './organisms/Footer';
