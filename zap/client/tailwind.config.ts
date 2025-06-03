import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Adicione suas extensões de tema aqui se necessário para o Zap
    },
  },
  plugins: [],
} satisfies Config 
