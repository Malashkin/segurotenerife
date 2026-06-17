/**
 * Пост-билд пререндер языковых версий лендинга для мультиязычного SEO/GEO.
 *
 * Vite собирает один dist/index.html (RU, каноническая версия). Этот скрипт
 * берёт его и создаёт варианты по локалям с правильным <head>:
 *   dist/index.html      → RU  (перезаписываем: добавляем FAQPage JSON-LD)
 *   dist/en/index.html   → EN
 *   dist/es/index.html   → ES
 *   dist/uk/index.html   → UK
 *
 * В каждой версии локализуются: <html lang>, <title>, description, canonical,
 * og:title/description/url/locale, twitter:* и добавляется JSON-LD FAQPage
 * (вопросы/ответы берём из common.json соответствующей локали — без дублирования
 * контента руками). hreflang-альтернативы уже стоят в исходном index.html и
 * одинаковы на всех версиях, поэтому копируются как есть.
 *
 * Приложение читает локаль из префикса пути (см. libs/shared/i18n/detect.ts),
 * поэтому URL == контент == hreflang/canonical. Запускается из build-скрипта web.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../apps/web/dist');
const LOCALES_DIR = resolve(__dirname, '../libs/shared/i18n/src/locales');
const ORIGIN = 'https://segurotenerife.com';

/** Локали + SEO-копия <head> (title/description пишем под поиск, не из UI). */
const LOCALES = [
  {
    code: 'ru',
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    path: '/',
    title: 'Seguro Tenerife — подбор страховки на Тенерифе',
    description:
      'Независимый мультиязычный сервис подбора страховки на Тенерифе: медицинская для визы и ВНЖ, семейная, стоматология и другое. Бесплатно, без обязательств, на вашем языке.',
  },
  {
    code: 'en',
    htmlLang: 'en',
    ogLocale: 'en_US',
    path: '/en/',
    title: 'Seguro Tenerife — insurance finder for Tenerife',
    description:
      'Independent multilingual insurance-matching for Tenerife: health cover for visa and residency, family, dental and more. Free, no obligation, in your language.',
  },
  {
    code: 'es',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    path: '/es/',
    title: 'Seguro Tenerife — buscador de seguros en Tenerife',
    description:
      'Servicio independiente y multilingüe para encontrar seguros en Tenerife: salud para visado y residencia, familiar, dental y más. Gratis y sin compromiso.',
  },
  {
    code: 'uk',
    htmlLang: 'uk',
    ogLocale: 'uk_UA',
    path: '/uk/',
    title: 'Seguro Tenerife — підбір страхування на Тенерифе',
    description:
      "Незалежний багатомовний сервіс підбору страхування на Тенерифе: медичне для візи та ВНЖ, сімейне, стоматологія тощо. Безкоштовно, без зобов'язань.",
  },
];

/** Экранирование значения для HTML-атрибута. */
function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Заменяет content у <meta name|property="key">. */
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/:/g, '\\:')}" content=")[^"]*(")`);
  return html.replace(re, (_m, a, b) => a + escAttr(value) + b);
}

/** FAQPage JSON-LD из common.json локали (faq1..faq6). */
function faqJsonLd(code) {
  const dict = JSON.parse(readFileSync(resolve(LOCALES_DIR, code, 'common.json'), 'utf8'));
  const items = [];
  for (let i = 1; i <= 6; i += 1) {
    const q = dict[`faq${i}_q`];
    const a = dict[`faq${i}_a`];
    if (q && a) {
      items.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      });
    }
  }
  const obj = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
  // Экранируем `<` чтобы не закрыть <script> раньше времени.
  const json = JSON.stringify(obj).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

const source = readFileSync(resolve(DIST, 'index.html'), 'utf8');

for (const L of LOCALES) {
  const url = `${ORIGIN}${L.path}`;
  let html = source;

  html = html.replace(/<html lang="[^"]*">/, `<html lang="${L.htmlLang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(L.title)}</title>`);
  html = setMeta(html, 'name', 'description', L.description);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => a + url + b);
  html = setMeta(html, 'property', 'og:title', L.title);
  html = setMeta(html, 'property', 'og:description', L.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:locale', L.ogLocale);
  html = setMeta(html, 'name', 'twitter:title', L.title);
  html = setMeta(html, 'name', 'twitter:description', L.description);

  // Добавляем FAQPage JSON-LD перед </head>.
  html = html.replace('</head>', `    ${faqJsonLd(L.code)}\n  </head>`);

  const outDir = L.code === 'ru' ? DIST : resolve(DIST, L.code);
  if (L.code !== 'ru') mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');
}

const langs = LOCALES.map((l) => l.code).join(', ');
console.log(`seo-prerender: wrote localized index.html for [${langs}] in ${DIST}`);
