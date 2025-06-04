// server/index.ts
import dotenv from "dotenv";
dotenv.config(); // Carrega variáveis de .env para process.env

import express, { type Request, Response, NextFunction } from "express";
// Alteração: Importar RouterSetup nomeado
import { RouterSetup } from "./routes"; 
import { setupVite, serveStatic, log as serverLog } from "./vite"; // Renomeado 'log' para 'serverLog' para evitar conflito

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 

// Middleware de Logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) { // Tipagem mais flexível para bodyJson
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(this, [bodyJson, ...args as any]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0) { // Verifica se não é objeto vazio
        const summary = JSON.stringify(capturedJsonResponse).substring(0, 100);
        logLine += ` :: ${summary}${summary.length === 100 ? '...' : ''}`;
      }
      if (logLine.length > 180) {
        logLine = logLine.slice(0, 179) + "…";
      }
      serverLog(logLine, 'api-server');
    }
  });
  next();
});

(async () => {
  try {
    // Alteração: Usar RouterSetup.registerRoutes
    const server = await RouterSetup.registerRoutes(app); 

    // Middleware de erro global (movido para depois do setup das rotas de API, mas antes de Vite/Static)
    // Embora em 'routes.ts' já existam handlers, este pode pegar erros de middlewares globais anteriores.
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Erro interno do servidor.";
      if (!res.headersSent) { // Garante que não tentaremos enviar headers se já foram enviados
        res.status(status).json({ error: message });
      }
    });

    serverLog(`Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`, 'server-init');
    if (process.env.NODE_ENV === "development") {
      serverLog(`[ViteDev] Configurando Vite em modo de desenvolvimento...`, 'server-init');
      await setupVite(app, server);
    } else {
      serverLog(`[StaticServing] Configurando para servir arquivos estáticos em produção...`, 'server-init');
      // Importante: O serveStatic deve ser o ÚLTIMO middleware para rotas não-API,
      // pois ele tem um app.use("*", ...) para o fallback do SPA.
      // As rotas da API já foram definidas por RouterSetup.registerRoutes.
      serveStatic(app); 
    }

    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      serverLog(`Servidor HTTP iniciado e escutando na porta ${port} em modo ${process.env.NODE_ENV || 'development'}`, 'server-init');
    });

  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor:", error);
    process.exit(1);
  }
})();
