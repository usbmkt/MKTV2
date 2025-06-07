// server/vite.ts
import { type ViteDevServer, createServer as createViteServer } from "vite";
import type { Express } from "express";
import { type Server as HttpServer } from "http";
import path from 'path';
import { fileURLToPath } from 'node:url';
import express from 'express'; // Importar express para app.use(express.static)

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(message: string, context?: string) {
  const timestamp = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  console.log(`${timestamp} [${context || 'server-vite'}] ${message}`); // Contexto ajustado
}

export async function setupVite(app: Express, httpServer: HttpServer) {
  log('Configurando Vite Dev Server...', 'setupVite');
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: {
        server: httpServer, // Conecta o HMR ao servidor HTTP principal
        // overlay: false // Descomente para desabilitar o overlay de erro do Vite se preferir
      }
    },
    appType: "spa", // 'spa' é comum para SPAs com fallback para index.html
    root: path.resolve(__dirname, "..", "client"), // Raiz do cliente
    // configFile: path.resolve(__dirname, "..", "vite.config.ts") // Opcional se o Vite encontrar automaticamente
  });

  // Adiciona o middleware do Vite ao Express
  // Isso permite que o Vite manipule as requisições para assets do frontend
  app.use(vite.middlewares);
  log('Vite Dev Server configurado e middleware adicionado.', 'setupVite');
  
  // Middleware de fallback para servir index.html para todas as rotas não-API e não-Vite
  // Deve vir depois das rotas da API e do middleware do Vite
  app.use('*', async (req, res, next) => {
    // Se a requisição não for para a API, tenta servir via Vite
    if (req.originalUrl.startsWith('/api')) {
      return next(); // Pula para o próximo handler (rotas da API)
    }
    try {
      const url = req.originalUrl;
      let template = await vite.transformIndexHtml(url, fs.readFileSync(path.resolve(path.resolve(__dirname, "..", "client"), 'index.html'), 'utf-8'));
      
      // Adiciona variáveis de ambiente ao HTML se necessário
      // template = template.replace('', `<script>window.process = { env: ${JSON.stringify(safeEnvVars)} };</script>`);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      if (e instanceof Error) {
         vite.ssrFixStacktrace(e);
         log(`Erro no middleware SPA fallback do Vite: ${e.message}`, 'setupVite-error');
         next(e);
      } else {
         log(`Erro desconhecido no middleware SPA fallback do Vite`, 'setupVite-error');
         next(new Error('Erro desconhecido no processamento da requisição SPA.'));
      }
    }
  });
  log('Middleware SPA fallback do Vite configurado.', 'setupVite');
}


// Nova função serveStatic movida para cá e exportada
export function serveStatic(app: Express) {
  const clientDistPath = path.resolve(__dirname, "..", "dist", "public");
  log(`[StaticServing] Servindo assets do frontend de: ${clientDistPath}`, 'serveStatic');
  
  // Servir arquivos estáticos da pasta de build do cliente
  app.use(express.static(clientDistPath));

  // SPA fallback: para qualquer rota não tratada (não-API, não-arquivo estático), servir index.html
  // Isso garante que o roteamento do lado do cliente funcione corretamente em produção.
  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) { // Não aplicar fallback para rotas de API
        return next();
    }
    if (req.originalUrl.includes('.')) { // Não aplicar fallback se parece ser uma requisição de arquivo com extensão
        return next();
    }
    log(`[SPA Fallback] Servindo index.html para ${req.originalUrl}`, 'serveStatic');
    res.sendFile(path.resolve(clientDistPath, "index.html"));
  });
}

// Adiciona importação de fs se ainda não estiver lá (para vite.transformIndexHtml)
import fs from 'fs';
