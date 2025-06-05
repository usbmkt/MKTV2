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
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), /* ... */ });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), /* ... */ });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), /* ... */ });

export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date() }; return next(); }
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

const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();
function getWhatsappServiceForUser(userId: number): WhatsappConnectionService {
    if (!whatsappServiceInstances.has(userId)) {
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    // --- Middlewares de Erro (Definidos dentro da função para garantir escopo) ---
    const handleZodError: ErrorRequestHandler = (err, req, res, next) => {
        if (err instanceof ZodError) {
            return res.status(400).json({ error: "Erro de validação nos dados enviados.", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
        }
        next(err);
    };

    const handleError: ErrorRequestHandler = (err, req, res, next) => {
        console.error(`[HANDLE_ERROR] Erro não tratado para ${req.method} ${req.originalUrl}:`, err.message);
        if (err.stack) console.error(err.stack);
        const statusCode = err.statusCode || 500;
        const message = err.message || "Erro interno do servidor.";
        res.status(statusCode).json({ error: message });
    };

    let genAI: GoogleGenerativeAI | null = null;
    if (GEMINI_API_KEY) { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); } catch (error) { console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error); }}
    
    // --- Rotas Públicas ---
    publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    // ... (sua lógica para /auth/login e /auth/register) ...
    publicRouter.post('/auth/login', async (req, res, next) => { /* ... */ });

    // --- Middleware de Autenticação para rotas protegidas ---
    apiRouter.use(authenticateToken);
    
    // --- Rotas Protegidas ---
    // (Cole aqui TODAS as suas rotas do apiRouter que precisam de autenticação, como na versão anterior)
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getDashboardData(req.user!.id, '30d')); } catch (e) { next(e); }});
    apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (e) { next(e); } });
    apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCreatives(req.user!.id)); } catch (e) { next(e); } });
    apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getFlows(req.user!.id)); } catch (e) { next(e); }});
    // E assim por diante para TODAS as rotas que estavam dando 404...
    
    // Rotas do WhatsApp
    apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.connectToWhatsApp(); res.status(202).json({ message: "Iniciando conexão." }); } catch(e) { next(e); }});
    apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res, next) => { try { const status = WhatsappConnectionService.getStatus(req.user!.id); res.json(status || { status: 'disconnected' }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.disconnectWhatsApp(); res.json({ message: "Desconexão solicitada." }); } catch(e) { next(e); }});


    // Registrar os routers no app
    app.use('/api', publicRouter);
    app.use('/api', apiRouter);

    // Registrar Middlewares de Erro no Final
    app.use(handleZodError);
    app.use(handleError);

    const httpServer = createServer(app);
    return httpServer;
}

export const RouterSetup = {
    registerRoutes: doRegisterRoutes
};
