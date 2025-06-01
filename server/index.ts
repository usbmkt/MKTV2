// server/index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { RouterSetup } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from 'path'; // Adicione path se não estiver lá

const app = express();

// Middlewares básicos (JSON, URL-encoded, logging) devem vir primeiro
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Seu middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path; // Renomeado para evitar conflito com 'path' importado
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(this, [bodyJson, ...args as any]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) { // Usar reqPath
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const summary = JSON.stringify(capturedJsonResponse).substring(0, 100);
        logLine += ` :: ${summary}${summary.length === 100 ? '...' : ''}`;
      }
      // Removido o truncamento excessivo do logLine para ver mais detalhes do erro se necessário
      log(logLine, 'api-server');
    }
  });
  next();
});

(async () => {
  try {
    // 1. REGISTRAR ROTAS DA API PRIMEIRO
    const httpServer = await RouterSetup.registerRoutes(app); // httpServer é retornado aqui

    // 2. CONFIGURAR SERVIDOR ESTÁTICO E VITE DEPOIS DAS ROTAS DA API
    log(`Environment: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`, 'server-init');
    if (process.env.NODE_ENV === "development") {
      // Em desenvolvimento, Vite cuida de tudo, incluindo o fallback para index.html
      await setupVite(app, httpServer); // Passa o httpServer para o HMR do Vite
    } else {
      // EM PRODUÇÃO:
      const distPublicPath = path.resolve(__dirname, 'public'); // __dirname aponta para a pasta dist
      
      // Servir arquivos estáticos da pasta de uploads (ex: /uploads/...) ANTES do fallback do index.html
      app.use(`/${'uploads'}`, express.static(path.join(process.cwd(), 'uploads'))); // Ajuste 'uploads' se necessário

      // Servir arquivos estáticos do build do frontend (ex: /assets/...)
      app.use(express.static(distPublicPath));

      // Middleware de fallback para servir index.html para rotas do frontend (SPA)
      // Este deve ser um dos ÚLTIMOS middlewares para rotas GET não API.
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) { // Não aplicar fallback para rotas /api/
          return next();
        }
        if (fs.existsSync(path.resolve(distPublicPath, 'index.html'))) {
            res.sendFile(path.resolve(distPublicPath, 'index.html'));
        } else {
            res.status(404).send('Página principal não encontrada. Build do frontend pode estar faltando.');
        }
      });
    }

    // 3. MIDDLEWARE DE ERRO GLOBAL (depois de todas as rotas e static serving)
    // Este errorHandler já está em RouterSetup.registerRoutes, então pode ser redundante aqui
    // a menos que RouterSetup.registerRoutes não registre um global.
    // Se handleError e handleZodError já são adicionados ao final em registerRoutes, ok.
    // Caso contrário, adicione-os aqui:
    // app.use(RouterSetup.handleZodError); // Supondo que você exporte
    // app.use(RouterSetup.handleError);   // Supondo que você exporte

    const port = process.env.PORT || 5000; // Render define PORT
    httpServer.listen({ // Usar o httpServer retornado e configurado pelo Vite/Express
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
