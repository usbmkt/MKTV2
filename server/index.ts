// server/index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(this, [bodyJson, ...args as any]); // Cast para any para compatibilidade
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Evitar logar respostas muito grandes ou sensíveis
        const summary = JSON.stringify(capturedJsonResponse).substring(0, 100);
        logLine += ` :: ${summary}${summary.length === 100 ? '...' : ''}`;
      }

      if (logLine.length > 180) { // Aumentado o limite para logs mais informativos
        logLine = logLine.slice(0, 179) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Middleware de erro global, DEVE ser o último app.use()
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => { // Adicionado _next e tipo explícito para err
      console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Erro interno do servidor.";
      res.status(status).json({ error: message }); // Sempre retornar um objeto com a chave 'error'
      // Removido throw err; pois isso pode parar o servidor em alguns casos.
      // O erro já foi logado.
    });

    log(`Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`);
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      // reusePort: true, // reusePort pode não ser suportado/necessário em todos os ambientes
    }, () => {
      log(`Servidor HTTP iniciado e escutando na porta ${port}`);
    });

  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor:", error);
    process.exit(1); // Sai se o servidor não puder ser configurado
  }
})();
