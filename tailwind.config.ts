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
        amber: {
          primary: "#F5A623",
        },
        teal: {
          primary: "#0D9488",
        },
        coral: {
          DEFAULT: "#F97316",
        },
        offwhite: "#FAFAF8",
      },
      fontFamily: {
        heading: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
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
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.6)", opacity: "0.5" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(40px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "gentle-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 166, 35, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(245, 166, 35, 0)" },
        },
        "suggestion-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 166, 35, 0.25)" },
          "50%": { boxShadow: "0 0 0 5px rgba(245, 166, 35, 0)" },
        },
        "sparkle-burst": {
          "0%": { transform: "scale(0) rotate(0deg)", opacity: "0" },
          "50%": { transform: "scale(1.4) rotate(180deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(360deg)", opacity: "0" },
        },
        "celebration-flash": {
          "0%": { boxShadow: "inset 0 0 0 0 rgba(13, 148, 136, 0)" },
          "30%": { boxShadow: "inset 0 0 30px 5px rgba(13, 148, 136, 0.1)" },
          "100%": { boxShadow: "inset 0 0 0 0 rgba(13, 148, 136, 0)" },
        },
        "hero-glow": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1) translate(0, 0)" },
          "33%": { opacity: "0.6", transform: "scale(1.05) translate(2%, -1%)" },
          "66%": { opacity: "0.5", transform: "scale(1.02) translate(-1%, 2%)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "scroll-fade-in": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pill-pop": "pill-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.35s ease-out",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
        "gentle-pulse": "gentle-pulse 2.5s ease-in-out infinite",
        "suggestion-pulse": "suggestion-pulse 2s ease-in-out infinite",
        "sparkle-burst": "sparkle-burst 0.6s ease-out forwards",
        "celebration-flash": "celebration-flash 0.8s ease-out forwards",
        "hero-glow": "hero-glow 5s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease-in-out infinite",
        "scroll-fade-in": "scroll-fade-in 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
