/**
 * Общий Tailwind-пресет для всех приложений и библиотек монорепо.
 *
 * Зачем отдельный пресет: чтобы дизайн-токены (цвета бренда из прототипа,
 * шрифты, радиусы) задавались в одном месте, а каждое приложение лишь
 * подключало его и указывало свои `content`-пути для tree-shaking классов.
 *
 * Токены портированы 1:1 из прототипа /Users/mike/Desktop/fun/index.html (:root).
 * Используем CSS-переменные как источник правды, чтобы shadcn-style примитивы
 * и обычные классы ссылались на одни и те же значения.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        // Бирюзовый бренд Seguro Tenerife (--brand / --brand-dark из прототипа).
        brand: {
          DEFAULT: '#0d9488',
          dark: '#0f766e',
          tint: '#ecfdf5',
          tint2: '#f0fdfa',
        },
        sky: '#0ea5e9',
        amber: '#f59e0b',
        ink: '#0f172a',
        slate: '#334155',
        muted: '#64748b',
      },
      fontFamily: {
        // Заголовки — Sora, текст — Inter (как в прототипе). Подключение шрифтов
        // делает каждое приложение в своём index.html.
        heading: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
};
