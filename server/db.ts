import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config.js';

// Create the connection
const connectionString = config.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

// Create postgres client
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require'
});

// Create drizzle instance
export const db = drizzle(client);

export default db;