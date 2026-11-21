const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0d1310",
        leaf: {
          50: "#f1f8f3",
          100: "#dcefe2",
          200: "#bbdfc9",
          300: "#8ac7a3",
          400: "#55a87a",
          500: "#338b5d",
          600: "#246f4a",
          700: "#1d583d",
          800: "#194632",
          900: "#153a2b",
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