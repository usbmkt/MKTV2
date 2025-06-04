import dotenv from "dotenv";
dotenv.config(); // Carrega variáveis de .env no início

import express, { type Request, Response, NextFunction, type Express } from "express";
import { createServer as createHttpServer, type Server as HttpServer } from "http"; // Renomeado para evitar conflito
import { registerRoutes } from "./routes";
import { setupVite, configureStaticServing, log } from "./vite"; // configureStaticServing importado
import path from "path"; // Importar path
import fs from "fs"; // Importar fs

const app: Express = express();

// Middlewares essenciais primeiro
app.use(express.json({ limit: '10mb' })); // Ajustar limite se necessário
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // true para nested objects, ajustar limite

// Logger de requisições customizado (como já existia)
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path; // Renomeado para evitar conflito com 'path' do módulo
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args: any[]) { // Tipagem de args
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args as any]); // Spread args
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0) { // Logar JSON apenas se não vazio
        const jsonString = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonString.length > 200 ? jsonString.substring(0, 197) + "..." : jsonString}`;
      }
      // Não truncar logLine aqui para manter a informação completa no console do servidor
      log(logLine, req.originalUrl.startsWith('/api') ? 'api-server' : 'express');
    }
  });

  next();
});

(async () => {
  let httpServer: HttpServer;

  if (process.env.NODE_ENV === "development") {
    httpServer = createHttpServer(app); // Criar servidor HTTP para passar ao Vite HMR
    await setupVite(app, httpServer); // Configura Vite para desenvolvimento, que lida com o index.html
                                      // setupVite já inclui o app.use(vite.middlewares) e o fallback para index.html
    // Em dev, rotas API são registradas DEPOIS do Vite para permitir que o Vite trate tudo
    // mas como o middlewareMode do Vite é true, ele deve chamar next() para rotas não tratadas por ele.
    // No entanto, é mais seguro registrar rotas API antes do fallback do Vite.
    // setupVite já tem o app.use('*') para o index.html, então vamos ajustar a ordem.
    // A questão é que o vite.middlewares deve vir antes das rotas API para que o HMR funcione.

    // Correção para dev:
    // 1. Vite middlewares
    // 2. API Routes
    // 3. Vite's index.html fallback (já dentro de setupVite)

    // (setupVite já está configurado para usar `app.use(vite.middlewares)` e `app.use('*', ...)` )
    // Então, precisamos apenas garantir que registerRoutes é chamado após setupVite ter adicionado `vite.middlewares`.
    // No entanto, para que as rotas API tenham prioridade sobre o `app.use('*')` do Vite,
    // `registerRoutes` deve ser chamado *antes* da parte do `app.use('*')` do Vite.
    // A função setupVite já faz isso: app.use(vite.middlewares) e depois app.use('*').
    // Para garantir que as rotas da API sejam verificadas *após* os middlewares do Vite,
    // mas *antes* do fallback do Vite para index.html, a estrutura atual de setupVite é importante.

    // A melhor abordagem em dev é:
    // 1. Middlewares do Vite (para HMR e assets do Vite)
    // 2. Rotas da API
    // 3. Handler do Vite para servir index.html (catch-all)

    // setupVite já está fazendo app.use(vite.middlewares);
    // e app.use('*', async (req, res, next) => { /* vite transform index.html */ });
    // Vamos garantir que registerRoutes seja chamado ENTRE esses dois no setupVite, ou ANTES de setupVite se o fallback do vite for inteligente

    // Reconsiderando: em DEV, o Vite já se encarrega de servir o index.html corretamente.
    // A ordem deve ser: Vite Middlewares, depois API routes.
    // A função `setupVite` já adiciona `vite.middlewares`.
    // O `app.use('*', ...)` dentro de `setupVite` deve ser o último.
    // Então, `registerRoutes` deve vir DEPOIS de `app.use(vite.middlewares)` mas ANTES do `app.use('*', ...)` do Vite.
    // Isso é complexo de gerenciar se `setupVite` encapsula tudo.

    // Abordagem mais simples para DEV:
    // O `setupVite` atual já usa `middlewareMode: true`, o que significa que ele deve chamar `next()`
    // para requisições que não são para assets do Vite.
    // Então, registramos as rotas da API *depois* do `vite.middlewares`.
    // E o `app.use('*', ...)` dentro de `setupVite` trata o fallback.

    // No `setupVite`, `app.use(vite.middlewares)` é chamado.
    // Em seguida, as rotas da API:
    await registerRoutes(app);


  } else { // Modo Produção
    // 1. Servir estáticos da pasta de uploads (se existir)
    const uploadsPath = path.resolve(process.cwd(), "uploads");
    if (fs.existsSync(uploadsPath)) {
        app.use('/uploads', express.static(uploadsPath));
        log(`[StaticServing] Rota /uploads configurada para ${uploadsPath}`, "server-index");
    } else {
        log(`[StaticServing] ATENÇÃO: Diretório de uploads não encontrado: ${uploadsPath}`, "server-index");
    }

    // 2. Registrar rotas da API
    httpServer = createHttpServer(app); // Criar servidor HTTP
    await registerRoutes(app); // Configura as rotas da API ANTES de servir estáticos do frontend

    // 3. Configurar o serviço de arquivos estáticos do frontend (sem o fallback ainda)
    configureStaticServing(app); // Esta função agora só faz app.use(express.static(publicDistPath));

    // 4. Middleware de fallback para o index.html (SPA) - DEVE SER O ÚLTIMO para rotas GET não API
    const publicDistPath = path.resolve(process.cwd(), "dist/public");
    app.get('*', (req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && req.headers.accept && req.headers.accept.includes('html')) {
        const indexPath = path.resolve(publicDistPath, "index.html");
        if (fs.existsSync(indexPath)) {
            log(`[SPA Fallback] Servindo index.html para ${req.path}`, "server-index");
            res.sendFile(indexPath);
        } else {
            log(`[SPA Fallback] ERRO: index.html não encontrado em ${indexPath}`, "server-index");
            res.status(404).send("Frontend não encontrado.");
        }
      } else {
        next(); // Passa para outros middlewares (ex: 404 de API se não tratado)
      }
    });
  }

  // Middleware de tratamento de erros global (manter no final)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[GLOBAL_ERROR_HANDLER] Erro capturado:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Erro Interno do Servidor";
    res.status(status).json({ error: message, details: err.details || err.stack }); // Adicionado details/stack
  });


  const port = process.env.PORT || 5000;
  httpServer.listen({ // Usar httpServer aqui
    port: Number(port), // Garantir que port é número
    host: "0.0.0.0",
  }, () => { // Removido reusePort que não é uma opção padrão de listen
    log(`Servidor escutando na porta ${port} em modo ${process.env.NODE_ENV}`, "server-index");
  });
})();
