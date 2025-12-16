/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A5BE9',
        primaryDark: '#02137D',
        primaryDeep: '#001E65',
        primaryAccent: '#4578FD',
        black: '#000000',
        white: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
