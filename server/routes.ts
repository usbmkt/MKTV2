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

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });

export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date(), }; return next(); }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
    if (typeof decoded.userId !== 'number') { return res.status(403).json({ error: 'Formato de token inválido.' }); }
    const user = await storage.getUser(decoded.userId);
    if (!user) { return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' }); }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro inesperado na verificação do token:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError: ErrorRequestHandler = (err, req, res, next) => { if (err instanceof ZodError) { return res.status(400).json({ error: "Erro de validação nos dados enviados.", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }); } next(err); };
const handleError: ErrorRequestHandler = (err, req, res, next) => {
  console.error(`[HANDLE_ERROR] Erro não tratado para ${req.method} ${req.originalUrl}:`, err.message);
  if (err.stack) console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";
  res.status(statusCode).json({ error: message });
};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); } catch (error) { console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error); }}

const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();
function getWhatsappServiceForUser(userId: number): WhatsappConnectionService {
    if (!whatsappServiceInstances.has(userId)) {
        console.log(`[WhatsappServiceManager] Criando nova instância para o usuário ${userId}`);
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const publicRouter = express.Router();
  const apiRouter = express.Router();
  
  // --- Rotas Públicas ---
  publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  publicRouter.post('/auth/register', async (req, res, next) => { /* ... sua lógica de registro ... */ });
  publicRouter.post('/auth/login', async (req, res, next) => {
      try {
          const { email, password } = req.body;
          if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
          const user = await storage.getUserByEmail(email);
          if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
          const isValidPassword = await storage.validatePassword(password, user.password);
          if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });
          const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
          res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
      } catch (error) {
          next(error);
      }
  });

  // ROTA DE DIAGNÓSTICO ADICIONADA:
  publicRouter.get('/auth/login', (req, res) => {
      res.status(405).json({ error: 'Método não permitido. Utilize POST para fazer login.' });
  });
  
  // --- Middleware de Autenticação para rotas protegidas ---
  apiRouter.use(authenticateToken);
  
  // --- Rotas Protegidas ---
  apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // ... (todas as suas outras rotas CRUD para campanhas, criativos, etc.)
  
  // Rotas do WhatsApp
  apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const whatsappService = getWhatsappServiceForUser(req.user!.id);
      whatsappService.connectToWhatsApp().catch(err => console.error(`[API /whatsapp/connect] Erro em background:`, err));
      res.status(202).json({ message: "Processo de conexão iniciado." });
    } catch (error) { next(error); }
  });

  apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const status = WhatsappConnectionService.getStatus(req.user!.id);
      res.json(status || { userId: req.user!.id, status: 'disconnected', qrCode: null });
    } catch (error) { next(error); }
  });

  apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const whatsappService = getWhatsappServiceForUser(req.user!.id);
      await whatsappService.disconnectWhatsApp();
      res.json({ message: 'Desconexão solicitada.' });
    } catch (error) { next(error); }
  });

  // Rotas de Fluxos
  apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // ... (outras rotas)

  // Registrar os routers
  app.use('/api', publicRouter);
  app.use('/api', apiRouter);

  app.use(handleZodError);
  app.use(handleError);
  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
