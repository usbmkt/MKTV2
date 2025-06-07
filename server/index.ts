// server/index.ts (CORRIGIDO E COMPLETO)
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io'; // ✅ CORREÇÃO: Importando tipos
import { registerRoutes } from './routes.js';
import { logger } from './logger.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
registerRoutes(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir arquivos estáticos do cliente
const clientDistPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(clientDistPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.resolve(clientDistPath, 'index.html'));
  }
});

// ✅ CORREÇÃO: Adicionando tipos para 'socket' e 'userId'
io.on('connection', (socket: Socket) => {
  logger.info('A user connected via WebSocket');
  
  socket.on('join_user_room', (userId: number | string) => {
    socket.join(`user_${userId}`);
    logger.info(`Socket ${socket.id} joined room for user ${userId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
