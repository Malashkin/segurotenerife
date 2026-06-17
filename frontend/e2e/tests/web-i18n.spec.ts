/**
 * E2E web: мультиязычные URL (SEO/GEO).
 *
 * Проверяем, что:
 *  1. /es/ и /uk/ отдают версию на нужном языке (детект локали из префикса пути,
 *     <html lang> совпадает) — значит URL == контент == hreflang/canonical;
 *  2. корень `/` — русская (каноническая) версия;
 *  3. смена языка в шапке обновляет URL-префикс (pushState), т.е. ссылка
 *     становится шарабельной и перезагрузка отдаст правильную пререндер-версию.
 */
import { test, expect } from '@playwright/test';

const WEB = 'http://localhost:4173';

test.describe('web — мультиязычные URL', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    // Фиксируем сохранённый язык как ru для детерминизма (иначе на `/` сработает
    // детект языка браузера Playwright = en). Префикс URL (/es, /uk) всё равно
    // имеет приоритет над сохранённым выбором — это и проверяем.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('seguro_lang', 'ru');
        localStorage.setItem('seguro_cookie_consent', 'accepted');
      } catch {
        /* игнор */
      }
    });
  });

  test('/es/ отдаёт испанскую версию (html lang=es)', async ({ page }) => {
    await page.goto(`${WEB}/es/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    // URL не «съехал» обратно на корень (контент совпадает с префиксом).
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

  test('смена языка в шапке обновляет URL-префикс', async ({ page }) => {
    await page.goto(`${WEB}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    const langGroup = page.getByRole('group', { name: 'Language' }).first();
    await langGroup.getByRole('button', { name: 'ES' }).click();
    // i18n переключился (html lang) и URL получил префикс /es/.
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/es/');
  });
});
