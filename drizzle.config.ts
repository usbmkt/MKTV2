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
  // Usamos 'pglite' aqui para tentar satisfazer a validação do 'drizzle-kit generate' durante o build
  driver: "pglite",
  dbCredentials: {
    // Usamos 'url' pois o erro mais recente indicou que é o esperado para o migrate/config
    url: process.env.DATABASE_URL!,
    // Mantemos a configuração SSL necessária para conectar ao Render
    ssl: { rejectUnauthorized: false }
  },
  verbose: true, // Mantém logs detalhados, útil para depuração
  strict: true,
});
