// zap/server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path'; // Para lidar com caminhos de arquivo
import fs from 'fs-extra'; // Para criar diretório
import zapApiRoutes from './routes';
import { initializeActiveConnections } from './services/WhatsappConnectionService'; // Para iniciar conexões ao ligar o server

dotenv.config({ path: path.resolve(process.cwd(), '.env.zap') }); 

const app = express();
const port = process.env.ZAP_PORT || 5001;

// Diretório de uploads para mídias do WhatsApp
export const ZAP_WHATSAPP_MEDIA_UPLOADS_DIR = path.join(process.cwd(), 'zap_public_uploads', 'whatsapp_media');
fs.ensureDirSync(ZAP_WHATSAPP_MEDIA_UPLOADS_DIR); // Garante que o diretório exista

// Middlewares básicos
app.use(cors({
  origin: process.env.ZAP_CLIENT_URL || 'http://localhost:3001', 
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Aumentar limite para JSON se necessário
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos da pasta de uploads do Zap
// Ex: http://localhost:5001/media/whatsapp_media/imagem.jpg
app.use('/media', express.static(path.join(process.cwd(), 'zap_public_uploads')));


// Logger simples
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[ZapServer] ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Monta as rotas da API do Zap sob o prefixo /api
app.use('/api', zapApiRoutes); 

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Zap Module Main Server is healthy!', timestamp: new Date().toISOString() });
});

// Middleware de tratamento de erros global
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[ZapServer Global Error Handler]", err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Ocorreu um erro interno no servidor do módulo Zap.';
  res.status(statusCode).json({ message, error: err.name, details: err.errors || err.stack?.split('\n')[1]?.trim() });
});

const startZapServer = async () => {
  try {
    // await testZapDbConnection(); // Já deve estar sendo chamado em db.ts ou pode ser chamado aqui
    await initializeActiveConnections(); // Tenta reconectar sessões ativas

    app.listen(port, () => {
      console.log(`Zap Module Server ouvindo em http://localhost:${port}`);
      console.log(`Diretório de uploads de mídia: ${ZAP_WHATSAPP_MEDIA_UPLOADS_DIR}`);
      console.log(`Mídias servidas a partir de: http://localhost:${port}/media/whatsapp_media`);
    });
  } catch (error) {
    console.error('Falha ao iniciar Zap Module Server:', error);
    process.exit(1);
  }
};

startZapServer();