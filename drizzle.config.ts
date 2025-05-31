import { defineConfig } from "drizzle-kit";
import 'dotenv/config'; // To load DATABASE_URL from .env

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pg", // Use 'pg' for node-postgres, or 'postgres-js' if you use that driver
  dbCredentials: {
    url: process.env.DATABASE_URL!, // This should point to a real PG instance
    // ssl: { rejectUnauthorized: false } // Add if your generation DB requires SSL
  },
  verbose: true,
  strict: true,
});
