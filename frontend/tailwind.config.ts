import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050A08",
        panel: "#0A1410",
        bone: "#E9F3EC",
        mist: "#8FA69A",
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
        lime: {
          200: "#EAFFC4",
          300: "#D6FF9B",
          400: "#BFF77E",
          500: "#A3E635",
          600: "#84CC16",
        },
        mint: {
          300: "#8FF7E4",
          400: "#5EEAD4",
          500: "#2DD4BF",
        },
        mango: {
          300: "#FFD98A",
          400: "#FFC24B",
          500: "#FFB020",
          600: "#F59300",
        },
        coral: {
          300: "#FFB0A8",
          400: "#FF8A80",
          500: "#FF6B6B",
          600: "#E14B4B",
        },
        banana: "#FFD84D",
        citrus: "#FF9F1C",
        papaya: "#FF7A59",
        apple: "#FF5C7A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 30px 80px -40px rgba(0,0,0,.95)",
        glow: "0 18px 60px -24px rgba(163,230,53,.55)",
        "glow-mango": "0 18px 60px -24px rgba(255,176,32,.5)",
        "glow-mint": "0 18px 60px -24px rgba(94,234,212,.45)",
        "inner-line": "inset 0 1px 0 0 rgba(255,255,255,.06)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(233,243,236,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(233,243,236,.05) 1px, transparent 1px)",
        "radial-lime":
          "radial-gradient(60% 60% at 50% 0%, rgba(163,230,53,.18), transparent 70%)",
      },
      backgroundSize: {
        grid: "56px 56px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(18px,-22px,0) scale(1.06)" },
          "66%": { transform: "translate3d(-16px,14px,0) scale(.96)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.08)" },
        },
        dash: {
          to: { strokeDashoffset: "-240" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          from: { opacity: "0", transform: "scale(.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        scan: {
          "0%": { transform: "translateY(-120%)", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { transform: "translateY(120%)", opacity: "0" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
        orbit: {
          to: { transform: "rotate(360deg)" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        gradientMove: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        grow: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        ring: {
          "0%": { transform: "scale(.85)", opacity: "0.7" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        drift: "drift 22s ease-in-out infinite",
        "pulse-glow": "pulseGlow 5s ease-in-out infinite",
        dash: "dash 14s linear infinite",
        rise: "rise .7s cubic-bezier(.22,.68,0,1) both",
        pop: "pop .45s cubic-bezier(.22,.68,0,1) both",
        shimmer: "shimmer 2.4s linear infinite",
        scan: "scan 2.6s ease-in-out infinite",
        "spin-slow": "spinSlow 26s linear infinite",
        "spin-slower": "spinSlow 48s linear infinite",
        blink: "blink 1.1s step-end infinite",
        "gradient-move": "gradientMove 9s ease infinite",
        grow: "grow .9s cubic-bezier(.22,.68,0,1) both",
        ticker: "ticker 38s linear infinite",
        ring: "ring 3.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
