// usbmkt/mktv2/MKTV2-mktv5/server/db.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config.js';
import * as schema from '../shared/schema.js'; // <-- IMPORTANTE: Importa todo o schema

// Cria a conexão
const connectionString = config.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

// Cria o cliente postgres
const client = postgres(connectionString, {
  prepare: false,
  ssl: config.NODE_ENV === 'production' ? 'require' : undefined, // Ajuste para não usar SSL em dev
});

// Cria a instância do Drizzle, passando o schema
// Esta é a correção fundamental que resolve a maioria dos erros.
export const db = drizzle(client, { schema });

export default db;
