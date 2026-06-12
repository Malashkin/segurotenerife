/**
 * Playwright E2E (Волна 4).
 *
 * Гоняет реальный браузер против собранных SPA (vite preview), а backend-API
 * подменяется детерминированными стабами (page.route) — так E2E проверяет именно
 * UI-флоу (чат-подбор, i18n, хендофф, логин менеджера, таблица лидов) без флака
 * от БД/сети. Живой API покрыт backend-smoke (scripts/smoke) и k6-нагрузкой.
 *
 * Два preview-сервера: web (4173) и admin (4174). Playwright поднимает их сам и
 * ждёт готовности перед тестами.
 */
import { defineConfig, devices } from '@playwright/test';

/** Порты preview-серверов (strictPort — падаем, если занят, а не молча съезжаем). */
export const WEB_URL = 'http://localhost:4173';
export const ADMIN_URL = 'http://localhost:4174';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @seguro/web build && pnpm --filter @seguro/web exec vite preview --port 4173 --strictPort',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command:
        'pnpm --filter @seguro/admin build && pnpm --filter @seguro/admin exec vite preview --port 4174 --strictPort',
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
