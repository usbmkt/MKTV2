import { defineConfig } from "drizzle-kit";

// Remova esta linha se ela contiver suas credenciais! É uma falha de segurança grave.
// if (!process.env.DATABASE_URL) {
//   console.warn("DATABASE_URL não está definida. O Drizzle Kit pode falhar se não encontrar um arquivo .env ou variável de ambiente.");
// }

export default defineConfig({
  out: "./migrations",
  // Caminho para o seu arquivo de schema (confirmado como correto)
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // Usamos 'pglite' AQUI para satisfazer a validação do 'drizzle-kit generate' durante o build
  driver: "pglite",
  dbCredentials: {
    // Usamos 'url' pois o erro anterior indicou que é o esperado para o migrate/config
    url: process.env.DATABASE_URL!,
    // Mantemos a configuração SSL necessária para conectar ao Render
    ssl: { rejectUnauthorized: false }
  },
  verbose: true, // Mantém logs detalhados, útil para depuração
  strict: true,
});
