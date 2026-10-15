import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // Warm near-black base
        ink: {
          950: "#08090e",
          900: "#0d0f18",
          800: "#141620",
          700: "#1c1f2e",
          600: "#252940",
        },
        // Off-white text
        paper: {
          100: "#f0eee8",
          200: "#d8d4cc",
          400: "#9a9490",
          600: "#5c5852",
        },
        // Hairline borders
        wire: "#ffffff14",
      },
    },
  },
  plugins: [],
};

export default config;
