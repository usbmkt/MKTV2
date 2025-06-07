// server/logger.ts
import Pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = Pino({
  level: isDevelopment ? 'trace' : 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});