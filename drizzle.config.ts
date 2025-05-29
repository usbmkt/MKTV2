import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // console.warn("postgresql://mktv5renderuser:Cm7mwY7TyU6POoQG2DQj93w4rwH0y1cM@dpg-d0s773je5dus73a6vkj0-a.oregon-postgres.render.com/mktv5render"); // Remove this line or comment it out
  console.warn("DATABASE_URL is not set. Drizzle Kit might fail if it cannot find a .env file or environment variable."); // A generic warning is okay
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
    ssl: true
  },
  verbose: true,
  strict: true,
});
