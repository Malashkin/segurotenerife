/**
 * Vite-конфиг публичного приложения (web).
 *
 * - plugin-react: JSX/Fast Refresh.
 * - vite-tsconfig-paths: читает path-алиасы (@shared/*, @entities, ...) прямо из
 *   tsconfig.base.json, чтобы НЕ дублировать список алиасов в конфиге Vite.
 *   Так TypeScript и сборщик всегда резолвят пути одинаково.
 *
 * Библиотеки монорепо подключаются как workspace-пакеты (исходники .ts/.tsx),
 * Vite сам их транспилирует — отдельная сборка библиотек не нужна.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    // Резолвим алиасы из корневого tsconfig.base.json (на 2 уровня выше).
    tsconfigPaths({ projects: ['../../tsconfig.base.json'] }),
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Source maps для удобной отладки в продакшен-сборке-скелете.
    sourcemap: true,
  },
});
