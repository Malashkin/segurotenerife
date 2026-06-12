/**
 * Vite-конфиг приложения менеджера (admin).
 *
 * Идентичен web по подходу (см. комментарии в apps/web/vite.config.ts):
 * plugin-react + vite-tsconfig-paths читают алиасы из корневого tsconfig.base.json.
 * Отличается только портом dev-сервера, чтобы web и admin можно было поднять одновременно.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths({ projects: ['../../tsconfig.base.json'] })],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
