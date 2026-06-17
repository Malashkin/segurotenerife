// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Astro-конфиг публичного лендинга.
 *
 * - SSG (по умолчанию) — статичный HTML по локалям, главный SEO-выигрыш.
 * - i18n-роутинг: ru на `/` (defaultLocale, без префикса), остальные — `/es/`,
 *   `/uk/`, `/en/`. Это и даёт настоящие per-locale URL для hreflang/canonical.
 * - @astrojs/react — рендер React-островов (чат и пр.), libs/* переиспользуются.
 * - @astrojs/sitemap — sitemap.xml с i18n-альтернативами.
 * - vite-tsconfig-paths — те же алиасы (@shared/*, @features…) из tsconfig.base.
 */
export default defineConfig({
  site: 'https://segurotenerife.com',
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en', 'es', 'uk'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
    sitemap({
      i18n: {
        defaultLocale: 'ru',
        locales: { ru: 'ru', en: 'en', es: 'es', uk: 'uk' },
      },
    }),
  ],
  vite: {
    plugins: [tsconfigPaths({ projects: ['../../tsconfig.base.json'] })],
  },
});
