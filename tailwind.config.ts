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
        coral: { DEFAULT: "#FF6B5E", dark: "#E8503F" },
        sunny: { DEFAULT: "#FFC93C", dark: "#F2B705" },
        teal: { DEFAULT: "#23C4B5", dark: "#0FA89A" },
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
