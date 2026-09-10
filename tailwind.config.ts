import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cb: {
          bg: "#071014",
          panel: "#0d181d",
          panel2: "#111f25",
          amber: "#f2a950",
          teal: "#2dd4bf",
          muted: "#91a4ad",
          line: "#203139",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(242,169,80,.08), 0 18px 60px rgba(0,0,0,.24)",
      },
    },
  },
  plugins: [],
};

export default config;
