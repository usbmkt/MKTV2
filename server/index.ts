// server/index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { RouterSetup } from "./routes"; // Importar o objeto RouterSetup
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json()); // Middleware para parsear JSON bodies
app.use(express.urlencoded({ extended: false })); // Middleware para parsear URL-encoded bodies

// Middleware de Logging (como no seu arquivo)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(this, [bodyJson, ...args as any]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const summary = JSON.stringify(capturedJsonResponse).substring(0, 100);
        logLine += ` :: ${summary}${summary.length === 100 ? '...' : ''}`;
      }
      if (logLine.length > 180) {
        logLine = logLine.slice(0, 179) + "…";
      }
      log(logLine, 'api-server'); // Adicionado um source específico para o log
    }
  });
  next();
});

(async () => {
  try {
    const server = await RouterSetup.registerRoutes(app); // Usar RouterSetup.registerRoutes

    // Middleware de erro global (como no seu arquivo)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Erro interno do servidor.";
      res.status(status).json({ error: message });
    });

    log(`Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`, 'server-init');
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Servidor HTTP iniciado e escutando na porta ${port}`, 'server-init');
    });

  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor:", error);
    process.exit(1);
  }
})();
