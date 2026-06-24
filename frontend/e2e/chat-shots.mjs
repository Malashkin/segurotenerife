import { chromium } from '@playwright/test';

const OUT = '/tmp/st-shots';
const BASE = 'http://localhost:4173';
const ANSWER =
  'Для ВНЖ подойдёт медполис с сертификатом для консульства: без доплат, без периодов ожидания, действует по всей Испании. Точную цену рассчитает менеджер.';

const cases = [
  { loc: '/', lang: 'ru', vp: { width: 360, height: 740 } },
  { loc: '/', lang: 'ru', vp: { width: 390, height: 844 } },
  { loc: '/es/', lang: 'es', vp: { width: 360, height: 740 } },
  { loc: '/uk/', lang: 'uk', vp: { width: 390, height: 844 } },
  { loc: '/en/', lang: 'en', vp: { width: 1280, height: 900 } },
];

const browser = await chromium.launch();
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: c.vp });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('seguro_cookie_consent', 'accepted'); } catch {}
  });
  const page = await ctx.newPage();
  await page.route('**/api/events', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/api/chat', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: ANSWER, handoff: false }) }));
  await page.goto(BASE + c.loc, { waitUntil: 'networkidle' });
  await page.getByTestId('chat-fab').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  const tag = `${c.lang}-${c.vp.width}`;
  // 1) первый экран (приветствие + чипсы + ввод + кнопка к менеджеру)
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/chat-${tag}-1greet.png` });
  // 2) вопрос → ответ
  await dialog.locator('input[type="text"]').fill('Какой полис для ВНЖ?');
  await dialog.locator('form button[type="submit"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/chat-${tag}-2answer.png` });
  // 3) к менеджеру → анимация → контакты
  await dialog.getByTestId('chat-to-manager').click();
  await page.waitForTimeout(3300);
  await page.screenshot({ path: `${OUT}/chat-${tag}-3handoff.png` });
  await ctx.close();
}
await browser.close();
console.log('chat shots done');
