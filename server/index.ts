// MKTV2/server/index.ts
import dotenv from "dotenv";
dotenv.config(); // Carrega .env da raiz do MKTV2

import express, { type Request, Response, NextFunction } from "express";
import path from 'path'; // Para caminhos de arquivo
import { fileURLToPath } from 'url'; // Para __dirname em ES Modules
import { RouterSetup } from "./routes"; // Router principal do MKTV2
import { setupVite, serveStatic, log } from "./vite";

// --- Importações para o Módulo Zap ---
// Assumindo que o build do Zap server gera um 'zapApiRouter.js' em 'dist/zap-server/'
// ou que você pode importar diretamente do 'zap/dist_server/routes.js' se o esbuild do MKTV2 não o cobrir.
// Esta parte pode precisar de ajuste fino dependendo da sua estratégia de build final.
// Por simplicidade, vamos assumir que podemos importar o router do Zap.
// Se o `build:zap:server` compila para `zap/dist_server`, o caminho seria relativo a `dist/` do MKTV2.
// const zapDistServerPath = path.join(__dirname, 'zap-server'); // Se copiado para cá
// Alternativamente, importar do local de build do Zap:
import zapApiRoutes from '../../zap/dist_server/routes.js'; // Ajuste o path conforme sua estrutura de build
import { initializeActiveConnections as initializeZapBaileysConnections } from '../../zap/dist_server/services/WhatsappConnectionService.js'; // Ajuste o path

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // __dirname para ES Modules

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 

// Middleware de Logging (seu logger existente)
app.use((req, res, next) => { /* ... (seu logger como antes) ... */ next(); });

(async () => {
  try {
    // --- Integração do Módulo Zap ---
    log('Inicializando Módulo Zap...', 'zap-integration');
    
    // 1. Montar rotas da API do Zap
    // O router do Zap (zap/server/routes.ts) deve ser exportado como default.
    // O build do Zap (npm run build:server --prefix zap) gera em zap/dist_server/
    app.use('/api/zap', zapApiRoutes); 
    log('Rotas da API do Zap montadas em /api/zap', 'zap-integration');

    // 2. Servir assets e o index.html do cliente Zap para a rota /whatsapp
    const zapClientDistPath = path.resolve(__dirname, '..', '..', 'zap', 'client', 'dist'); // Caminho para zap/client/dist
    const zapClientAssetsPath = path.join(zapClientDistPath, 'assets');

    log(`Configurando rota estática para assets do Zap: ${zapClientAssetsPath}`, 'zap-integration');
    app.use('/assets-zap', express.static(zapClientAssetsPath)); // Servir assets do cliente Zap

    log(`Configurando rota para servir o cliente Zap em /whatsapp e /whatsapp/* de: ${zapClientDistPath}`, 'zap-integration');
    app.use('/whatsapp', express.static(zapClientDistPath)); // Para arquivos na raiz do dist do Zap (ex: logo.svg)
    app.get('/whatsapp/*', (req, res) => { // Catch-all para o roteamento do cliente React do Zap
        res.sendFile(path.join(zapClientDistPath, 'index.html'));
    });
    log('Cliente Zap configurado para ser servido em /whatsapp', 'zap-integration');

    // 3. Inicializar serviços de background do Zap (Baileys)
    // A função initializeActiveConnections deve estar no WhatsappConnectionService do Zap
    await initializeZapBaileysConnections();
    log('Serviços de conexão Baileys do Zap inicializados.', 'zap-integration');
    // --- Fim da Integração do Módulo Zap ---


    // Registrar rotas principais do MKTV2 (seu RouterSetup existente)
    const server = await RouterSetup.registerRoutes(app); 
    log('Rotas principais do MKTV2 registradas.', 'server-init');

    // Middleware de erro global (seu handler existente)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => { /* ... */ });

    log(`Ambiente: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get("env")}`, 'server-init');
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server); // Configura Vite para o cliente MKTV2 principal
    } else {
      serveStatic(app); // Serve o cliente MKTV2 principal (dist/public)
    }

    const port = process.env.PORT || 5000;
    server.listen({ port, host: "0.0.0.0" }, () => {
      log(`Servidor HTTP MKTV2 (com Zap integrado) iniciado na porta ${port}`, 'server-init');
    });

  } catch (error) {
    console.error("Falha crítica ao iniciar o servidor MKTV2:", error);
    process.exit(1);
  }
})();
