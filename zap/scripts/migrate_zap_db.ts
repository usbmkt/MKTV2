 
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/zap_schema';
import 'dotenv/config';

async function runZapMigrations() {
  console.log("Starting Zap Module DB Migration Script...");

  if (!process.env.ZAP_DATABASE_URL) {
    console.error("Error: ZAP_DATABASE_URL environment variable is not defined.");
    console.log("Please ensure you have a .env.zap file in the 'zap/' directory with this variable set.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.ZAP_DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  console.log("Connected to Zap Module database. Applying migrations...");

  try {
    await migrate(db, { migrationsFolder: './migrations' }); // Caminho relativo à raiz do módulo Zap
    console.log("Zap Module migrations completed successfully.");
  } catch (error) {
    console.error("Error during Zap Module migrations:", error);
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
    console.log("Zap Module database connection closed.");
  }
}

runZapMigrations().catch((err) => {
  console.error("Unhandled error in Zap Module migration script:", err);
  process.exit(1);
});