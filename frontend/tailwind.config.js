/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A0A0A', // Carbon Black
        accent: '#10B981', // Emerald Green - Primary accent
        'accent-dark': '#059669', // Darker Emerald for gradients
        gunmetal: '#1A1A1A', // Slightly lighter carbon for cards
        darkgunmetal: '#0D0D0D', // Darker carbon
        // Keep old names for backward compatibility during migration
        pumpkin: '#10B981', // Map to green
        deeporange: '#059669', // Map to darker green
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.6s ease-out',
      },
      backdropBlur: {
        xs: '2px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

