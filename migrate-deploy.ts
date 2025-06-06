// migrate-deploy.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';
import 'dotenv/config';

async function runMigrations() {
  console.log("Iniciando script de migração no deploy...");

  if (!process.env.DATABASE_URL) {
    console.error("Erro: Variável de ambiente DATABASE_URL não está definida.");
    process.exit(1);
  }

  // ✅ CORREÇÃO: Garante que a conexão usa o driver 'pg' real, independentemente do drizzle.config.ts
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const db = drizzle(pool, { schema });

  console.log("Conectado ao banco de dados com driver 'pg'. Aplicando migrações...");

  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log("Migrações concluídas com sucesso.");
  } catch (error) {
    console.error("Erro durante a execução das migrações:", error);
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
    console.log("Conexão com o banco de dados fechada.");
  }
}

runMigrations().catch((err) => {
  console.error("Erro não tratado no script de migração:", err);
  process.exit(1);
});
