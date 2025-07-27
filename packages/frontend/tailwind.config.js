// packages/frontend/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  // NEW: Enable dark mode using the 'class' strategy.
  // This allows us to toggle dark mode by adding a 'dark' class to the <html> element.
  darkMode: 'class', 
  
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // NEW: Add the official typography plugin for styling the markdown content.
    require('@tailwindcss/typography'),
  ],
}
