/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        discord: {
          bg: 'var(--bg-primary)',
          panel: 'var(--bg-secondary)',
          input: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
          text: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent)',
          accentHover: 'var(--accent-hover)',
          green: 'var(--accent-green)',
          red: 'var(--accent-red)',
          yellow: 'var(--accent-yellow)',
          border: 'var(--border)',
        },
      },
      boxShadow: {
        tab: '0 2px 8px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
