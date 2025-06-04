// server/index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction, type Express } from "express";
import { createServer as createHttpServer, type Server as HttpServer } from "http";
import { registerRoutes } from "./routes"; // <- Deve estar assim
import { setupVite, configureStaticServing, log } from "./vite";
import path from "path";
import fs from "fs";

const app: Express = express();
const httpServer: HttpServer = createHttpServer(app);

// ... (middlewares globais e logger como na versão anterior) ...
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => { /* ... seu logger ... */ next(); });


(async () => {
  if (process.env.NODE_ENV === "development") {
    log("Modo de Desenvolvimento Ativado", "server-index");
    await registerRoutes(app); 
    await setupVite(app, httpServer); 
  } else { 
    log("Modo de Produção Ativado", "server-index");
    const uploadsPath = path.resolve(process.cwd(), "uploads");
    if (fs.existsSync(uploadsPath)) {
        app.use('/uploads', express.static(uploadsPath));
        log(`[StaticServing] Rota /uploads configurada para ${uploadsPath}`, "server-index");
    }
    const publicDistPath = path.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(publicDistPath)) {
        app.use(express.static(publicDistPath));
        log(`[StaticServing] Servindo assets do frontend de: ${publicDistPath}`, "server-index");
    }
    await registerRoutes(app); // Rotas API depois de estáticos de /uploads e /dist/public
    
    app.get('*', (req, res, next) => { /* ... seu SPA fallback ... */ });
  }

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // ... seu error handler global ...
  });

  const port = process.env.PORT || 5000;
  httpServer.listen(Number(port), "0.0.0.0", () => {
    log(`Servidor escutando na porta ${port} em modo ${process.env.NODE_ENV}`, "server-index");
  });
})();