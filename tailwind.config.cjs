/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/frontend/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sleep: "#5E5CE6",
        hr: "#FF453A",
        hrv: "#64D2FF",
        steps: "#30D158",
        calories: "#FF9F0A",
        workout: "#FF375F",
        vo2: "#5AC8FA",
        surface: "#2C2C2E",
        bg: "#1C1C1E",
        "text-primary": "#FFFFFF",
        "text-secondary": "#8E8E93",
        "trend-up": "#30D158",
        "trend-down": "#FF453A",
        "trend-flat": "#8E8E93"
      },
      boxShadow: {
        panel: "0 20px 45px rgba(0, 0, 0, 0.28)"
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at top left, rgba(100, 210, 255, 0.16), transparent 42%), radial-gradient(circle at bottom right, rgba(255, 69, 58, 0.14), transparent 38%)"
      }
    }
  },
  plugins: []
};
