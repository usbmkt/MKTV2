// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // ✅ CORREÇÃO: Driver ajustado para 'pg' para compatibilidade com a Render
  driver: "pg", 
  dbCredentials: {
    // Para 'pg', a URL de conexão é essencial e virá das variáveis de ambiente
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
