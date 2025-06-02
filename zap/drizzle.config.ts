import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// Carrega a DATABASE_URL a partir das variáveis de ambiente (arquivo .env)
const DATABASE_URL_FROM_ENV = process.env.DATABASE_URL;

// String de conexão padrão ou de fallback (NÃO RECOMENDADO PARA PRODUÇÃO NO CÓDIGO)
// É melhor garantir que DATABASE_URL esteja sempre no .env
const FALLBACK_DATABASE_URL = 'postgresql://mktv5renderuser:3CWm0J0MNNQAXdh71LBTDehOQLERdxig@dpg-d0t7v1u3jp1c73eaajpg-a.oregon-postgres.render.com/mktv5render_wb67';

const ACTUAL_DATABASE_URL = DATABASE_URL_FROM_ENV || FALLBACK_DATABASE_URL;

if (!DATABASE_URL_FROM_ENV) { // Verifica se a variável de ambiente DATABASE_URL foi carregada
  console.warn('------------------------------------------------------------------');
  console.warn(' ATENÇÃO: Variável DATABASE_URL não definida no arquivo .env');
  console.warn(' Drizzle Kit usará um valor de fallback ou pode falhar.');
  console.warn(' Crie um arquivo .env na raiz do projeto com:');
  console.warn(` DATABASE_URL=${FALLBACK_DATABASE_URL}`); // Sugere o valor de fallback
  console.warn('------------------------------------------------------------------');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/zap_schema.ts', // Mantenha este se for realmente o caminho do seu schema para este config
  out: './migrations',
  dbCredentials: {
    url: ACTUAL_DATABASE_URL, // Usa a URL carregada ou de fallback
  },
  verbose: true,
  strict: true,
});
