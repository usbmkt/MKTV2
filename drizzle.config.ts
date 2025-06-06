// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import 'dotenv/config'; // Garante que as variáveis de ambiente sejam carregadas

if (!process.env.DATABASE_URL) {
  throw new Error("Variável de ambiente DATABASE_URL não está definida.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", // Dialeto correto
  driver: "pg", // ✅ CORREÇÃO: Driver correto para PostgreSQL
  dbCredentials: {
    // A URL é pega diretamente das variáveis de ambiente,
    // que o Render injeta automaticamente no ambiente de produção.
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
