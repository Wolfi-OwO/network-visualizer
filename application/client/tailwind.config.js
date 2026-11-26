/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#0f1110',
          900: '#151816',
          800: '#1c201d',
          700: '#272c28',
          600: '#3a413b',
        },
        accent: '#e6a23c',
      },
      // Squarer corners than Tailwind's defaults: the panels read as rack hardware, not as soft cards.
      borderRadius: { sm: '2px', DEFAULT: '3px', md: '4px', lg: '6px', xl: '8px' },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
