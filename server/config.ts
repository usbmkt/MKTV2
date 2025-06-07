// server/config.ts
import 'dotenv/config';

// ✅ CORREÇÃO: Padronizando o nome da variável para GEMINI_API_KEY.
export const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-para-jwt';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; 
export const PORT = process.env.PORT || 5000;
