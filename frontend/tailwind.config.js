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
      },
    },
  },
  plugins: [],
};
