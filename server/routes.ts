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
import { JWT_SECRET, GEMINI_API_KEY, PORT as SERVER_PORT } from './config'; 
// --- IMPORTAÇÃO ADICIONADA ---
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

const handleZodError: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ZodError) { return res.status(400).json({ error: "Erro de validação nos dados enviados.", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }); }
  next(err);
};

const handleError: ErrorRequestHandler = (err, req, res, next) => {
  console.error(`[HANDLE_ERROR] Erro não tratado para ${req.method} ${req.originalUrl}:`, err.message);
  if (err.stack) console.error(err.stack);
  if (err.constructor && err.constructor.name === "GoogleGenerativeAIFetchError") { const generativeError = err as any; const status = generativeError.status || 500; const message = generativeError.message || "Erro ao comunicar com o serviço de IA."; return res.status(status).json({ error: `Erro na IA: ${message}` }); }
  const statusCode = err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";
  res.status(statusCode).json({ error: message });
}; 

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log("[GEMINI] SDK do Gemini inicializado com sucesso."); } catch (error) { console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error); genAI = null; }} else { console.warn("[GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada.");}

// --- LÓGICA DO WHATSAPP SERVICE ---
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
  apiRouter.use(authenticateToken); // Aplica autenticação a todas as rotas do apiRouter

  // --- Rotas Públicas ---
  publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  publicRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  publicRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  
  // --- Rotas do WhatsApp (Protegidas) ---
  apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const whatsappService = getWhatsappServiceForUser(req.user!.id);
      whatsappService.connectToWhatsApp().catch(err => {
          console.error(`[API /whatsapp/connect] Erro em background na conexão para usuário ${req.user!.id}:`, err);
      });
      res.status(202).json({ message: "Processo de conexão iniciado." });
    } catch (error) { next(error); }
  });

  apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const status = WhatsappConnectionService.getStatus(req.user!.id);
      if (status) {
        res.json(status);
      } else {
        res.json({ userId: req.user!.id, status: 'disconnected', qrCode: null });
      }
    } catch (error) { next(error); }
  });

  apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const whatsappService = getWhatsappServiceForUser(req.user!.id);
      await whatsappService.disconnectWhatsApp();
      res.json({ message: 'Desconexão solicitada.' });
    } catch (error) { next(error); }
  });
  
  // --- Rotas de Fluxos (Protegidas) ---
  apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => {
    try {
      const clientData = req.body;
      const validatedClientData = schemaShared.insertFlowSchema.parse(clientData);
      const dataForStorage: schemaShared.InsertFlow = { ...validatedClientData, userId: req.user!.id };
      const newFlow = await storage.createFlow(dataForStorage);
      res.status(201).json(newFlow);
    } catch (e) { next(e); }
  });
  apiRouter.put('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/flows', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/whatsapp/reload-flow', async (req, res, next) => { /* ... */ });
  
  // --- Restante das Rotas (Dashboard, Campanhas, etc. - todas protegidas) ---
  apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  // ... adicione todas as outras rotas ao apiRouter
  
  // Registrar os routers no app
  app.use('/api', publicRouter);
  app.use('/api', apiRouter);

  // Middlewares de erro no final
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
