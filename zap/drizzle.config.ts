 
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config'; // Para carregar .env.zap automaticamente

if (!process.env.ZAP_DATABASE_URL) {
  console.warn("------------------------------------------------------------------");
  console.warn(" ATENCAO: Variavel ZAP_DATABASE_URL nao definida no arquivo .env.zap");
  console.warn(" Drizzle Kit pode falhar ou usar um valor padrao inesperado.");
  console.warn(" Crie um arquivo .env.zap na raiz da pasta 'zap/' com ZAP_DATABASE_URL=sua_url_postgres");
  console.warn("------------------------------------------------------------------");
  // Não lançar erro aqui para permitir que o script continue se for apenas para 'generate' sem conexão real
  // process.exit(1); 
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/zap_schema.ts',
  out: './migrations', // Pasta de migrações dentro de zap/
  dbCredentials: {
    // A URL será lida de process.env.ZAP_DATABASE_URL
    // Drizzle Kit usará isso para se conectar ao banco para introspecção e migrações.
    url: process.env.ZAP_DATABASE_URL || "postgresql://user:pass@host:port/db_placeholder_para_nao_quebrar_build",
  },
  verbose: true,
  strict: true,
});