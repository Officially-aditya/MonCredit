import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        muted: "#777580",
        violet: "#836EF9",
        "violet-dark": "#6E59E8",
        canvas: "#FAF9F7",
      },
      boxShadow: {
        soft: "0 16px 48px rgba(22, 18, 48, 0.06)",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
