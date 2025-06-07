// server/index.ts
import dotenv from "dotenv";
dotenv.config(); 

import express, { type Request, Response, NextFunction } from "express";
import path from 'path';
import { fileURLToPath } from 'node:url';
import { RouterSetup } from "./routes"; 
import { logger } from "./logger"; // ✅ CORREÇÃO: Importando 'logger'

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 

export function serveStatic(app: express.Express) {
  // ✅ CORREÇÃO: __dirname não é global em módulos ES, então definimos aqui.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // O caminho para 'dist' é relativo ao arquivo 'index.js' compilado, que estará dentro de 'dist'.
  // Então, o caminho correto para 'dist/public' é um nível acima e depois para 'public'.
  const clientDistPath = path.resolve(__dirname, "public");
  logger.info({ context: 'serveStatic' }, `[StaticServing] Servindo assets do frontend de: ${clientDistPath}`);
  
  app.use(express.static(clientDistPath));

  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
        return next();
    }
    if (req.originalUrl.includes('.')) { // Evita fallback para arquivos com extensão
        return next();
    }
    logger.info({ context: 'serveStatic' }, `[SPA Fallback] Servindo index.html para ${req.originalUrl}`);
    res.sendFile(path.resolve(clientDistPath, "index.html"));
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) { 
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(this, [bodyJson, ...args as any]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0) { 
        const summary = JSON.stringify(capturedJsonResponse).substring(0, 100);
        logLine += ` :: ${summary}${summary.length === 100 ? '...' : ''}`;
      }
      if (logLine.length > 180) { logLine = logLine.slice(0, 179) + "…"; }
      // ✅ CORREÇÃO: Usando a sintaxe correta do logger
      logger.info({ context: 'api-server' }, logLine);
    }
  });
  next();
});

(async () => {
  try {
    const server = await RouterSetup.registerRoutes(app); 
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err.message, err.stack ? `\nStack: ${err.stack}` : '');
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Erro interno do servidor.";
      if (!res.headersSent) { 
        res.status(status).json({ error: message });
      } else {
        // ✅ CORREÇÃO: Usando a sintaxe correta do logger
        logger.error({ context: 'GLOBAL_ERROR_HANDLER' }, `Headers já enviados para ${status} ${message}`);
      }
    });

    logger.info({ context: 'server-init' }, `Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`);
    
    if (process.env.NODE_ENV !== "development") {
      logger.info({ context: 'server-init' }, `[StaticServing] Configurando para servir arquivos estáticos em produção...`);
      serveStatic(app); 
    }
    const port = process.env.PORT || 5000;
    server.listen({ port, host: "0.0.0.0", }, () => {
      logger.info({ context: 'server-init' }, `Servidor HTTP iniciado e escutando na porta ${port} em modo ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor:", error);
    process.exit(1);
  }
})();
