/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Светлая палитра — базовая; тёмная переопределяет те же
        // токены через CSS-переменные в index.css.
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        content: 'rgb(var(--c-content) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        // Тёмная полоса действий и плавающий таб-бар — единственное место,
        // которое остаётся тёмным в светлой теме.
        bar: 'rgb(var(--c-bar) / <alpha-value>)',
        'bar-content': 'rgb(var(--c-bar-content) / <alpha-value>)',
        positive: '#7ED97E',
        negative: '#FF6E6E',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: {
        xl2: '1.375rem',
        '4xl': '2rem',
        sheet: '2rem',
      },
      spacing: {
        'safe-top': 'var(--safe-top)',
        'safe-bottom': 'var(--safe-bottom)',
      },
      boxShadow: {
        sheet: '0 -12px 40px rgba(0,0,0,0.45)',
        key: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        // Мягкая тень под белыми карточками светлой темы.
        soft: '0 1px 2px rgba(16,16,20,0.04), 0 8px 24px rgba(16,16,20,0.06)',
        bar: '0 8px 30px rgba(0,0,0,0.28)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
