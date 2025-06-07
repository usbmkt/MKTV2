// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  driver: "pg", // ✅ CORREÇÃO: Alterado de 'pglite' para 'pg'
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
