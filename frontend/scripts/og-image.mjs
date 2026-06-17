/**
 * Генерация OG-картинки (1200×630) для шеринга в соцсетях/мессенджерах.
 *
 * Рендерим статичный HTML-баннер в Chromium (Playwright) и снимаем скриншот в
 * apps/web/public/og-image.png. Запуск вручную при изменении бренда/копирайта:
 *   node scripts/og-image.mjs
 * (в обычную сборку не входит — картинка коммитится как ассет.)
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../apps/web/public/og-image.png');

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: center; gap: 28px; padding: 80px;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #fff;
    background: linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #0ea5e9 100%);
  }
  .brand { display: flex; align-items: center; gap: 20px; }
  .tile {
    width: 92px; height: 92px; border-radius: 22px; background: rgba(255,255,255,.16);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 44px; letter-spacing: 1px;
  }
  .brand b { font-size: 40px; font-weight: 700; }
  h1 { font-size: 72px; line-height: 1.08; font-weight: 800; max-width: 980px; letter-spacing: -1px; }
  p { font-size: 32px; opacity: .92; max-width: 900px; }
  .chips { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; }
  .chip {
    background: rgba(255,255,255,.18); border-radius: 999px;
    padding: 12px 24px; font-size: 26px; font-weight: 600;
  }
</style></head>
<body>
  <div class="brand"><div class="tile">ST</div><b>Seguro Tenerife</b></div>
  <h1>Подбор страховки на Тенерифе под вашу ситуацию</h1>
  <p>Виза и ВНЖ · семья · стоматология · питомцы — на вашем языке</p>
  <div class="chips">
    <div class="chip">🇪🇸 Тенерифе</div>
    <div class="chip">Бесплатно, без обязательств</div>
    <div class="chip">RU · UA · ES · EN</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('og-image.png written to', OUT);
