import { defineConfig } from "drizzle-kit";

// Remove the console.warn with credentials if you haven't already!
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Drizzle Kit might fail if it cannot find a .env file or environment variable.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // REMOVE the driver line entirely
  // driver: "pg", // <--- Remove this line
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
  },
  verbose: true,
  strict: true,
});
