/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F7FB',
        navy: {
          950: '#0A1220',
          900: '#0B1522',
          800: '#101C2C',
          700: '#17273B',
          600: '#22364F',
          500: '#2E4763',
        },
        brand: {
          50: '#EFF4FF',
          100: '#DBE6FF',
          200: '#BDD1FF',
          300: '#93B4FF',
          400: '#608CFF',
          500: '#3B6BF5',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        critical: '#DC2626',
        high: '#EA580C',
        medium: '#F59E0B',
        stable: '#16A34A',
        ink: {
          900: '#0B1522',
          800: '#16233A',
          700: '#334155',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,28,44,0.04), 0 12px 32px -16px rgba(16,28,44,0.18)',
        lift: '0 22px 60px -28px rgba(16,28,44,0.42)',
        glow: '0 0 0 1px rgba(37,99,235,0.16), 0 18px 60px -28px rgba(37,99,235,0.55)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(220,38,38,0.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(220,38,38,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
