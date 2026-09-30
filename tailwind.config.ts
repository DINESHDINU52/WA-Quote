import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' }
    },
    extend: {
      colors: {
        // Premium light-mode palette. Brand accent is a deep teal that prints
        // well on letterhead and stays legible on white.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)'
        },
        ink: {
          50: '#f8fafb',
          100: '#eff2f4',
          200: '#dde3e7',
          300: '#bcc6cc',
          400: '#8a98a0',
          500: '#5e6e76',
          600: '#43525a',
          700: '#334048',
          800: '#222d34',
          900: '#131a1f'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      fontFeatureSettings: {
        tabular: '"tnum"'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(19,26,31,0.04), 0 1px 1px rgba(19,26,31,0.02)',
        card: '0 1px 3px rgba(19,26,31,0.04), 0 1px 2px rgba(19,26,31,0.03)'
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
