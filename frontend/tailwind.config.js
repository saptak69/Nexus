/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0c10', // Deepest background
          800: '#1f2833', // Server list / main background
          700: '#2c3540', // Channel list / chat background
          600: '#384454', // Hover states
          500: '#4e5d6c', // Borders / muted text
        },
        brand: {
          500: '#6366f1', // Indigo accent (Slack/Discord vibes)
          600: '#4f46e5',
          400: '#818cf8',
        },
        accent: {
          cyan: '#66fcf1', // Neon Cyan
          green: '#4ade80', // Online status
          red: '#f87171', // Close / Leave / Mute
          orange: '#fb923c', // Away
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}

