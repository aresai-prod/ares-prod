import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "ares-black": "#0a0a0a",
        "ares-panel": "#121212",
        "ares-overlay": "#0d0d14",
        "ares-cyan": "#09a1a1",
        "ares-blue": "#5484a4",
        "ares-violet": "#d396a6",
        "ares-text": "#20323b",
        "ares-muted": "#556b78"
      },
      boxShadow: {
        glass: "0 20px 60px rgba(10, 16, 24, 0.35)",
        neon: "0 0 30px rgba(0, 229, 255, 0.25)"
      },
      backgroundImage: {
        "ares-gradient": "linear-gradient(135deg, #09a1a1, #5484a4, #d396a6, #f6c992)",
        "metal-flow": "radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(9,161,161,0.35), transparent 55%)"
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
