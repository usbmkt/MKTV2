import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger, type ViteDevServer } from "vite"; // Adicionado ViteDevServer
import { type Server } from "http";
import viteConfigFunction from "../vite.config"; // Importando como função
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

export async function setupVite(app: Express, server: Server): Promise<ViteDevServer> { // Adicionado tipo de retorno
  const viteConfig = viteConfigFunction({ command: 'serve', mode: 'development' }); // Executa a função de configuração

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    host: true,
    ...viteConfig.server, // Adiciona configurações do server do vite.config.ts
  };

  const vite = await createViteServer({
    ...viteConfig, // Usa a configuração resolvida
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // process.exit(1); // Removido para não derrubar em erros menores de HMR
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        viteConfig.root || path.resolve(import.meta.dirname, "..", "client"), // Usa root do viteConfig
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        /src="\/src\/main\.tsx"/, // Regex mais flexível
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      if (e instanceof Error) vite.ssrFixStacktrace(e); // Type assertion
      next(e);
    }
  });
  return vite; // Retorna a instância do vite
}

export function configureStaticServing(app: Express) { // Renomeado e modificado
  const publicDistPath = path.resolve(process.cwd(), "dist/public");
  const uploadsPath = path.resolve(process.cwd(), "uploads");

  log(`[StaticServing] Servindo de: ${publicDistPath}`, "static-config");
  log(`[StaticServing] Servindo uploads de: ${uploadsPath}`, "static-config");


  if (!fs.existsSync(publicDistPath)) {
    log(`[StaticServing] ATENÇÃO: Diretório de build do frontend não encontrado: ${publicDistPath}. Certifique-se que 'npm run build' foi executado.`, "static-config");
    // Não lançar erro aqui, pois pode ser um ambiente de dev sem build ainda.
    // A falha em servir o index.html será tratada depois.
  }

  // Servir arquivos estáticos de 'dist/public' (onde o Vite coloca os assets)
  app.use(express.static(publicDistPath));

  // Servir arquivos de 'uploads'
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
    log(`[StaticServing] Rota /uploads configurada para ${uploadsPath}`, "static-config");
  } else {
    log(`[StaticServing] ATENÇÃO: Diretório de uploads não encontrado: ${uploadsPath}`, "static-config");
  }
}

// A função de fallback do index.html será movida para server/index.ts
// para melhor controle da ordem dos middlewares.
