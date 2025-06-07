import type { Express, Request, Response, NextFunction, ErrorRequestHandler } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schemaShared from "../shared/schema.js";
import { ZodError } from "zod";
import { JWT_SECRET } from './config.js';
import { WhatsappConnectionService } from './services/whatsapp-connection.service.js';
import { handleMCPConversation } from "./mcp_handler.js";
import { logger } from "./logger.js";
import { io } from "./index.js";

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const creativesUpload = multer({
    storage: multer.diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, CREATIVES_ASSETS_DIR),
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 }
});

const lpAssetUpload = multer({
    storage: multer.diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, LP_ASSETS_DIR),
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase())
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const mcpAttachmentUpload = multer({
    storage: multer.diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, MCP_ATTACHMENTS_DIR),
        filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

export interface AuthenticatedRequest extends Request {
    user?: schemaShared.User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (process.env.FORCE_AUTH_BYPASS === 'true') {
            const user = await storage.getUser(1);
            req.user = user || { id: 1, username: 'admin_bypass', email: 'admin@usbmkt.com', password: '', createdAt: new Date(), updatedAt: new Date() };
            return next();
        }
        
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) return res.status(401).json({ error: 'Token não fornecido.' });
        
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
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

export function registerRoutes(app: Express): HttpServer {
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    
    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    // Rota de saúde
    publicRouter.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ status: 'ok' });
    });
    
    // Rotas de Autenticação
    publicRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => { try { const data = schemaShared.insertUserSchema.parse(req.body); const existing = await storage.getUserByEmail(data.email); if (existing) return res.status(409).json({ error: 'Email já cadastrado.' }); const user = await storage.createUser(data); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    publicRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); const user = await storage.getUserByEmail(email); if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' }); const isValid = await storage.validatePassword(password, user.password); if (!isValid) return res.status(401).json({ error: 'Credenciais inválidas.' }); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    
    // Rota pública de Landing Page
    publicRouter.get('/landingpages/slug/:slug', async (req: Request, res: Response, next: NextFunction) => { try { const lp = await storage.getLandingPageBySlug(req.params.slug); if (!lp) return res.status(404).json({ error: 'Página não encontrada' }); res.json(lp); } catch(e) { next(e); } });

    // Middleware de Autenticação para Rotas da API
    apiRouter.use(authenticateToken);
    
    // Rotas da API
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); res.json({ message: "Dashboard data placeholder" }); } catch (e) { next(e); } });
    apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); res.json(await storage.getCampaigns(req.user.id)); } catch (e) { next(e); } });
    apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const data = schemaShared.insertCampaignSchema.parse(req.body); const campaign = await storage.createCampaign({ ...data, userId: req.user.id }); res.status(201).json(campaign); } catch (e) { next(e); } });
    apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' }); const data = schemaShared.insertCampaignSchema.partial().parse(req.body); const campaign = await storage.updateCampaign(id, data, req.user.id); res.json(campaign); } catch (e) { next(e); } });
    apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' }); await storage.deleteCampaign(id, req.user.id); res.status(204).send(); } catch (e) { next(e); } });
    apiRouter.get('/creatives', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const campaignIdQuery = req.query.campaignId as string; const campaignId = campaignIdQuery === 'null' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined); res.json(await storage.getCreatives(req.user.id, campaignId)); } catch (e) { next(e); } });
    apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const data = schemaShared.insertCreativeSchema.parse({ ...req.body, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null }); const creative = await storage.createCreative({ ...data, userId: req.user.id }); res.status(201).json(creative); } catch (e) { next(e); } });
    apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' }); await storage.deleteCreative(id, req.user.id); res.status(204).send(); } catch (e) { next(e); } });
    apiRouter.get('/flows', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const userId = req.user.id; const flowIdQuery = req.query.id as string | undefined; if (flowIdQuery) { const flowId = parseInt(flowIdQuery); if (isNaN(flowId)) return res.status(400).json({ error: 'ID do fluxo inválido.' }); const flow = await storage.getFlow(flowId, userId); return flow ? res.json(flow) : res.status(404).json({ error: 'Fluxo não encontrado.' }); } const campaignIdQuery = req.query.campaignId as string | undefined; let campaignId: number | null | undefined = undefined; if (campaignIdQuery === 'null' || campaignIdQuery === 'none') { campaignId = null; } else if (campaignIdQuery) { const parsedId = parseInt(campaignIdQuery); if (!isNaN(parsedId)) campaignId = parsedId; } res.json(await storage.getFlows(userId, campaignId)); } catch (e) { next(e); } });
    apiRouter.post('/flows', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const dataToParse = { ...req.body, elements: req.body.elements || { nodes: [], edges: [] } }; const data = schemaShared.insertFlowSchema.parse(dataToParse); const flow = await storage.createFlow({ ...data, userId: req.user.id }); res.status(201).json(flow); } catch(e) { next(e); } });
    apiRouter.put('/flows/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' }); const dataToParse = { ...req.body, elements: req.body.elements || undefined }; const data = schemaShared.insertFlowSchema.partial().parse(dataToParse); const flow = await storage.updateFlow(id, data, req.user.id); res.json(flow); } catch(e) { next(e); } });
    apiRouter.post('/mcp/converse', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' }); const { message, sessionId } = req.body; const attachmentUrl = req.file ? `/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}` : undefined; const payload = await handleMCPConversation(req.user.id, message, sessionId ? parseInt(sessionId) : undefined, attachmentUrl); res.json(payload); } catch (e) { next(e); } });
    
    app.use('/public', publicRouter);
    app.use('/api', apiRouter);

    const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof ZodError) return res.status(400).json({ error: 'Dados de entrada inválidos.', details: err.errors });
        logger.error(err, 'Ocorreu um erro inesperado no servidor');
        res.status(500).json({ error: 'Erro interno do servidor.' });
    };
    app.use(errorHandler);

    return createServer(app);
}
