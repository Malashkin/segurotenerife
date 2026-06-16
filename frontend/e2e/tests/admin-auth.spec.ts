/**
 * E2E admin: аутентификация менеджера и дашборд лидов (Волна 4).
 *
 * Проверяет JWT-флоу дашборда:
 *  1. при загрузке без сессии (refresh → 401) показывается форма входа;
 *     неверный пароль (login → 401) даёт сообщение об ошибке;
 *  2. верный пароль (login → 200) открывает дашборд, лиды из GET /api/leads
 *     отображаются в таблице, доступен «Sign out».
 *
 * Backend подменён стабами (auth/refresh, auth/login, leads).
 */
import { test, expect } from '@playwright/test';

const ADMIN = 'http://localhost:4174';

/** Стаб тихого восстановления сессии: нет cookie → 401 (показать логин). */
async function stubNoSession(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized' }),
    }),
  );
}

test.describe('admin — аутентификация', () => {
  test('нет сессии → форма входа; неверный пароль → ошибка', async ({ page }) => {
    await stubNoSession(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      }),
    );

    await page.goto(ADMIN);

    const pw = page.locator('#manager-password');
    await expect(pw).toBeVisible();
    await pw.fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/incorrect password/i)).toBeVisible();
  });

  test('верный пароль → дашборд со списком лидов', async ({ page }) => {
    await stubNoSession(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'e2e.access.token', expiresIn: 1800 }),
      }),
    );
    await page.route('**/api/leads', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leads: [
            {
              id: 'l1',
              created_at: '2026-06-01T10:00:00Z',
              name: 'Анна',
              contact: '+34600000000',
              messenger: 'WhatsApp',
              comm_lang: 'ru',
              goal: 'residency',
              who: null,
              city: 'Santa Cruz',
              urgency: 'soon',
              ui_lang: 'ru',
              status: 'new',
            },
          ],
        }),
      }),
    );

    await page.goto(ADMIN);
    await page.locator('#manager-password').fill('correct-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Дашборд: шапка + строка лида + выход. «Анна» рендерится и в таблице
    // (десктоп), и в мобильной карточке (одна из двух скрыта по CSS), поэтому .first().
    await expect(page.getByText('Leads dashboard')).toBeVisible();
    await expect(page.getByText('Анна').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });
});
