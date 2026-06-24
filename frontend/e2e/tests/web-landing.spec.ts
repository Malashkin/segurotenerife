/**
 * E2E web (Astro): лендинг — интенты карточек, рабочие ссылки футера, правовые
 * модалки, пометка ИИ в чате, отсутствие бизнес-страховки.
 *
 * На Astro лендинг статичен, а чат/правовое/куки — один React-остров
 * (client:idle). Статичные кнопки управляют им через событие seguro:ui, поэтому
 * перед кликом по таким кнопкам ждём гидрацию острова (видимость FAB chat-fab).
 * Корень `/` — русская версия (статически), отсюда RU-подписи.
 */
import { test, expect, type Page } from '@playwright/test';

const WEB = 'http://localhost:4173';

/** Дождаться гидрации острова плавающего UI (его слушатель seguro:ui готов). */
async function waitHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId('chat-fab')).toBeVisible();
}

test.describe('web — лендинг: карточки, футер, правовое, ИИ', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.addInitScript(() => {
      try {
        // Согласие проставлено, чтобы куки-баннер не перекрывал элементы в тестах.
        localStorage.setItem('seguro_cookie_consent', 'accepted');
        localStorage.setItem('seguro_lang', 'ru'); // не редиректить корень по языку браузера
      } catch {
        /* приватный режим — игнор */
      }
    });
    await page.route('**/api/events', (r) => r.fulfill({ status: 204, body: '' }));
    // Дефолтный стаб агента (интент-карточки/футер авто-задают вопрос при открытии
    // чата). Тесты, которым нужен иной ответ, переопределяют route у себя.
    await page.route('**/api/chat', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'Ответ консультанта по вашему вопросу.', handoff: false }),
      }),
    );
  });

  test('карточка «Для питомцев» открывает чат и авто-спрашивает по теме', async ({ page }) => {
    // Стаб агента: на авто-вопрос по интенту отвечает.
    await page.route('**/api/chat', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'Страхование питомцев покрывает ветеринара и ответственность.', handoff: false }),
      }),
    );
    await page.goto(WEB);
    await waitHydrated(page);
    await page.locator('#types [data-intent="pet"]').click();

    const chat = page.getByRole('dialog').getByRole('region');
    await expect(chat).toBeVisible();
    // Открытие из карточки авто-задаёт вопрос по типу → реплика пользователя + ответ.
    await expect(chat.getByText(/Питом|животн/i).first()).toBeVisible();
    await expect(chat.getByText(/ветеринар/i)).toBeVisible();
  });

  test('ссылка страховки в футере открывает чат', async ({ page }) => {
    await page.goto(WEB);
    await waitHydrated(page);
    const footerNav = page.getByRole('navigation', { name: 'Страховки' });
    await footerNav.scrollIntoViewIfNeeded();
    await footerNav.getByRole('button', { name: /Для визы и ВНЖ/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('правовая ссылка в футере открывает модалку и закрывается по Esc', async ({ page }) => {
    await page.goto(WEB);
    await waitHydrated(page);
    await page.getByRole('button', { name: /Политика конфиденциальности/i }).click();
    const modal = page.getByRole('dialog', { name: /Политика конфиденциальности/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Кто мы/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('чат не упоминает ИИ (нет индикатора/слова «ИИ»)', async ({ page }) => {
    await page.goto(WEB);
    await page.getByTestId('chat-fab').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('region')).toBeVisible();
    // Нигде в чате не должно быть «ИИ»/«AI»/«ассистент».
    await expect(dialog.getByText(/\bИИ\b|AI-ассист|ИИ-ассист|искусственн/i)).toHaveCount(0);
  });

  test('свободный ввод вопроса: вопрос → ответ агента', async ({ page }) => {
    await page.route('**/api/chat', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'Для ВНЖ подойдёт медполис с сертификатом для консульства, без доплат.', handoff: false }),
      }),
    );
    await page.goto(WEB);
    await page.getByTestId('chat-fab').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const input = dialog.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await input.fill('Какой полис для ВНЖ?');
    await dialog.getByRole('button', { name: /Спросить/i }).click();
    await expect(dialog.getByText('Какой полис для ВНЖ?')).toBeVisible();
    await expect(dialog.getByText(/сертификат/i)).toBeVisible();
  });

  test('бизнес-страховки нет ни в карточках, ни в футере', async ({ page }) => {
    await page.goto(WEB);
    await expect(page.getByRole('button', { name: /бизнес/i })).toHaveCount(0);
    // 8 карточек видов (без бизнеса) + 1 карточка-CTA «Не нашли своё?» = 9.
    await expect(page.locator('#types button')).toHaveCount(9);
  });
});
