// server/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// Tenta usar a exportação padrão, que é comum em módulos CJS importados por ESM.
// Se pino for uma função, pino.default será undefined, e o || usará o próprio pino.
const pinoInstance = (pino as any).default || pino;

export const logger = pinoInstance({
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
