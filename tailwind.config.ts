import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        papel: "hsl(var(--papel) / <alpha-value>)",
        carta: "hsl(var(--carta) / <alpha-value>)",
        tinta: {
          DEFAULT: "hsl(var(--tinta) / <alpha-value>)",
          2: "hsl(var(--tinta-2) / <alpha-value>)",
          3: "hsl(var(--tinta-3) / <alpha-value>)",
        },
        linha: {
          DEFAULT: "hsl(var(--linha) / <alpha-value>)",
          2: "hsl(var(--linha-2) / <alpha-value>)",
        },
        mata: "hsl(var(--mata) / <alpha-value>)",
        salvia: "hsl(var(--salvia) / <alpha-value>)",
        poco: "hsl(var(--poco) / <alpha-value>)",
        neon: "hsl(var(--neon) / <alpha-value>)",
        bruma: "hsl(var(--bruma) / <alpha-value>)",
        alerta: "hsl(var(--alerta) / <alpha-value>)",
        risco: "hsl(var(--risco) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Funnel Display", "system-ui", "-apple-system", "sans-serif"],
        editorial: ["Boldonse", "Funnel Display", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        controle: "12px",
        carta: "18px",
        campo: "22px",
      },
      boxShadow: {
        carta: "0 1px 2px hsl(150 18% 12% / 0.04), 0 6px 16px hsl(145 35% 30% / 0.10)",
        alto: "0 4px 10px hsl(145 35% 30% / 0.12), 0 20px 45px hsl(145 35% 30% / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
