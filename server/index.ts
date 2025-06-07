// server/index.ts
import dotenv from "dotenv";
dotenv.config(); 

import express, { type Request, Response, NextFunction } from "express";
import { RouterSetup } from "./routes"; 
import { setupVite, serveStatic, log as serverLog } from "./vite"; 

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 

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
      serverLog(logLine, 'api-server');
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
        serverLog(`[GLOBAL_ERROR_HANDLER] Headers já enviados para ${status} ${message}`, 'error');
      }
    });

    serverLog(`Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`, 'server-init');
    if (process.env.NODE_ENV === "development") {
      serverLog(`[ViteDev] Configurando Vite em modo de desenvolvimento...`, 'server-init');
      await setupVite(app, server); 
    } else {
      serverLog(`[StaticServing] Configurando para servir arquivos estáticos em produção...`, 'server-init');
      serveStatic(app); 
    }
    const port = process.env.PORT || 5000;
    server.listen({ port, host: "0.0.0.0", }, () => {
      serverLog(`Servidor HTTP iniciado e escutando na porta ${port} em modo ${process.env.NODE_ENV || 'development'}`, 'server-init');
    });
  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor:", error);
    process.exit(1);
  }
})();
