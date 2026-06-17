/**
 * E2E web (Astro): мультиязычные URL (SEO/GEO).
 *
 * Astro отдаёт статические страницы по локалям: `/` (ru, каноническая), `/es/`,
 * `/uk/`, `/en/`. Проверяем, что:
 *  1. /es/ и /uk/ отдают версию на нужном языке (<html lang> совпадает с URL);
 *  2. корень `/` — русская версия;
 *  3. переключатель языка — это ссылки на локальные URL (навигация), т.е. выбор
 *     языка отражается в адресе и шарится.
 */
import { test, expect } from '@playwright/test';

const WEB = 'http://localhost:4173';

test.describe('web — мультиязычные URL', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('seguro_cookie_consent', 'accepted');
      } catch {
        /* игнор */
      }
    });
  });

  test('/es/ отдаёт испанскую версию (html lang=es)', async ({ page }) => {
    await page.goto(`${WEB}/es/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    expect(new URL(page.url()).pathname).toBe('/es/');
  });

  test('/uk/ отдаёт украинскую версию (html lang=uk)', async ({ page }) => {
    await page.goto(`${WEB}/uk/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('корень / — русская версия (html lang=ru)', async ({ page }) => {
    await page.goto(`${WEB}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('переключатель языка ведёт на локальный URL', async ({ page }) => {
    await page.goto(`${WEB}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    const langGroup = page.getByRole('group', { name: 'Language' }).first();
    // На Astro это ссылки (навигация на /es/), а не кнопки live-переключения.
    await langGroup.getByRole('link', { name: 'ES' }).click();
    await page.waitForURL('**/es/**');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    expect(new URL(page.url()).pathname).toBe('/es/');
  });
});
