/**
 * E2E: баннер согласия на куки. Отказ НЕ блокирует сайт — гасит только аналитику.
 */
import { test, expect } from '@playwright/test';

const WEB = 'http://localhost:4173';

test.describe('web — согласие на куки', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // Корень `/` — русская версия (Astro), отсюда RU-подписи баннера. Согласие НЕ
  // ставим — баннер (React-остров) должен показаться после гидрации.

  test('«Принять все» закрывает баннер, выбор сохраняется и не возвращается', async ({ page }) => {
    await page.goto(WEB);
    const banner = page.getByRole('region', { name: 'Cookies' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: /Принять все/i }).click();
    await expect(banner).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('seguro_cookie_consent'))).toBe('accepted');
    // После перезагрузки баннер не возвращается.
    await page.reload();
    await expect(page.getByRole('region', { name: 'Cookies' })).toHaveCount(0);
  });

  test('«Только необходимые» сохраняет выбор и сайт продолжает работать', async ({ page }) => {
    await page.goto(WEB);
    const banner = page.getByRole('region', { name: 'Cookies' });
    await banner.getByRole('button', { name: /Только необходимые/i }).click();
    await expect(banner).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('seguro_cookie_consent'))).toBe('necessary');
    // Сайт работает: чат открывается.
    await page.getByTestId('chat-fab').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
