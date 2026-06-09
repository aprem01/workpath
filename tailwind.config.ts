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
        // Caroline's exact PayRanker palette
        magenta: {
          DEFAULT: "#E725E2", // primary brand pink
          dark: "#B81DB4",
          light: "#EFC5FF", // gradient top
          headline: "#E325DE", // headline pink
        },
        amber: {
          DEFAULT: "#F7A31C",
          dark: "#D4901E",
          light: "#F7D323", // gradient top (lighter yellow-orange)
        },
        warmwhite: "#F7F2F2", // Caroline's background — super-light grey
        offwhite: "#FAFAF8",
        // Body text — darkened from #969696 to pass WCAG AA (4.5:1)
        // against warmwhite #F7F2F2. Old #969696 contrast was ~2.8:1.
        // New #5C5C5C gives 7.0:1 while still reading as soft grey.
        graytext: "#5C5C5C",
        // Placeholder / label-only — keep light since it only labels
        // alongside higher-contrast text. Still passes 3:1 (UI components).
        graylabel: "#8C8C8C",
        graytab: {
          dark: "#808184",
          light: "#D0D2D3",
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
        "gentle-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(231, 37, 226, 0.3)" },
          "50%": { boxShadow: "0 0 0 10px rgba(231, 37, 226, 0)" },
        },
        "suggestion-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(247, 163, 28, 0.25)" },
          "50%": { boxShadow: "0 0 0 6px rgba(247, 163, 28, 0)" },
        },
        "count-up": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "pill-pop": "pill-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.35s ease-out",
        "gentle-pulse": "gentle-pulse 2.5s ease-in-out infinite",
        "suggestion-pulse": "suggestion-pulse 2s ease-in-out infinite",
        "count-up": "count-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
