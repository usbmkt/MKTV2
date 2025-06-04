import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction, type Express } from "express";
import { createServer as createHttpServer, type Server as HttpServer } from "http";
import { registerRoutes } from "./routes"; // registerRoutes agora não cria servidor
import { setupVite, configureStaticServing, log } from "./vite";
import path from "path";
import fs from "fs";
// Importar os error handlers de routes.ts se quiser usá-los especificamente aqui
// import { handleZodError, handleError as handleRouteError } from './routes';


const app: Express = express();
const httpServer: HttpServer = createHttpServer(app); // Criar servidor HTTP aqui

// Middlewares Globais Essenciais
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger de requisições (como estava)
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
        (source === 'static-server' && res.statusCode !== 200 && res.statusCode !== 304 && res.statusCode !== 502) || // Não logar 502 de static aqui, pois pode ser o proxy do Render
        process.env.LOG_ALL_STATIC === 'true') {

      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      // Logar JSON apenas para API e se não estiver vazio
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0 && source === 'api-server') {
        const jsonString = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonString.length > 150 ? jsonString.substring(0, 147) + "..." : jsonString}`;
      }
      log(logLine, source);
    }
  });
  next();
});


(async () => {
  if (process.env.NODE_ENV === "development") {
    log("Modo de Desenvolvimento Ativado", "server-index");
    // Em dev, Vite lida com assets e fallback de index.html.
    // Rotas API vêm ANTES do handler catch-all do Vite.
    await registerRoutes(app); // Configura /api e /api/auth
    await setupVite(app, httpServer); // setupVite adiciona seus middlewares, incluindo o fallback para SPA.
  } else { 
    log("Modo de Produção Ativado", "server-index");
    
    // 1. Servir estáticos de 'uploads'
    const uploadsPath = path.resolve(process.cwd(), "uploads");
    if (fs.existsSync(uploadsPath)) {
        app.use('/uploads', express.static(uploadsPath));
        log(`[StaticServing] Rota /uploads configurada para ${uploadsPath}`, "server-index");
    }

    // 2. Servir estáticos do frontend (Vite build output em dist/public)
    const publicDistPath = path.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(publicDistPath)) {
        app.use(express.static(publicDistPath)); // Serve /assets, favicon.ico, etc.
        log(`[StaticServing] Servindo assets do frontend de: ${publicDistPath}`, "server-index");
    } else {
        log(`[StaticServing] ATENÇÃO: Diretório de build do frontend não encontrado: ${publicDistPath}.`, "server-index");
    }

    // 3. Registrar rotas da API (agora já prefixadas com /api dentro de registerRoutes)
    await registerRoutes(app);
    
    // 4. Middleware de fallback para o index.html (SPA) - DEVE SER O ÚLTIMO para rotas GET
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
            log(`[SPA Fallback] ERRO: index.html não encontrado em ${indexPath} para ${req.path}`, "server-index");
            // Não enviar 404 aqui diretamente, pois pode ser um asset que o express.static não encontrou.
            // Deixar o Express seguir para o próximo handler (que pode ser o 404 implícito dele).
            next();
        }
      } else {
        next(); 
      }
    });
  }

  // Middlewares de tratamento de erro globais (registrados após todas as rotas)
  // Se você moveu handleZodError e handleError para dentro de registerRoutes e os aplicou nos routers,
  // pode não precisar deles globalmente aqui, ou pode ter um global mais genérico.
  // Por segurança, manter um global genérico é bom.
  // app.use(handleZodError); // Se quiser que ZodErrors sejam tratados globalmente também
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err.message, err.stack ? `\nStack: ${err.stack}` : '');
    const status = err.statusCode || err.status || 500;
    const message = err.message || "Erro Interno do Servidor";
    
    const errorResponse: { error: string; details?: any } = { error: message };
    if (process.env.NODE_ENV === 'development' && err.stack) {
        errorResponse.details = err.stack;
    } else if (err.details && typeof err.details !== 'object') {
        errorResponse.details = err.details;
    }

    if (!res.headersSent) { // Importante: Verificar se a resposta já foi enviada
        res.status(status).json(errorResponse);
    } else {
        // Se os headers já foram enviados, delegar para o error handler padrão do Express
        // que fechará a conexão e impedirá mais escritas.
        next(err);
    }
  });

  const port = process.env.PORT || 5000;
  httpServer.listen(Number(port), "0.0.0.0", () => {
    log(`Servidor escutando na porta ${port} em modo ${process.env.NODE_ENV}`, "server-index");
  });

})();
