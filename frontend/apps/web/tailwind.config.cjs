/**
 * Tailwind-конфиг web-приложения.
 *
 * Использует общий пресет монорепо (бренд-токены) и сканирует классы как в
 * собственном src, так и в подключаемых FSD-библиотеках — иначе классы из
 * shared/ui/widgets были бы вырезаны tree-shaking'ом Tailwind.
 *
 * Пути к libs указаны относительно корня монорепо (../../libs/**).
 */
const preset = require('../../tailwind.preset.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Классы из FSD-библиотек тоже должны попасть в финальный CSS.
    // Пути перечислены явно (не широкий `**`), чтобы Tailwind не сканировал лишнее.
    '../../libs/shared/*/src/**/*.{ts,tsx}',
    '../../libs/entities/src/**/*.{ts,tsx}',
    '../../libs/features/src/**/*.{ts,tsx}',
    '../../libs/widgets/src/**/*.{ts,tsx}',
    '../../libs/pages/src/**/*.{ts,tsx}',
  ],
};
