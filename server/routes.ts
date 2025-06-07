// usbmkt/mktv2/MKTV2-mktv5/server/routes.ts
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
        destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 }
});

const lpAssetUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase())
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const mcpAttachmentUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR),
        filename: (req, file, cb) => {
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
            req.user = user || {
                id: 1, username: 'admin_bypass', email: 'admin@usbmkt.com', password: '', createdAt: new Date(), updatedAt: new Date()
            };
            return next();
        }
        
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
        
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
    
    // --- ROTAS PÚBLICAS ---
    // ... (rotas públicas sem alteração)

    // --- ROTAS PROTEGIDAS ---
    apiRouter.use(authenticateToken);
    
    // ... (outras rotas de API sem alteração) ...

    // Landing Pages
    apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const lpData = schemaShared.insertLandingPageSchema.parse({ ...req.body });
            const landingPage = await storage.createLandingPage({ ...lpData, userId: req.user.id });
            res.status(201).json(landingPage);
        } catch(e) { next(e); }
    });
    
    apiRouter.put('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da landing page inválido.' });
            const lpData = schemaShared.insertLandingPageSchema.partial().parse(req.body);
            const landingPage = await storage.updateLandingPage(id, lpData, req.user.id);
            res.json(landingPage);
        } catch(e) { next(e); }
    });

    // Budgets
    apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertBudgetSchema.parse(req.body);
            const budget = await storage.createBudget({ ...data, userId: req.user.id });
            res.status(201).json(budget);
        } catch (e) { next(e); }
    });
    
    // Flows
    apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const dataToParse = { ...req.body, elements: req.body.elements || { nodes: [], edges: [] } };
            const data = schemaShared.insertFlowSchema.parse(dataToParse);
            const flow = await storage.createFlow({ ...data, userId: req.user.id });
            res.status(201).json(flow);
        } catch(e) { next(e); }
    });
    
    apiRouter.put('/flows/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
            const dataToParse = { ...req.body, elements: req.body.elements || undefined };
            const data = schemaShared.insertFlowSchema.partial().parse(dataToParse);
            const flow = await storage.updateFlow(id, data, req.user.id);
            res.json(flow);
        } catch(e) { next(e); }
    });
    
    // WhatsApp routes
    apiRouter.post('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const { contactNumber, message } = schemaShared.insertWhatsappMessageSchema
                .pick({ contactNumber: true, message: true }).parse(req.body);
            const service = getWhatsappServiceForUser(req.user.id);
            const fullJid = contactNumber.endsWith('@s.whatsapp.net') ? contactNumber : `${contactNumber}@s.whatsapp.net`;
            await service.sendMessage(fullJid, { text: message });
            const savedMessage = await storage.createMessage({
                userId: req.user.id, contactNumber, message, direction: 'outgoing' as const
            });
            if (savedMessage) {
                io.to(`user_${req.user.id}`).emit('new_message', savedMessage);
                res.status(201).json(savedMessage);
            } else {
                res.status(500).json({ error: 'Erro ao salvar mensagem.' });
            }
        } catch (e) { next(e); }
    });
    
    // Chat Sessions
    apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertChatSessionSchema.parse(req.body);
            const session = await storage.createChatSession(req.user.id, data.title);
            res.status(201).json(session);
        } catch (e) { next(e); }
    });
    
    // ... (Resto das rotas e error handlers permanecem os mesmos)
    app.use('/api', apiRouter);

    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        if (err instanceof ZodError) {
            return res.status(400).json({ error: 'Dados de entrada inválidos.', details: err.errors });
        }
        logger.error(err, 'Ocorreu um erro inesperado no servidor');
        res.status(500).json({ error: 'Erro interno do servidor.' });
    };
    app.use(errorHandler);

    return createServer(app);
}
