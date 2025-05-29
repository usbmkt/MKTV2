import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pg", // Changed from "pglite" to "pg"
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
  },
  verbose: true,
  strict: true,
});
