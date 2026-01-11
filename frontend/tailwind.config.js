/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        safaricom: {
          green: '#0c3c1aff',
          dark: '#008524',
          light: '#33B757'
        }
      }
    },
  },
  plugins: [],
}
