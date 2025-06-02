// zap/server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import zapApiRoutes from './routes'; // Importando as rotas do Zap
// import { testZapDbConnection } from './db'; 
// import { initializeAllUserConnections } from './services/WhatsappConnectionService'; // Exemplo

dotenv.config({ path: './.env.zap' }); 

const app = express();
const port = process.env.ZAP_PORT || 5001;

app.use(cors({
  origin: process.env.ZAP_CLIENT_URL || 'http://localhost:3001', 
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[ZapServer] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Monta as rotas da API do Zap sob o prefixo /api
// No vite.config.ts do cliente, o proxy é '/api/zap' -> 'http://localhost:5001/api'
// Então, no backend, as rotas definidas em zapApiRoutes começarão a partir de '/' (relativo a '/api')
app.use('/api', zapApiRoutes); 

// Health check principal do servidor Zap
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'Zap Module Main Server is healthy!',
    timestamp: new Date().toISOString(),
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[ZapServer Error]", err.stack);
  res.status(500).json({ message: 'Internal Server Error in Zap Module', error: err.message });
});

const startZapServer = async () => {
  try {
    // await testZapDbConnection(); 
    // await initializeAllUserConnections(); // Exemplo: Iniciar conexões ativas ao ligar o server

    app.listen(port, () => {
      console.log(`Zap Module Server listening at http://localhost:${port}`);
      console.log(`Frontend do Zap esperado em: ${process.env.ZAP_CLIENT_URL || 'http://localhost:3001'}`);
      console.log(`Proxy do Vite para API Zap: /api/zap -> http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('Failed to start Zap Module Server:', error);
    process.exit(1);
  }
};

startZapServer();