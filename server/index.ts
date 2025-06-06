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

async function startServer() {
  const httpServer = registerRoutes(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

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
      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info({ userId: user.id, socketId: socket.id }, 'Cliente conectado via WebSocket');
    socket.join(`user_${user.id}`);
    socket.on('disconnect', () => {
      logger.info({ userId: user.id, socketId: socket.id }, 'Cliente desconectado do WebSocket');
    });
  });

  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
      next();
    }
  });

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Servidor rodando na porta ${PORT}`);
  });

  return { app, io };
}

export const { io } = await startServer();
