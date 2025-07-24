/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#000',
        pumpkin: '#FF7518', // Pumpkin Orange
        deeporange: '#C2410C', // Deep Orange
        gunmetal: '#1A252F', // Darker Gunmetal Grey
        darkgunmetal: '#0F1419', // Even Darker Gunmetal
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

