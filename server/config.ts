// server/config.ts
export const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-para-jwt';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; // Defina sua chave Gemini aqui ou via .env
export const PORT = process.env.PORT || 5000;
