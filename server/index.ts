// server/index.ts (CORRIGIDO E COMPLETO)
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io'; // Importando tipos
import { registerRoutes } from './routes.js';
import { logger } from './logger.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// A função registerRoutes agora retorna o httpServer, mas nós já o temos aqui.
// A chamada original pode ser mantida, pois ela anexa as rotas ao 'app'.
registerRoutes(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir os arquivos estáticos do cliente (saída do Vite)
const clientDistPath = path.join(__dirname, '..', 'public');
app.use(express.static(clientDistPath));

// Fallback para SPA - servir index.html para rotas do frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(); // Deixa as rotas da API passarem
  }
  res.sendFile(path.resolve(clientDistPath, 'index.html'));
});

// Tipando os parâmetros do callback do Socket.io
io.on('connection', (socket: Socket) => {
  logger.info(`A user connected via WebSocket: ${socket.id}`);
  
  socket.on('join_user_room', (userId: number | string) => {
    socket.join(`user_${userId}`);
    logger.info(`Socket ${socket.id} joined room for user ${userId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
