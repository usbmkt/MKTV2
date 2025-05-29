import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set, Drizzle Kit might fail if it cannot find a .env file.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", // MANTENHA POSTGRESQL
  driver: "pg", // Explicitly specify the driver for clarity (optional, but good practice)
  dbCredentials: {
    // Change 'url' to 'connectionString'
    connectionString: process.env.DATABASE_URL!,
    ssl: true
  },
  verbose: true, // Keep verbose for better logs
  strict: true,
});
