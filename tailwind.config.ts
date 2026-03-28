import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Caroline's exact palette
        magenta: {
          DEFAULT: "#E91E9C",
          dark: "#C4187F",
          light: "#FDF0F7",
        },
        amber: {
          DEFAULT: "#F5A623",
          dark: "#D4901E",
          light: "#FFF8E8",
        },
        warmwhite: "#FFF5F5",
        offwhite: "#FAFAF8",
        pink: {
          light: "#FFF0F0",
          DEFAULT: "#FF6B6B",
        },
        teal: {
          light: "#E6F7F5",
          DEFAULT: "#0D9488",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pill-pop": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.12)" },
          "70%": { transform: "scale(0.95)" },
          "85%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "gentle-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(233, 30, 156, 0.3)" },
          "50%": { boxShadow: "0 0 0 10px rgba(233, 30, 156, 0)" },
        },
        "suggestion-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 166, 35, 0.25)" },
          "50%": { boxShadow: "0 0 0 6px rgba(245, 166, 35, 0)" },
        },
        "count-up": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "pill-pop":
          "pill-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.35s ease-out",
        shimmer: "shimmer 2s ease-in-out infinite",
        "gentle-pulse": "gentle-pulse 2.5s ease-in-out infinite",
        "suggestion-pulse": "suggestion-pulse 2s ease-in-out infinite",
        "count-up":
          "count-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
