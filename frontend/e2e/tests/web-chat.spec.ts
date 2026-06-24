/**
 * E2E web: чат-консультант (новый флоу — ответить + передать менеджеру).
 *
 * Чат — React-остров (ChatLauncher) на Astro-лендинге: открывается плавающей
 * кнопкой (FAB). Флоу: приветствие → свободный вопрос (агент отвечает) → кнопка
 * «Связаться с менеджером» ИЛИ агент сам решает (handoff) → анимация «подбираем
 * менеджера» → контакты в мессенджерах. Опросника и формы-контакта НЕТ.
 *
 * Backend подменён стабами: POST /api/chat → {answer, handoff}, /api/events → 204.
 */
import { test, expect, type Page } from '@playwright/test';

const WEB = 'http://localhost:4173';

async function openChat(page: Page) {
  await page.getByTestId('chat-fab').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog.getByRole('region');
}

test.describe('web — чат-консультант', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('seguro_cookie_consent', 'accepted');
        localStorage.setItem('seguro_lang', 'ru'); // не редиректить корень по языку браузера
      } catch {
        /* игнор */
      }
    });
    await page.route('**/api/events', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/api/handoff', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    // Агент: отвечает и сразу сигналит handoff=false (вопрос ещё открыт).
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Для ВНЖ подойдёт медполис с сертификатом для консульства, без доплат.',
          handoff: false,
        }),
      }),
    );
  });

  test('вопрос → ответ → кнопка «к менеджеру» → анимация → контакты', async ({ page }) => {
    await page.goto(WEB);
    const chat = await openChat(page);

    // Приветствие.
    await expect(chat.getByText(/Расскажите, какая страховка/i)).toBeVisible();
    // На первом экране кнопки «к менеджеру» НЕТ — сначала ценность (ответы).
    await expect(chat.getByTestId('chat-to-manager')).toHaveCount(0);

    // Свободный вопрос → ответ агента.
    await chat.locator('input[type="text"]').fill('Какой полис для ВНЖ?');
    await chat.getByRole('button', { name: /Спросить/i }).click();
    await expect(chat.getByText('Какой полис для ВНЖ?')).toBeVisible();
    await expect(chat.getByText(/сертификат/i)).toBeVisible();

    // Кнопка «к менеджеру» появляется только ПОСЛЕ первого ответа.
    await expect(chat.getByTestId('chat-to-manager')).toBeVisible();
    await chat.getByTestId('chat-to-manager').click();

    // Инлайн-карточка контактов (deep-link'и) появляется в ленте.
    const links = chat.locator('a[target="_blank"]');
    await expect(links.first()).toBeVisible({ timeout: 7000 });
    expect(await links.count()).toBeGreaterThanOrEqual(1);

    // Имя обязательно: пока не введено — кнопки мессенджеров заблокированы.
    await expect(links.first()).toHaveAttribute('aria-disabled', 'true');
    const nameInput = chat.getByPlaceholder('Как к вам обращаться?');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Анна');
    // После ввода имени — мессенджеры активны.
    await expect(links.first()).toHaveAttribute('aria-disabled', 'false');

    // КЛЮЧЕВОЕ: хендофф — не тупик, ввод остаётся → можно продолжать спрашивать.
    // (В карточке есть поле имени, поэтому берём последний input — это поле ввода
    // вопроса в подвале.)
    const footerInput = chat.locator('input[type="text"]').last();
    await expect(footerInput).toBeVisible();
    await footerInput.fill('А что со стоматологией?');
    await chat.getByRole('button', { name: /Спросить/i }).click();
    await expect(chat.getByText('А что со стоматологией?')).toBeVisible();
  });

  test('агент сам уводит к менеджеру при handoff=true', async ({ page }) => {
    // Переопределяем стаб: агент отвечает и сигналит handoff.
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'Передаю вас менеджеру.', handoff: true }),
      }),
    );
    await page.goto(WEB);
    const chat = await openChat(page);
    await chat.locator('input[type="text"]').fill('Хочу к менеджеру');
    await chat.getByRole('button', { name: /Спросить/i }).click();
    // Без нажатия кнопки — сам переходит к контактам (после ~3с анимации).
    const links = chat.locator('a[target="_blank"]');
    await expect(links.first()).toBeVisible({ timeout: 8000 });
  });
});
