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
          primary: "#0A5C36",
          primaryLight: "#12864F",
          accent: "#D4A017",
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
