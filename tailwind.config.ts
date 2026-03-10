import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        board: {
          bg: "#f5fbff",
          ink: "#12324f",
          coral: "#ff6b6b",
          mint: "#29c7b8",
          sun: "#f8b400",
          sky: "#66b9ff"
        }
      },
      boxShadow: {
        lift: "0 20px 40px rgba(18, 50, 79, 0.12)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(248, 180, 0, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(248, 180, 0, 0)" }
        }
      },
      animation: {
        floaty: "floaty 2.5s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
