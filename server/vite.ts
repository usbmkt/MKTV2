import { type ViteDevServer, createServer as createViteServer } from "vite";
import type { Express, Request, Response, NextFunction } from "express";
import type { Server as HttpServer } from "http";
import path from 'path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(message: string, context?: string) {
  const timestamp = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  console.log(`${timestamp} [${context || 'server-vite'}] ${message}`);
}

export async function setupVite(app: Express, httpServer: HttpServer) {
  log('Configurando Vite Dev Server...', 'setupVite');
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: { server: httpServer }
    },
    appType: "spa",
    root: path.resolve(__dirname, "..", "client"),
  });

  app.use(vite.middlewares);
  log('Vite Dev Server configurado e middleware adicionado.', 'setupVite');
  
  app.use('*', async (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    try {
      const url = req.originalUrl;
      const templatePath = path.resolve(__dirname, "..", "client", 'index.html');
      let template = fs.readFileSync(templatePath, 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
  log('Middleware SPA fallback do Vite configurado.', 'setupVite');
}

export function serveStatic(app: Express) {
  const clientDistPath = path.resolve(__dirname, "..", "dist", "public");
  log(`[StaticServing] Servindo assets de: ${clientDistPath}`, 'serveStatic');
  
  app.use(express.static(clientDistPath));

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api')) {
        return next();
    }
    if (req.originalUrl.includes('.')) {
        return next();
    }
    res.sendFile(path.resolve(clientDistPath, "index.html"));
  });
}
