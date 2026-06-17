/**
 * Tailwind-конфиг Astro-приложения.
 *
 * Тот же общий пресет монорепо (бренд-токены, фикс шкал slate/amber) и скан
 * классов в собственном src (.astro/.tsx) + в подключаемых FSD-библиотеках,
 * иначе их классы вырежет tree-shaking.
 */
const preset = require('../../tailwind.preset.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './src/**/*.{astro,ts,tsx,html,mdx}',
    '../../libs/shared/*/src/**/*.{ts,tsx}',
    '../../libs/entities/src/**/*.{ts,tsx}',
    '../../libs/features/src/**/*.{ts,tsx}',
    '../../libs/widgets/src/**/*.{ts,tsx}',
    '../../libs/pages/src/**/*.{ts,tsx}',
  ],
};
