/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Backed by CSS variables (see index.css) so every `ink/NN` opacity
        // utility keeps working and flips automatically in dark mode.
        ink: "rgb(var(--ink) / <alpha-value>)",
        parchment: "rgb(var(--parchment) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        brass: "rgb(var(--brass) / <alpha-value>)",
        oxblood: "rgb(var(--oxblood) / <alpha-value>)",
        walnut: "rgb(var(--walnut) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "Cambria", "serif"],
        serif: ["'Lora'", "Georgia", "Cambria", "serif"],
      },
      boxShadow: {
        shelf: "4px 6px 14px rgb(60 40 20 / 0.18)",
        card: "0 2px 6px rgb(60 40 20 / 0.10)",
      },
    },
  },
  plugins: [],
};
