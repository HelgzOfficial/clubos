import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        club: {
          primary: "rgb(var(--club-primary-rgb) / <alpha-value>)",
          primaryLight: "rgb(var(--club-secondary-rgb) / <alpha-value>)",
          accent: "rgb(var(--club-accent-rgb) / <alpha-value>)",
        },
        navy: {
          50: "#EEF1F8",
          100: "#D7DEF0",
          200: "#AEBEE0",
          300: "#8299CB",
          400: "#5975B0",
          500: "#3C5590",
          600: "#2A3F70",
          700: "#1E2E56",
          800: "#141F3D",
          900: "#0B1428",
          950: "#060B1A",
        },
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(0,0,0,0.08)",
        softDark: "0 4px 24px -8px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
