// server/index.ts
import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { PORT } from './config.js';
import { registerRoutes } from './routes.js';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { storage } from './storage.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Inicialização do Servidor ---
async function startServer() {
  const httpServer = registerRoutes(app);

  // Inicializa o Socket.IO e o anexa ao servidor HTTP
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Permite todas as origens
      methods: ["GET", "POST"]
    }
  });

  // Middleware de autenticação para Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token not provided.'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return next(new Error('Authentication error: Invalid user.'));
      }
      (socket as any).user = user; // Anexa o usuário ao objeto do socket
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token.'));
    }
  });

  // Lógica de conexão do Socket.IO
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info({ userId: user.id, socketId: socket.id }, 'Cliente conectado via WebSocket');

    // Coloca o usuário em uma "sala" com base no seu ID
    // Isso permite enviar mensagens apenas para aquele usuário
    socket.join(`user_${user.id}`);

    socket.on('disconnect', () => {
      logger.info({ userId: user.id, socketId: socket.id }, 'Cliente desconectado do WebSocket');
    });
  });

  // Servir arquivos estáticos do cliente (build de produção)
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  // Rota "catch-all" para servir o index.html do React para qualquer rota não-API
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
        res.status(404).send('Not Found');
    }
  });

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Servidor rodando na porta ${PORT}`);
  });

  // Exporta a instância do `io` para ser usada em outros módulos
  return { app, io };
}

export const { io } = await startServer();
