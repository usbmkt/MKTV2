import { defineConfig } from "drizzle-kit";

// Remova esta linha se ela contiver suas credenciais! É uma falha de segurança.
// if (!process.env.DATABASE_URL) {
//   console.warn("DATABASE_URL não está definida. O Drizzle Kit pode falhar se não encontrar um arquivo .env ou variável de ambiente.");
// }

export default defineConfig({
  out: "./migrations",
  // Caminho confirmado para o seu arquivo de schema
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // Mantemos o driver 'pg'
  driver: "pg",
  dbCredentials: {
    // Usamos 'url' conforme o último erro solicitou
    url: process.env.DATABASE_URL!,
    // Configuração SSL para o Render, ignorando validação de certificado
    ssl: { rejectUnauthorized: false }
  },
  verbose: true, // Mantém logs detalhados, útil para depuração
  strict: true,
});
