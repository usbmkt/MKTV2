import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  // Modifique a linha abaixo para incluir os dois arquivos de schema
  schema: ["./shared/schema.ts", "./shared/whatsapp.schema.ts"],
  dialect: "postgresql",
  driver: "pglite", // Mantido para geração de schema sem DB real
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // A configuração de SSL não é usada pelo driver 'pglite' para geração,
    // mas não prejudica mantê-la se outras partes do seu workflow a usam.
    // ssl: { rejectUnauthorized: false } 
  },
  verbose: true,
  strict: true,
});