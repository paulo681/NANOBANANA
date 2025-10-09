import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          foreground: '#F8FAFC',
        },
        background: '#050914',
        surface: '#0F172A',
        accent: '#38BDF8',
      },
      boxShadow: {
        soft: '0 20px 60px -15px rgba(99, 102, 241, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
