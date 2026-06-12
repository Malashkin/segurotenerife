/**
 * E2E web: чат-подбор страховки (Волна 4).
 *
 * Проверяет ключевой пользовательский флоу лендинга:
 *  1. посетитель проходит быстрые шаги подбора, заполняет контактную форму и
 *     доходит до экрана хендоффа со ссылками на мессенджеры (лид «отправлен»);
 *  2. смена языка в шапке перерисовывает чат вживую, без перезагрузки.
 *
 * Backend подменён стабами: POST /api/leads → 201, POST /api/events → 204.
 */
import { test, expect } from '@playwright/test';

const WEB = 'http://localhost:4173';

test.describe('web — чат-подбор', () => {
  test.beforeEach(async ({ page }) => {
    // Аналитика воронки — заглушаем (fire-and-forget на бэке), чтобы не было
    // висящих запросов к несуществующему API.
    await page.route('**/api/events', (route) => route.fulfill({ status: 204, body: '' }));
    // Создание лида — успешный ответ.
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

  test('проходит подбор и доходит до экрана хендоффа', async ({ page }) => {
    await page.goto(WEB);

    const quiz = page.locator('#quiz');
    await expect(quiz).toBeVisible();

    // 5 быстрых шагов (lang, goal, who, city, urgency): кликаем первую опцию.
    // Между шагами бот «печатает» — Playwright сам дождётся появления кнопок.
    for (let i = 0; i < 5; i++) {
      await quiz.locator('button[type="button"]').first().click();
    }

    // Контактная форма (последний шаг).
    const name = page.locator('#chat-name');
    await expect(name).toBeVisible();
    await name.fill('E2E Tester');
    await page.locator('#chat-contact').fill('+34600123456');
    await quiz.locator('input[type="checkbox"]').check();
    await quiz.locator('button[type="submit"]').click();

    // Экран хендоффа: внешние deep-link'и на мессенджеры.
    const links = quiz.locator('a[target="_blank"]');
    await expect(links.first()).toBeVisible();
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });

  test('смена языка перерисовывает чат без перезагрузки', async ({ page }) => {
    await page.goto(WEB);

    const quiz = page.locator('#quiz');
    await expect(quiz.locator('button[type="button"]').first()).toBeVisible();
    const before = await quiz.innerText();

    // Переключатель языка в шапке (EN·ES·UA·RU). Жмём ES.
    const langGroup = page.getByRole('group', { name: 'Language' }).first();
    await langGroup.getByRole('button', { name: 'ES' }).click();

    // Контент секции подбора (вопросы/опции чата) меняется без reload.
    await expect.poll(async () => quiz.innerText()).not.toBe(before);
  });
});
