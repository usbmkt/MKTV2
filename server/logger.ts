// server/logger.ts
import pino from 'pino';

// Configura um logger mais legível para o ambiente de desenvolvimento
const transport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'pid,hostname',
  },
};

// Exporta a instância do logger para ser usada em toda a aplicação de backend
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && { transport }),
});
