/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: '#e6f1fb', 100: '#b5d4f4', 200: '#82b9ed', 300: '#4e9ce6', 400: '#2b81d7', 500: '#185fa5', 600: '#12508d', 700: '#0c447c', 900: '#042c53' },
        success: { 50: '#eaf3de', 500: '#3b6d11', 700: '#27500a' },
        warning: { 50: '#faeeda', 100: '#f5d6a9', 200: '#e8a85c', 500: '#854f0b', 700: '#633806' },
        danger:  { 50: '#fcebeb', 500: '#a32d2d', 700: '#791f1f' },
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
