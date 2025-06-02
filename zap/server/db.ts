import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/zap_schema'; // Importa o schema específico do Zap
import 'dotenv/config';

if (!process.env.ZAP_DATABASE_URL) {
  throw new Error("ZAP_DATABASE_URL environment variable is not set for Zap module DB connection.");
}

const pool = new Pool({
  connectionString: process.env.ZAP_DATABASE_URL,
  // SSL config pode ser necessária dependendo do seu provedor de DB
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const zapDb: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

console.log("Zap Module DB connection configured.");

// Função para testar a conexão (opcional)
export async function testZapDbConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Zap Module Database connected successfully.');
  } catch (error) {
    console.error('Zap Module Database connection failed:', error);
    process.exit(1); // Ou trate o erro de outra forma
  }
} 
