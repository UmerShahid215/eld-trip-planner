/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base "steel / asphalt" neutrals
        ink: {
          DEFAULT: "#0c1526",
          800: "#152238",
          700: "#1e3050",
          600: "#2b426b",
        },
        steel: {
          50: "#f4f6fb",
          100: "#e7ecf4",
          200: "#cdd7e6",
          300: "#a6b6cf",
          400: "#7488a8",
          500: "#516384",
          600: "#3d4d6a",
          700: "#324056",
          800: "#233042",
        },
        // Safety amber accent (highway signage)
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        // Duty-status semantic colors
        duty: {
          off: "#94a3b8",
          sleeper: "#6366f1",
          driving: "#f59e0b",
          onduty: "#0ea5a4",
        },
        paper: "#fbfaf5",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,21,38,0.04), 0 8px 24px -12px rgba(12,21,38,0.18)",
        cardhover: "0 2px 4px rgba(12,21,38,0.05), 0 18px 40px -16px rgba(12,21,38,0.28)",
        paper: "0 1px 0 rgba(12,21,38,0.04), 0 10px 30px -14px rgba(12,21,38,0.22)",
        insetline: "inset 0 -1px 0 rgba(12,21,38,0.10)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
