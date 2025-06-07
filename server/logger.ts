// server/logger.ts
import pino from 'pino'; // <-- CORREÇÃO: Importação padrão

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({ // <-- CORREÇÃO: Usando a variável importada
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
