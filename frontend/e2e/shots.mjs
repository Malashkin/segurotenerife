import { chromium } from '@playwright/test';

const OUT = '/tmp/st-shots';
const WEB = 'http://localhost:4173';
const ADMIN = 'http://localhost:4174';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

const browser = await chromium.launch();

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: 'ru-RU',
  });
  // согласие на куки, чтобы баннер не мешал
  await ctx.addInitScript(() => {
    try { localStorage.setItem('seguro_cookie_consent', 'accepted'); } catch {}
  });
  const page = await ctx.newPage();

  // Лендинг целиком
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/web-landing-${vp.name}.png`, fullPage: true });

  // Чат открыт (FAB), первый экран со стартовыми чипсами
  await page.getByTestId('chat-fab').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/web-chat-${vp.name}.png`, fullPage: false });

  await ctx.close();
}

// Admin: логин + дашборд с застабленными лидами
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.route('**/api/auth/refresh', (r) => r.fulfill({ status: 401, body: '' }));
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 't', expiresIn: 1800 }) }));
  const mk = (i, status, name) => ({
    id: `l${i}`, created_at: `2026-06-1${i}T10:00:00Z`, name, contact: '+34600000000',
    messenger: 'WhatsApp', comm_lang: 'ru', goal: 'residency', who: null, city: 'Santa Cruz',
    urgency: 'soon', ui_lang: 'ru', status,
  });
  await page.route('**/api/leads', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leads: [
      mk(1, 'new', 'Анна Петрова'), mk(2, 'in_progress', 'John Smith'),
      mk(3, 'done', 'Олена Коваль'), mk(4, 'new', 'Maria García'),
    ] }) }));
  await page.goto(ADMIN, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/admin-login-${vp.name}.png`, fullPage: true });
  await page.locator('#manager-password').fill('correct-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/admin-dash-${vp.name}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log('done');
