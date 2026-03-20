/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0f172a',
        accent: '#f97316',
        danger: '#ef4444',
        border: '#e2e8f0',
        'content-bg': '#f8fafc',
        'primary-text': '#0f172a',
        'secondary-text': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
}

