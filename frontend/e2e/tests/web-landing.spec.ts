/**
 * E2E web: лендинг — интенты карточек, рабочие ссылки футера, правовые модалки,
 * пометка ИИ в чате, отсутствие бизнес-страховки.
 *
 * Локаль фиксируется как ru (localStorage seguro_lang) для предсказуемых подписей.
 */
import { test, expect, type Page } from '@playwright/test';

const WEB = 'http://localhost:4173';

test.describe('web — лендинг: карточки, футер, правовое, ИИ', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('seguro_lang', 'ru');
        // Согласие проставлено, чтобы куки-баннер не перекрывал элементы в тестах.
        localStorage.setItem('seguro_cookie_consent', 'accepted');
      } catch {
        /* приватный режим — игнор */
      }
    });
    // Чат-эндпоинты заглушаем (на случай взаимодействия).
    await page.route('**/api/events', (r) => r.fulfill({ status: 204, body: '' }));
  });

  test('карточка «Для питомцев» открывает чат с релевантным вопросом', async ({ page }) => {
    await page.goto(WEB);
    await page.getByRole('button', { name: /Для питомцев/i }).first().click();

    const chat = page.getByRole('dialog').getByRole('region');
    await expect(chat).toBeVisible();
    // Релевантный вопрос + опции питомца (а не общий «кого страхуем»).
    await expect(chat.getByText(/какой у вас питомец/i)).toBeVisible();
    await expect(chat.getByText('Собака')).toBeVisible();
  });

  test('ссылка страховки в футере открывает чат', async ({ page }) => {
    await page.goto(WEB);
    const footerNav = page.getByRole('navigation', { name: 'Страховки' });
    await footerNav.scrollIntoViewIfNeeded();
    await footerNav.getByRole('button', { name: /Для визы и ВНЖ/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('правовая ссылка в футере открывает модалку и закрывается по Esc', async ({ page }) => {
    await page.goto(WEB);
    await page.getByRole('button', { name: /Политика конфиденциальности/i }).click();
    const modal = page.getByRole('dialog', { name: /Политика конфиденциальности/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Кто мы/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('ⓘ в чате показывает пометку, что подбор делает ИИ', async ({ page }) => {
    await page.goto(WEB);
    await page.locator('#quiz button').click(); // открыть чат
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Как работает подбор/i }).click();
    await expect(dialog.getByText(/ИИ-ассистент/i)).toBeVisible();
  });

  test('свободный ввод вопроса работает рядом с чипсами', async ({ page }) => {
    await page.route('**/api/chat', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'Для ВНЖ подойдёт ASISA Health Residents.' }),
      }),
    );
    await page.goto(WEB);
    await page.locator('#quiz button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Чипсы и поле ввода доступны одновременно.
    await expect(dialog.locator('[data-testid="chat-option"]').first()).toBeVisible();
    const input = dialog.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await input.fill('Какой полис для ВНЖ?');
    await dialog.getByRole('button', { name: /Спросить/i }).click();
    // Вопрос пользователя и ответ ассистента появляются инлайн.
    await expect(dialog.getByText('Какой полис для ВНЖ?')).toBeVisible();
    await expect(dialog.getByText(/ASISA Health Residents/i)).toBeVisible();
  });

  test('бизнес-страховки нет ни в карточках, ни в футере', async ({ page }) => {
    await page.goto(WEB);
    await expect(page.getByRole('button', { name: /бизнес/i })).toHaveCount(0);
    // Карточек видов страховки ровно 8 (без бизнеса).
    await expect(page.locator('#types button')).toHaveCount(8);
  });
});
