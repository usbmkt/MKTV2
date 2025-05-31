// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  insertUserSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertWhatsappMessageSchema,
  insertCopySchema,
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  User,
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Mantido para /api/copies/generate
import { JWT_SECRET, GEMINI_API_KEY } from './config';
import { handleMCPConversation } from './mcp_handler';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

const creativesUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para criativos.'));
  },
});

const lpAssetUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase());
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.'));
  }
});

const mcpAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para anexos do MCP.'));
  },
});

interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
    if (typeof decoded.userId !== 'number') return res.status(403).json({ error: 'Token inválido: userId não é numérico.' });
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Erro de validação",
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  next(err);
};

const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}.`});
  }
  if (err.message && (err.message.includes('Tipo de arquivo inválido') || (err as any).code === 'LIMIT_FILE_SIZE' || (err as any).code === 'ENOENT')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.constructor && err.constructor.name === 'GoogleGenerativeAIFetchError') {
     const generativeError = err as any;
     return res.status(generativeError.status || 500).json({ error: `Erro na IA: ${generativeError.message || 'Erro desconhecido.'}` });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || 'Erro interno do servidor.' });
};

export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));
  app.post('/api/auth/register', async (req, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/auth/login', async (req, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  
  let localGenAIForCopies: GoogleGenerativeAI | null = null;
  if (GEMINI_API_KEY && !localGenAIForCopies) {
    try {
      localGenAIForCopies = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (error) { /* ... */ }
  }
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { product, audience, objective, tone } = req.body;
      if (!product || !audience || !objective || !tone) return res.status(400).json({ error: "Campos obrigatórios ausentes." });
      if (!localGenAIForCopies) return res.status(500).json({ error: "Serviço de IA não disponível." });
      const model = localGenAIForCopies.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const prompts = [
         { type: 'headline', platform: 'Facebook', prompt: `Crie um headline persuasivo para Facebook Ads sobre "${product}" para "${audience}" com o objetivo de "${objective}" em um tom "${tone}". Use no máximo 60 caracteres e seja impactante.` },
         { type: 'cta', platform: 'Google Ads', prompt: `Crie um call-to-action (CTA) para Google Ads sobre "${product}" para "${audience}" com o objetivo de "${objective}" em um tom "${tone}". Limite de 30 palavras.` },
         { type: 'description', platform: 'Instagram', prompt: `Crie uma descrição curta e persuasiva para Instagram sobre "${product}" para "${audience}" com o objetivo de "${objective}" em um tom "${tone}". Use no máximo 125 caracteres.` }
      ];
      const generatedCopies = [];
      for (const promptData of prompts) {
        try {
          const result = await model.generateContent(promptData.prompt);
          generatedCopies.push({ type: promptData.type, content: result.response.text().trim(), platform: promptData.platform });
        } catch (error) {
          generatedCopies.push({ type: promptData.type, content: `Fallback: ${product} para ${audience} (${promptData.type})`, platform: promptData.platform });
        }
      }
      res.json(generatedCopies);
    } catch (error) { next(error); }
  });

  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  
  // COORDENADA 1 (routes.ts): Rota /api/mcp/converse modificada
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId, attachmentUrl, mcpContext } = req.body; // Adicionado mcpContext
      const userId = req.user!.id;
      
      // Chama o handler refatorado, passando o contexto do cliente
      const result = await handleMCPConversation(userId, message, sessionId, attachmentUrl, mcpContext);
      res.json(result);
    } catch (error) {
      console.error('[MCP_CONVERSE_ROUTE] Erro ao processar conversa:', error);
      next(error);
    }
  });

  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... (inalterado) ... */ });

  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}
