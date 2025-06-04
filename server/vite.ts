import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger, type ViteDevServer } from "vite"; // Adicionado ViteDevServer
// @ts-ignore
import viteConfigFunction from "../vite.config";
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server): Promise<ViteDevServer> {
  // @ts-ignore
  const viteConfig = viteConfigFunction({ command: 'serve', mode: 'development' });

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    host: true,
    ...viteConfig.server, 
  };

  const vite = await createViteServer({
    ...viteConfig, 
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Este handler de fallback DEVE vir DEPOIS do registerRoutes em server/index.ts para dev
  // Por isso, não o chamamos aqui se vamos registrar rotas depois
  // No entanto, para simplificar, podemos deixar como está e garantir a ordem no server/index.ts
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    // Se a rota for de API, não servir index.html
    if (url.startsWith('/api/') || url.startsWith('/uploads/')) {
        return next();
    }
    try {
      const clientRoot = viteConfig.root || path.resolve(import.meta.dirname, "..", "client");
      const clientTemplate = path.resolve(
        clientRoot,
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        /src="\/src\/main\.tsx"/, 
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      if (e instanceof Error) vite.ssrFixStacktrace(e); 
      next(e);
    }
  });
  return vite; 
}

export function configureStaticServing(app: Express) { 
  const publicDistPath = path.resolve(process.cwd(), "dist/public");
  const uploadsPath = path.resolve(process.cwd(), "uploads");

  log(`[StaticServing] Servindo assets do frontend de: ${publicDistPath}`, "static-config");
  
  if (fs.existsSync(publicDistPath)) {
    app.use(express.static(publicDistPath));
  } else {
    log(`[StaticServing] ATENÇÃO: Diretório de build do frontend não encontrado: ${publicDistPath}.`, "static-config");
  }

  log(`[StaticServing] Verificando diretório de uploads em: ${uploadsPath}`, "static-config");
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
    log(`[StaticServing] Rota /uploads configurada para ${uploadsPath}`, "static-config");
  } else {
    log(`[StaticServing] ATENÇÃO: Diretório de uploads não encontrado: ${uploadsPath}`, "static-config");
  }
}
