// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

// Não comente a verificação do DATABASE_URL aqui, pois pode ser usado em outros contextos
// Se process.env.DATABASE_URL for estritamente para o deploy e não para o db:generate com pglite,
// então esta configuração está ok.
// if (!process.env.DATABASE_URL) {
//   console.warn("DATABASE_URL não está definida. O Drizzle Kit pode falhar se não encontrar um arquivo .env ou variável de ambiente.");
// }

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pglite", // Correto para geração em build sem DB real

  // dbCredentials para pglite:
  // Para pglite em memória, geralmente não são necessárias credenciais de URL/SSL.
  // Remova ou ajuste para o que pglite espera (ex: um path para um arquivo local se não for em memória).
  // Vamos tentar remover, pois pglite frequentemente usa :memory: por padrão.
  // Se o Drizzle Kit reclamar da ausência de dbCredentials, você pode tentar:
  // dbCredentials: {
  //   url: 'file:./dummy_for_drizzle_kit.sqlite' // Ou algo que pglite aceite
  // }
  // MAS O IDEAL é não ter dbCredentials aqui se pglite roda em memória

  verbose: true,
  strict: true,
});
