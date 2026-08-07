import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // lib/ matters too: Tailwind only builds the classes it can actually find
    // written down somewhere. lib/tab-styles.ts holds the shared tab and
    // navigation classes, and without this line they'd be stripped out of the
    // stylesheet and every tab would render unstyled.
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        club: {
          primary: "rgb(var(--club-primary-rgb) / <alpha-value>)",
          primaryLight: "rgb(var(--club-secondary-rgb) / <alpha-value>)",
          accent: "rgb(var(--club-accent-rgb) / <alpha-value>)",
        },
        // Every shade here is a CSS variable, not a fixed hex — so the whole
        // app's background/panel/border colour scheme (not just the accent
        // buttons) can be re-themed to the club's own colours at runtime from
        // Settings > Appearance, with zero changes needed anywhere any of
        // these classes (bg-navy-800, dark:bg-navy-950, border-navy-600/50,
        // ...) are already used. See lib/theme-ramp.ts and
        // components/club-color-provider.tsx. The values in app/globals.css
        // are the original navy palette, used until that provider runs.
        navy: {
          50: "rgb(var(--navy-50-rgb) / <alpha-value>)",
          100: "rgb(var(--navy-100-rgb) / <alpha-value>)",
          200: "rgb(var(--navy-200-rgb) / <alpha-value>)",
          300: "rgb(var(--navy-300-rgb) / <alpha-value>)",
          400: "rgb(var(--navy-400-rgb) / <alpha-value>)",
          500: "rgb(var(--navy-500-rgb) / <alpha-value>)",
          600: "rgb(var(--navy-600-rgb) / <alpha-value>)",
          700: "rgb(var(--navy-700-rgb) / <alpha-value>)",
          800: "rgb(var(--navy-800-rgb) / <alpha-value>)",
          900: "rgb(var(--navy-900-rgb) / <alpha-value>)",
          950: "rgb(var(--navy-950-rgb) / <alpha-value>)",
        },
      },
      // Only `text-*` utilities are remapped here — deliberately not the
      // shared `colors` block. `white` in particular is used far more often
      // for hairline borders and dividers (border-white/10, divide-white/10)
      // than for writing, and those should stay neutral white regardless of
      // what colour the club picks for its text. Extending textColor alone
      // re-colours `text-white` and `text-neutral-*` without touching a
      // single border.
      textColor: {
        white: "rgb(var(--text-strong-rgb) / <alpha-value>)",
        neutral: {
          50: "rgb(var(--text-50-rgb) / <alpha-value>)",
          100: "rgb(var(--text-100-rgb) / <alpha-value>)",
          200: "rgb(var(--text-200-rgb) / <alpha-value>)",
          300: "rgb(var(--text-300-rgb) / <alpha-value>)",
          400: "rgb(var(--text-400-rgb) / <alpha-value>)",
          500: "rgb(var(--text-500-rgb) / <alpha-value>)",
          600: "rgb(var(--text-600-rgb) / <alpha-value>)",
          700: "rgb(var(--text-700-rgb) / <alpha-value>)",
          800: "rgb(var(--text-800-rgb) / <alpha-value>)",
          900: "rgb(var(--text-900-rgb) / <alpha-value>)",
          950: "rgb(var(--text-950-rgb) / <alpha-value>)",
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
