import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction, type Express } from "express";
import { createServer as createHttpServer, type Server as HttpServer } from "http"; // Importar createServer daqui
import { registerRoutes } from "./routes";
import { setupVite, configureStaticServing, log } from "./vite";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger de requisições
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args as any]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    const source = req.originalUrl.startsWith('/api') ? 'api-server' : 
                   req.originalUrl.startsWith('/uploads') ? 'upload-server' : 
                   'static-server';
    if (source === 'api-server' || source === 'upload-server' || 
        (source === 'static-server' && res.statusCode !== 200 && res.statusCode !== 304) ||
        process.env.LOG_ALL_STATIC === 'true') {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0 && source === 'api-server') {
        const jsonString = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonString.length > 200 ? jsonString.substring(0, 197) + "..." : jsonString}`;
      }
      log(logLine, source);
    }
  });
  next();
});

(async () => {
  const httpServer: HttpServer = createHttpServer(app); // Criar a instância do servidor HTTP aqui

  if (process.env.NODE_ENV === "development") {
    log("Modo de Desenvolvimento Ativado", "server-index");
    await registerRoutes(app); // Registrar rotas API
    await setupVite(app, httpServer); // Passar o httpServer para o Vite
  } else { 
    log("Modo de Produção Ativado", "server-index");
    
    // 1. Registrar rotas da API primeiro
    await registerRoutes(app);
    
    // 2. Configurar o serviço de arquivos estáticos (frontend e uploads)
    // A rota /uploads já é configurada dentro de registerRoutes agora
    // configureStaticServing(app); // Chamada ainda válida para servir /dist/public

    const publicDistPath = path.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(publicDistPath)) {
        app.use(express.static(publicDistPath));
        log(`[StaticServing] Servindo assets do frontend de: ${publicDistPath}`, "server-index");
    } else {
        log(`[StaticServing] ATENÇÃO: Diretório de build do frontend não encontrado: ${publicDistPath}.`, "server-index");
    }


    // 3. Middleware de fallback para o index.html (SPA)
    app.get('*', (req, res, next) => {
      if (req.method === 'GET' && 
          !req.path.startsWith('/api') && 
          !req.path.startsWith('/uploads') &&
          !path.extname(req.path) && 
          req.headers.accept && req.headers.accept.includes('html')) {
            
        const indexPath = path.resolve(publicDistPath, "index.html");
        if (fs.existsSync(indexPath)) {
            log(`[SPA Fallback] Servindo index.html para ${req.path}`, "server-index");
            res.sendFile(indexPath);
        } else {
            log(`[SPA Fallback] ERRO: index.html não encontrado em ${indexPath}`, "server-index");
            res.status(404).send("Frontend application not found.");
        }
      } else {
        next(); 
      }
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err.message, err.stack);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Erro Interno do Servidor";
    res.status(status).json({ error: message, details: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  });

  const port = process.env.PORT || 5000;
  httpServer.listen(Number(port), "0.0.0.0", () => {
    log(`Servidor escutando na porta ${port} em modo ${process.env.NODE_ENV}`, "server-index");
  });
})();
