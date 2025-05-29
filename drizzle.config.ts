import { defineConfig } from "drizzle-kit";

// Remove the console.warn with credentials if you haven't already!
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Drizzle Kit might fail if it cannot find a .env file or environment variable.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // Keep driver: "pglite" for now, as the previous error demanded it
  driver: "pglite",
  dbCredentials: {
    // Change 'connectionString' back to 'url'
    url: process.env.DATABASE_URL!,
    ssl: true
  },
  verbose: true,
  strict: true,
});
