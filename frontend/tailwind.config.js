/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        fadeInUp: {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        flash: {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0' }
        },
        drawLine: {
          '0%': { strokeDashoffset: '600' },
          '100%': { strokeDashoffset: '0' }
        }
      },
      animation: {
        pop: 'pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        fadeInUp: 'fadeInUp 0.5s ease-out both',
        fadeIn: 'fadeIn 0.4s ease-out both',
        flash: 'flash 0.4s ease-out forwards',
        drawLine: 'drawLine 1.4s ease-out 0.3s both'
      }
    }
  },
  plugins: []
};
