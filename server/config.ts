
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

export const config = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// Export individual constants for backward compatibility
export const JWT_SECRET = config.JWT_SECRET;
export const GEMINI_API_KEY = config.GEMINI_API_KEY;
export const PORT = config.PORT;
