/**
 * PostCSS-конфиг web-приложения. Подключает Tailwind и autoprefixer.
 * .cjs — чтобы работать в ESM-пакете ("type":"module") без конфликтов.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
