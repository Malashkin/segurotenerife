/**
 * Vitest — юнит-тесты чистых хелперов фронтенда (отдельно от Playwright e2e).
 *
 * Алиасы (@shared/*, @features…) резолвятся из tsconfig.base.json — как в Vite/
 * Astro. Окружение jsdom: posthog-обёртка проверяет наличие window.
 * Берём только *.test.ts (e2e живёт в *.spec.ts и сюда не попадает).
 */
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.base.json'] })],
  test: {
    environment: 'jsdom',
    include: ['libs/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    globals: false,
  },
});
