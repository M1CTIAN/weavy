import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // This sets the default "font-sans" class to your stack
        sans: ["var(--font-dm-sans)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;