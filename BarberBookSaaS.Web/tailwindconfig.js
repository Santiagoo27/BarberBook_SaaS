/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        barber: {
          dark: "#111111",
          gold: "#D4AF37",
          accent: "#1E3A8A"
        }
      }
    },
  },
  plugins: [],
}