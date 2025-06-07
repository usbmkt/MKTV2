// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pglite", // ✅ CORREÇÃO: Voltado para 'pglite' para o build funcionar
  dbCredentials: {
    // Para 'pglite', a URL é apenas um placeholder e não será usada para conectar
    url: process.env.DATABASE_URL || "postgres://user:pass@host:port/db",
  },
  verbose: true,
  strict: true,
});
