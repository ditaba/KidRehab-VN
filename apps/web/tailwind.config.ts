import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Soft blue primary
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#4f8ff7',
          600: '#3b76e0',
          700: '#2f5fbf',
          800: '#294f99',
          900: '#24437a',
        },
        // Soft green success
        success: {
          50: '#effbf3',
          100: '#d8f5e1',
          200: '#b3eac6',
          300: '#7fd8a2',
          400: '#4fc07f',
          500: '#30a565',
          600: '#228650',
          700: '#1d6b42',
        },
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      fontSize: { base: ['1rem', '1.6rem'] },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};

export default config;
