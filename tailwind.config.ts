import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#bfd3fe",
          300: "#93b5fd",
          400: "#608cfa",
          500: "#3b66f5",
          600: "#2547e9",
          700: "#1e37d4",
          800: "#1f30ab",
          900: "#1f2f87",
          950: "#181d52",
        },
      },
    },
  },
  plugins: [],
};

export default config;
