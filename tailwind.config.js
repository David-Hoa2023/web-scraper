/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{html,ts,tsx}',
    './src/ui/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#13ec5b',
        'background-light': '#f6f8f6',
        'background-dark': '#102216',
        'sidebar-bg': '#0d1b12',
        'card-bg': 'rgba(19, 236, 91, 0.05)',
        'border-color': 'rgba(19, 236, 91, 0.15)',
        'text-main': '#f6f8f6',
        'text-muted': '#8ba291',
        'accent-dark': '#193322',
        'ui-dark': '#23482f',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        'primary-glow': '0 0 20px rgba(19, 236, 91, 0.3)',
        'primary-lg': '0 4px 20px rgba(19, 236, 91, 0.2)',
      },
    },
  },
  plugins: [],
}
