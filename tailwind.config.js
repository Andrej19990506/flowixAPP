/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class', // Используем 'class' для ручного управления темой через className
  theme: {
    extend: {
      colors: {
        'brand-primary': '#FF5F1F',
        'brand-light': '#FF8B59',
        'brand-dark': '#E64500',
        'background-light': '#FFFFFF',
        'background-dark': '#0D0D0D',
        'card-light': '#FFFFFF',
        'card-dark': '#1E1E1E',
        'text-primary': '#2c3e50',
        'text-primary-dark': '#E0E0E0',
        'text-secondary': '#666666',
        'text-secondary-dark': '#A0A0A0',
        'border-light': '#E0E0E0',
        'border-dark': '#2A2A2A',
        'warning': '#F59E0B',
        'warning-background': 'rgba(245, 158, 11, 0.1)',
        'success': '#FF5F1F',
        'success-background': 'rgba(46, 204, 113, 0.1)',
        'danger': '#E64500',
        'danger-dark': '#c0392b',
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '20px',
        xl: '16px',
        lg: '12px',
      },
      boxShadow: {
        card: '0px 10px 15px rgba(0, 0, 0, 0.1)',
        'card-dark': '0px 10px 15px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};

