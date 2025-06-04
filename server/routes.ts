// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
// REMOVER: import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Diretório criado: ${dir}`);
    }
});

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[GEMINI] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada.");
}

// Configurações do Multer (sem alterações)
const creativesUpload = multer({ /* ... */ });
const lpAssetUpload = multer({ /* ... */ });
const mcpAttachmentUpload = multer({ /* ... */ });


interface AuthenticatedRequest extends Request {
  user?: schema.User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH] Bypass ativo - criando usuário mock');
    // @ts-ignore
    req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@usbmkt.com' };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; /* ... */ };
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (error) {
    // ... tratamento de erro JWT ...
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... */ };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... */ };

// ALTERADO: Não retorna mais HttpServer, retorna Promise<void> ou void
export async function registerRoutes(app: Express): Promise<void> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req: Request, res: Response) => { /* ... */ });
  app.post('/api/auth/register', async (req, res, next) => { /* ... */ });
  app.post('/api/auth/login', async (req, res, next) => { /* ... */ });

  // Aplicar middleware de autenticação para rotas protegidas
  app.use(authenticateToken);

  app.get('/api/dashboard', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Campaigns
  app.get('/api/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Creatives
  app.get('/api/creatives', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/creatives/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // WhatsApp
  app.get('/api/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/whatsapp/contacts', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Copies
  app.get('/api/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/copies/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/copies/generate', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Alerts
  app.get('/api/alerts', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Budgets
  app.get('/api/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Landing Pages
  app.get('/api/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/landingpages/slug/:slug', async (req, res, next) => { /* ... */ }); // Rota pública
  app.get('/api/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Landing Page Assets
  app.post('/api/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // MCP
  app.post('/api/mcp/upload-attachment', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/mcp/converse', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // Chat Sessions
  app.post('/api/chat/sessions', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/chat/sessions', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Servir arquivos estáticos de uploads (esta linha deve estar aqui ou em server/index.ts, mas antes do error handlers)
  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR), {
    fallthrough: false, 
    index: false 
  }));

  app.use(handleZodError);
  app.use(handleError);

  // REMOVER a criação e retorno do servidor HTTP daqui
  // const httpServer = createHttpServer(app);
  // return httpServer;
}

// Manter as implementações completas das rotas como estavam antes, apenas removendo a criação do servidor.
// Por exemplo, a rota de health check:
/*
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'MKTV5',
      version: '1.0.0' // Você pode pegar do package.json se quiser
    });
  });
*/
// E todas as outras rotas...
