// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger, type ViteDevServer } from "vite"; // Adicionado ViteDevServer para tipagem
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express-server") { // Alterado source padrão para evitar confusão
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    // host: true, // 'true' pode ser problemático, melhor especificar ou omitir para padrão.
  };

  const vite: ViteDevServer = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // process.exit(1); // Sair no erro pode ser muito agressivo para HMR
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
        // import.meta.dirname pode ser problemático dependendo do bundler/runtime.
        // Usar __dirname se estiver em CJS context ou uma forma mais robusta de obter o caminho do projeto.
        // Para esbuild e output ESM, import.meta.url é o caminho correto.
        path.dirname(fileURLToPath(import.meta.url)), // Supondo que fileURLToPath esteja disponível
        "..", // Para sair de 'dist/' se 'vite.ts' estiver em 'dist/' após build do server
        "client",
        "index.html",
      );
      
      // Se o server/vite.ts é copiado para dist/server/vite.ts e o root do server é dist/
      // let templatePathAttempt = path.resolve(__dirname, "..", "client", "index.html"); // Se __dirname é dist/server
      // if(!fs.existsSync(templatePathAttempt)) { // Fallback se o server está em dist/ e vite.ts em dist/server
      //    templatePathAttempt = path.resolve(__dirname, "..", "..", "client", "index.html"); 
      // }
      // log(`[SetupVite] Tentando carregar template de: ${clientTemplate}`, "vite-dev");


      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`, // Cache busting
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e: any) {
      vite.ssrFixStacktrace(e as Error);
      log(`[SetupVite] Erro ao transformar HTML: ${e.message}`, "vite-dev-error");
      next(e);
    }
  });
}

// Função para obter fileURLToPath se não estiver disponível globalmente (Node.js ESM context)
function fileURLToPath(url: string): string {
    if (url.startsWith('file://')) {
        return decodeURIComponent(url.substring(process.platform === 'win32' ? 8 : 7));
    }
    return url;
}


export function serveStatic(app: Express) {
  // CORREÇÃO: 'import.meta.url' pode não ser o caminho esperado dependendo de como esbuild empacota.
  // Se dist/index.js é o entry point e 'vite.ts' é parte dele:
  // __dirname (se o output for CJS) ou um path relativo ao CWD do processo pode ser mais estável.
  // Assumindo que o processo roda da raiz do projeto OU que dist/index.js sabe sua localização.
  // Se dist/index.js é executado, path.resolve(path.dirname(''), 'dist', 'public') é mais robusto.
  // No entanto, o manual indica que dist/index.js é o ponto de entrada, então import.meta.url dentro dele
  // DEVERIA se referir a dist/index.js.
  
  // Tentativa de caminho robusto:
  // Se o script está em dist/index.js, `path.dirname(fileURLToPath(import.meta.url))` é 'dist/'
  const currentModuleDir = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(currentModuleDir, "public");
  
  log(`[ServeStatic] Tentando servir arquivos estáticos de: ${distPath}`, "static-server");

  if (!fs.existsSync(distPath)) {
    log(`[ServeStatic] ERRO: Diretório de build NÃO ENCONTRADO: ${distPath}`, "static-server-error");
    // Não lançar erro aqui pode permitir que o app continue e mostre um 404 mais genérico, 
    // mas é melhor saber se o path está errado.
    // Considerar um fallback ou log mais detalhado.
    // Para este caso, vamos permitir que prossiga para ver se o '*' pega, mas logamos o erro.
  } else {
    log(`[ServeStatic] Diretório de build ENCONTRADO: ${distPath}`, "static-server");
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      log(`[ServeStatic] ERRO: index.html NÃO ENCONTRADO em: ${indexPath}`, "static-server-error");
    } else {
      log(`[ServeStatic] index.html ENCONTRADO em: ${indexPath}`, "static-server");
    }
  }

  // Servir arquivos estáticos da pasta distPath (ex: /assets/...)
  app.use(express.static(distPath));

  // Fallback para todas as outras rotas (SPA routing)
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    log(`[ServeStatic] Fallback: Servindo index.html de ${indexPath} para ${req.originalUrl}`, "static-server");
    res.sendFile(indexPath, (err) => {
      if (err) {
        log(`[ServeStatic] ERRO ao enviar index.html para ${req.originalUrl}: ${(err as Error).message}`, "static-server-error");
        // Verificar o status do erro e responder adequadamente
        // res.status(500).send("Erro ao servir a aplicação.");
        // Se o arquivo não for encontrado aqui, significa que distPath ou indexPath está errado.
        // O Express já envia um 404 por padrão se sendFile falhar por arquivo não encontrado.
         if (!res.headersSent) {
           res.status(404).send("Página não encontrada (fallback falhou).");
         }
      }
    });
  });
}
