import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

const clientDistPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(clientDistPath));

app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

io.on('connection', (socket) => {
  logger.info('A user connected via WebSocket');
  
  socket.on('join_user_room', (userId: string | number) => {
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
