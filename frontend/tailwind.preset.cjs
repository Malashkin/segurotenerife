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
const colors = require('tailwindcss/colors');

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
        ink: '#0f172a',
        muted: '#64748b',
        // ВАЖНО: задаём И плоский DEFAULT (text-slate / text-amber, как в
        // прототипе), И полную шкалу Tailwind (slate-50…950, amber-100…900).
        // Иначе строковый токен затирал бы дефолтную шкалу, и все *-slate-NNN /
        // *-amber-NNN молча превращались бы в no-op (серый текст → почти чёрный,
        // bg-slate-100 → прозрачный, border-slate-200 → дефолтный #e5e7eb).
        slate: { ...colors.slate, DEFAULT: '#334155' },
        amber: { ...colors.amber, DEFAULT: '#f59e0b' },
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
      // Плавные анимации появления (используются с motion-safe:, чтобы уважать
      // prefers-reduced-motion). fadeInUp — мягкое всплытие секций/карточек.
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        // Появление/исчезновение всплывающих окон (попап чата, модалка).
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        popOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
        },
        // Мягкое появление сообщений/карточек в ленте чата.
        msgIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 150ms ease-out',
        fadeOut: 'fadeOut 150ms ease-in both',
        fadeInUp: 'fadeInUp 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
        slideUp: 'slideUp 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        slideDown: 'slideDown 220ms ease-in both',
        popIn: 'popIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        popOut: 'popOut 180ms ease-in both',
        msgIn: 'msgIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
