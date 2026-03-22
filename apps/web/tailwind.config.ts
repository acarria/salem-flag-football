import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A0A0A',
        accent: '#10B981',
        'accent-dark': '#059669',
        gunmetal: '#1A1A1A',
        darkgunmetal: '#0D0D0D',
        pumpkin: '#10B981',
        deeporange: '#059669',
        'surface-0': '#0A0A0A',
        'surface-1': '#111111',
        'surface-2': '#161616',
        'surface-3': '#1E1E1E',
        'border-subtle': '#FFFFFF0D',
        'border-default': '#FFFFFF1A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'text-tertiary': '#6B6B6B',
      },
      fontFamily: {
        sans: [
          'Inter',
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
};

export default config;
