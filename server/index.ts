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
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
registerRoutes(app); // As rotas são registradas no app Express

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDistPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/public/')) return next();
  res.sendFile(path.resolve(clientDistPath, 'index.html'));
});

io.on('connection', (socket: Socket) => { // Tipando o socket
  logger.info(`A user connected via WebSocket: ${socket.id}`);
  socket.on('join_user_room', (userId: number | string) => { // Tipando o userId
    socket.join(`user_${userId}`);
    logger.info(`Socket ${socket.id} joined room for user ${userId}`);
  });
  socket.on('disconnect', () => { logger.info(`User disconnected: ${socket.id}`); });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => { // Usar o httpServer que o socket.io está usando
  logger.info(`Server is running on port ${PORT}`);
});
