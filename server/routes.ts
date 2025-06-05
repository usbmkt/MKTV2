// server/routes.ts
import type { Express, Request, Response, NextFunction, ErrorRequestHandler } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage"; 
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schemaShared from "../shared/schema"; 
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config'; 
import { WhatsappConnectionService } from './services/whatsapp-connection.service';

// --- Configuração Inicial (Multer, etc.) ---
const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');
[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), /* ... (outras configs multer) ... */ });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), /* ... */ });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), /* ... */ });


// --- Tipos e Middlewares ---
export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date(), }; return next(); }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        if (typeof decoded.userId !== 'number') return res.status(403).json({ error: 'Formato de token inválido.' });
        const user = await storage.getUser(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
        if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
        next(error);
    }
};

// --- Gerenciamento do Serviço WhatsApp ---
const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();
function getWhatsappServiceForUser(userId: number): WhatsappConnectionService {
    if (!whatsappServiceInstances.has(userId)) {
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}


// --- Função Principal de Registro de Rotas ---
async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const publicRouter = express.Router();
  const apiRouter = express.Router();
  apiRouter.use(authenticateToken); // Aplica autenticação a todas as rotas do apiRouter

  // --- Rotas Públicas ---
  publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  publicRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  publicRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  publicRouter.get('/auth/login', (req, res) => res.status(405).json({ error: 'Método não permitido. Utilize POST para fazer login.' }));
  
  // --- ROTAS PROTEGIDAS (API) ---
  
  // WhatsApp
  apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/whatsapp/reload-flow', (req, res) => res.json({ message: "Recarga solicitada (implementação pendente)." }));

  // Dashboard
  apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Campanhas
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (e) { next(e); } });
  apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Criativos
  apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Copies e IA
  apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/copies/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/copies/generate', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Orçamentos
  apiRouter.get('/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Alertas
  apiRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Landing Pages & Assets
  apiRouter.get('/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req, res, next) => { /* ... */ });
  apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Agente MCP (Chat)
  apiRouter.post('/mcp/converse', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/mcp/upload-attachment', mcpAttachmentUpload.single('attachment'), async (req, res, next) => { /* ... */ });
  apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getChatSessions(req.user!.id)); } catch (e) { next(e); }});
  apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Funis e Etapas
  apiRouter.get('/funnels', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/funnels', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/funnels/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/funnels/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/funnels/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/funnels/:funnelId/stages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/funnels/:funnelId/stages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/stages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/stages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Fluxos (já corrigidos)
  apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Registrar os routers no app
  app.use('/api', publicRouter);
  app.use('/api', apiRouter);

  // Middlewares de erro
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
