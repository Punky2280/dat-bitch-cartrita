/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tropical: {
          orange: 'rgb(249 115 22)',
          pink: 'rgb(236 72 153)', 
          green: 'rgb(34 197 94)',
          purple: 'rgb(168 85 247)',
          yellow: 'rgb(234 179 8)',
          cyan: 'rgb(6 182 212)',
        },
      },
      backgroundImage: {
        'tropical-gradient': 'linear-gradient(135deg, #f97316 0%, #ec4899 25%, #a855f7 50%, #06b6d4 75%, #22c55e 100%)',
        'sunset-gradient': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
        'citrus-gradient': 'linear-gradient(135deg, #eab308 0%, #22c55e 50%, #06b6d4 100%)',
      },
      animation: {
        'bounce-slow': 'bounce-slow 2s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'rainbow': 'rainbow 3s ease infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'twinkle': 'twinkle 1.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'wave': 'wave 2s ease-in-out infinite',
        'loading-shimmer': 'loading-shimmer 2s ease-in-out infinite',
        'rainbow-border': 'rainbow-border 3s ease infinite',
      },
      keyframes: {
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-10px) rotate(-5deg)' },
          '75%': { transform: 'translateY(-5px) rotate(5deg)' }
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) rotate(2deg)' },
          '66%': { transform: 'translateY(-5px) rotate(-2deg)' }
        },
        'pulse-glow': {
          '0%, 100%': { textShadow: '0 0 20px rgba(249, 115, 22, 0.5)' },
          '50%': { textShadow: '0 0 30px rgba(236, 72, 153, 0.7), 0 0 40px rgba(168, 85, 247, 0.5)' }
        },
        'rainbow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '200% 50%' }
        },
        'twinkle': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.3, transform: 'scale(1.2)' }
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        'wave': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'loading-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'rainbow-border': {
          '0%': { borderColor: '#f97316' },
          '20%': { borderColor: '#ec4899' },
          '40%': { borderColor: '#a855f7' },
          '60%': { borderColor: '#06b6d4' },
          '80%': { borderColor: '#22c55e' },
          '100%': { borderColor: '#f97316' }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
