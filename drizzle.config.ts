import type { Config } from 'drizzle-kit';
import { config } from './server/config.js';

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: config.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;