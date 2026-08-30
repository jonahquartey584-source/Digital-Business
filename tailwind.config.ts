import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Site palette, matched to qp-digital.netlify.app — warm black,
        // gold/bronze accent, off-white/cream text.
        ink: {
          DEFAULT: "#0A0806", // page background
          soft: "#120E0A", // header/footer, slightly raised
          card: "#171310", // card surfaces
          border: "#2B2318", // hairline borders on dark
        },
        gold: {
          100: "#F3E3BE",
          200: "#EBD3A0",
          300: "#E4C287",
          400: "#D9AF63",
          500: "#C9973F",
          600: "#B07B2E",
          700: "#8F5F22",
        },
        cream: {
          DEFAULT: "#F1E9D8",
          dim: "#B9AE99",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
        serif: ["var(--font-wordmark)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
