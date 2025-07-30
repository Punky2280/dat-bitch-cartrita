/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tropical: {
          orange: {
            400: '#FF8A50',
            500: '#FF6B35',
            600: '#E55A2B',
          },
          pink: {
            400: '#FF69B4',
            500: '#FF1493',
            600: '#DC1477',
          },
          blue: {
            400: '#40E0D0',
            500: '#00CED1',
            600: '#00B4B8',
          },
          purple: {
            400: '#DA70D6',
            500: '#BA55D3',
            600: '#9932CC',
          },
          yellow: {
            400: '#FFD700',
            500: '#FFC107',
            600: '#FF8F00',
          },
          lime: {
            400: '#32CD32',
            500: '#00FF00',
            600: '#00CC00',
          },
          red: {
            400: '#FF6B6B',
            500: '#FF5252',
            600: '#E53935',
          },
        },
      },
      backgroundImage: {
        'rainbow-gradient':
          'linear-gradient(45deg, #FF6B35, #FF1493, #00CED1, #BA55D3, #FFC107)',
      },
      animation: {
        'rainbow-pulse': 'rainbow-pulse 3s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
