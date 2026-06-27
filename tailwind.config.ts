import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vegas Kiddos — bright, playful desert-sunset palette
        sand: "#FFF8EE",
        // `btn` shades are the deepest the brand goes while clearing WCAG AA
        // (4.5:1) against white text — used only for white-text buttons/pills.
        // DEFAULT stays bright for backgrounds, badges, tints, and accents.
        // `btnHover` is darker than `btn` so white-text buttons deepen on hover
        // and stay above WCAG AA (4.5:1) — hovering to `dark` would lighten them
        // below the threshold (coral.dark 3.72:1, teal.dark 2.96:1).
        coral: { DEFAULT: "#FF6B5E", dark: "#E8503F", btn: "#C45248", btnHover: "#A23E35" },
        sunny: { DEFAULT: "#FFC93C", dark: "#F2B705" },
        teal: { DEFAULT: "#23C4B5", dark: "#0FA89A", btn: "#178379", btnHover: "#106B62" },
        grape: { DEFAULT: "#7B5EA7", dark: "#664A8F" },
        ink: "#2D2A32",
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "system-ui", "sans-serif"],
        body: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        blob: "1.75rem",
      },
      boxShadow: {
        pop: "0 8px 0 0 rgba(45,42,50,0.08)",
        card: "0 10px 30px -12px rgba(45,42,50,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
