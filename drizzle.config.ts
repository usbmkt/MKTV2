import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql', // <-- CORREÇÃO: Renomeado de 'driver' para 'dialect' e valor ajustado
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;