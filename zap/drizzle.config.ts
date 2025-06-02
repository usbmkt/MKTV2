import { defineConfig } from 'drizzle-kit';
import 'dotenv/config'; 

const DATABASE_URL = postgresql://mktv5renderuser:3CWm0J0MNNQAXdh71LBTDehOQLERdxig@dpg-d0t7v1u3jp1c73eaajpg-a.oregon-postgres.render.com/mktv5render_wb67;

if (!DATABASE_URL) {
  console.warn('------------------------------------------------------------------');
  console.warn(' ATENÇÃO: Variável ZAP_DATABASE_URL não definida no arquivo .env.zap');
  console.warn(' Drizzle Kit pode falhar ou usar um valor padrão inesperado.');
  console.warn(' Crie um arquivo .env.zap na raiz da pasta "zap/" com:');
  console.warn(' ZAP_DATABASE_URL=sua_url_postgres');
  console.warn('------------------------------------------------------------------');
  // NÃO encerra o processo, pois comandos como 'generate' podem não exigir conexão
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/zap_schema.ts', // Arquivo onde está o schema do Drizzle ORM
  out: './migrations',              // Pasta onde as migrações geradas serão armazenadas
  dbCredentials: {
    url: DATABASE_URL || '',        // Fallback vazio: evita exposição de credenciais sensíveis
  },
  verbose: true,                    // Mostra logs detalhados durante execução
  strict: true,                     // Garante checagem rigorosa no Drizzle
});
