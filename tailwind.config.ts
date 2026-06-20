import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0b0f17",
          soft: "#141a26",
          line: "#222b3a",
        },
        cloud: {
          DEFAULT: "#e8edf5",
          dim: "#9aa7bd",
          faint: "#5d6b84",
        },
        signal: {
          warm: "#f5a623",
          go: "#34d399",
          stop: "#f87171",
          calm: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
