/**
 * E2E web: плавающий чат-бот и подбор страховки (Волна 4, обновлено под Волну с
 * плавающим виджетом).
 *
 * Чат теперь — попап (ChatLauncher): открывается кнопкой в углу или CTA в секции
 * #quiz. Проверяем:
 *  1. CTA открывает чат-окно; посетитель проходит быстрые шаги, заполняет форму
 *     и доходит до экрана хендоффа со ссылками на мессенджеры;
 *  2. смена языка в шапке перерисовывает открытый чат вживую, без перезагрузки.
 *
 * Backend подменён стабами: POST /api/leads → 201, POST /api/events → 204.
 */
import { test, expect, type Page } from '@playwright/test';

const WEB = 'http://localhost:4173';

/** Открывает чат через CTA-кнопку в секции #quiz (одна кнопка, без зависимости от языка). */
async function openChat(page: Page) {
  await page.locator('#quiz button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Внутри попапа сам чат — это region (ChatWidget); кнопка закрытия — вне region.
  return dialog.getByRole('region');
}

test.describe('web — плавающий чат-подбор', () => {
  // Реалистичный десктоп-вьюпорт: на нём чат-карточка не перекрывает шапку
  // (на коротких окнах <760px карточка дорастает до навигации — это ок для демо).
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/events', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/api/leads', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'e2e-lead-1' }),
        });
      }
      return route.continue();
    });
  });

  test('CTA открывает чат; проход подбора до экрана хендоффа', async ({ page }) => {
    await page.goto(WEB);
    const chat = await openChat(page);

    // 5 быстрых шагов (lang, goal, who, city, urgency): первая опция каждого.
    // Кнопки опций — внутри region; кнопка закрытия попапа сюда не попадает.
    for (let i = 0; i < 5; i++) {
      await chat.locator('[data-testid="chat-option"]').first().click();
    }

    // Контактная форма.
    const name = page.locator('#chat-name');
    await expect(name).toBeVisible();
    await name.fill('E2E Tester');
    await page.locator('#chat-contact').fill('+34600123456');
    await chat.locator('input[type="checkbox"]').check();
    await chat.locator('button[type="submit"]').click();

    // Экран хендоффа: внешние deep-link'и на мессенджеры.
    const links = chat.locator('a[target="_blank"]');
    await expect(links.first()).toBeVisible();
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });

  test('смена языка перерисовывает открытый чат без перезагрузки', async ({ page }) => {
    await page.goto(WEB);
    const chat = await openChat(page);
    await expect(chat.locator('[data-testid="chat-option"]').first()).toBeVisible();
    const before = await chat.innerText();

    // Переключатель языка в шапке (EN·ES·UA·RU). Жмём ES.
    const langGroup = page.getByRole('group', { name: 'Language' }).first();
    await langGroup.getByRole('button', { name: 'ES' }).click();

    // Содержимое чата (вопрос/опции) меняется без reload.
    await expect.poll(async () => chat.innerText()).not.toBe(before);
  });
});
