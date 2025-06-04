// server/index.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from "./routes"; // Importação default
import { setupVite } from './vite';
import { PORT } from './config';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || (!req.path.startsWith('/assets') && !req.path.includes('vite') && req.path !== '/api/health')) {
      // console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
});

const uploadsDir = path.join(__dirname, '..', 'uploads');
const ensureUploadsDirs = async () => {
    const dirsToCreate = [
        uploadsDir,
        path.join(uploadsDir, 'lp-assets'),
        path.join(uploadsDir, 'creatives-assets'),
        path.join(uploadsDir, 'mcp-attachments')
    ];
    for (const dir of dirsToCreate) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`[FS] Diretório criado ou já existente: ${dir}`);
        } catch (error) {
            console.error(`[FS_ERROR] Falha ao criar diretório ${dir}:`, error);
        }
    }
};

app.use(apiRoutes); // Uso do router importado

const serveStaticFiles = async () => {
    await ensureUploadsDirs();
    app.use('/uploads', express.static(uploadsDir));
    console.log(`[Static Server] Servindo '/uploads' de ${uploadsDir}`);

    if (process.env.NODE_ENV === 'production') {
        const clientBuildPath = path.join(__dirname, 'public'); 
        console.log(`[Static Server] Tentando servir arquivos estáticos de produção de: ${clientBuildPath}`);
        try {
            await fs.access(clientBuildPath); 
            app.use(express.static(clientBuildPath));
            console.log(`[Static Server] Servindo arquivos estáticos de ${clientBuildPath}`);
            app.get('*', (req, res) => {
                res.sendFile(path.resolve(clientBuildPath, 'index.html'));
            });
            console.log(`[Static Server] Rota fallback '*' configurada para servir index.html de ${clientBuildPath}`);
        } catch (error) {
            console.error(`[Static Server ERROR] Diretório de build do cliente (${clientBuildPath}) não encontrado.`);
            app.get('*', (req, res) => {
                res.status(500).send('Erro: Arquivos do cliente não encontrados. Verifique o processo de build.');
            });
        }
    } else {
        console.log('[Dev Server] Vite irá servir os arquivos do cliente em modo de desenvolvimento.');
        setupVite(app);
    }
};

const startServer = async () => {
    await serveStaticFiles();
    const port = PORT || 5000;
    app.listen(port, () => {
        console.log(`[Server Init] Ambiente: NODE_ENV=${process.env.NODE_ENV}, app.get("env")=${app.get('env')}`);
        console.log(`[Server Init] Servidor HTTP iniciado e escutando na porta ${port}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Dev Server] Frontend deve estar acessível em http://localhost:3000 (ou a porta do Vite)`);
        }
    });
};

startServer().catch(error => {
    console.error("Falha ao iniciar o servidor:", error);
    process.exit(1);
});
