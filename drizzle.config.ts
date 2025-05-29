import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // Esta verificação é boa, mas o dotenv deve carregar antes que o Drizzle Kit precise dela
  // throw new Error("DATABASE_URL is not set in .env file or environment");
  console.warn("DATABASE_URL is not set, Drizzle Kit might fail if it cannot find a .env file.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", // MANTENHA POSTGRESQL
  dbCredentials: {
    url: process.env.DATABASE_URL!, // O '!' assume que estará definida
  },
});