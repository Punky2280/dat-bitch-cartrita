/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    // Point to all files in the frontend package from the root
    './packages/frontend/index.html',
    './packages/frontend/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'tropical-orange': 'rgb(var(--color-tropical-orange) / <alpha-value>)',
        'tropical-pink': 'rgb(var(--color-tropical-pink) / <alpha-value>)',
        'tropical-green': 'rgb(var(--color-tropical-green) / <alpha-value>)',
        'tropical-purple': 'rgb(var(--color-tropical-purple) / <alpha-value>)',
        'tropical-yellow': 'rgb(var(--color-tropical-yellow) / <alpha-value>)',
        'tropical-cyan': 'rgb(var(--color-tropical-cyan) / <alpha-value>)',
        'theme-bg': 'rgb(var(--color-bg) / <alpha-value>)',
        'theme-surface': 'rgb(var(--color-surface) / <alpha-value>)',
        'theme-border': 'rgb(var(--color-border) / <alpha-value>)',
        'theme-text': 'rgb(var(--color-text) / <alpha-value>)',
        'theme-text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
