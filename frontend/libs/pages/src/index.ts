/**
 * Публичный API слоя pages (FSD public API).
 *
 * Целые страницы, собранные из widgets:
 *   - web: LandingPage (лендинг + чат-подбор) — стек секций в продуктовом
 *     порядке: NavBar → Hero → InsuranceTypes → HowItWorks → ChatWidget →
 *     Articles → Faq → Footer.
 *
 * admin-дашборд собирается прямо в apps/admin (его экраны не переиспользуются
 * на web), поэтому отдельной страницы здесь для него нет.
 */
export { LandingPage } from './landing/LandingPage';
