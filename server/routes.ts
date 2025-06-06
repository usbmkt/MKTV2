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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config'; 
import { WhatsappConnectionService } from './services/whatsapp-connection.service';

// ... (todo o resto do seu código de configuração de multer e etc. permanece igual)
const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 } });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 } });

export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date() }; return next(); }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
    try {
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
    if (!whatsappServiceInstances.has(userId)) whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    return whatsappServiceInstances.get(userId)!;
}
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); } catch (error) { console.error(error); } }

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    const handleZodError: ErrorRequestHandler = (err, req, res, next) => { if (err instanceof ZodError) return res.status(400).json({ error: "Erro de validação.", details: err.errors }); next(err); };
    const handleError: ErrorRequestHandler = (err, req, res, next) => { console.error(err); res.status(err.statusCode || 500).json({ error: err.message || "Erro interno do servidor." }); };
    
    // --- ROTAS PÚBLICAS (sem alteração) ---
    // ... (seu código de rotas públicas aqui)

    apiRouter.use(authenticateToken);

    // --- ROTAS PROTEGIDAS ---
    // ... (suas outras rotas protegidas aqui)
    
    // ✅ INÍCIO DA CORREÇÃO
    apiRouter.get('/flows', async (req: AuthenticatedRequest, res: Response, next) => {
        try {
            const userId = req.user!.id;
            const flowIdQuery = req.query.id as string | undefined;
            const campaignIdQuery = req.query.campaignId as string | undefined;

            if (flowIdQuery) {
                const flowId = parseInt(flowIdQuery, 10);
                if (isNaN(flowId)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
                const flow = await storage.getFlow(flowId, userId);
                if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado.' });
                return res.json(flow);
            }

            // Lógica de tratamento para campaignId
            let campaignId: number | null | undefined = undefined;
            if (campaignIdQuery === 'null' || campaignIdQuery === 'none') {
                campaignId = null; // Trata 'null' ou 'none' como SQL NULL
            } else if (campaignIdQuery) {
                const parsedId = parseInt(campaignIdQuery, 10);
                if (!isNaN(parsedId)) {
                    campaignId = parsedId;
                }
            }
            
            const flows = await storage.getFlows(userId, campaignId);
            res.json(flows);

        } catch (e) {
            next(e);
        }
    });
    // FIM DA CORREÇÃO

    apiRouter.post('/flows', async (req, res, next) => { try { const data = schemaShared.insertFlowSchema.parse(req.body); res.status(201).json(await storage.createFlow({ ...data, userId: req.user!.id })); } catch(e){ next(e); }});
    apiRouter.put('/flows', async (req, res, next) => { try { const id = parseInt(req.query.id as string); const data = schemaShared.insertFlowSchema.partial().parse(req.body); res.json(await storage.updateFlow(id, data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/flows', async (req, res, next) => { try { await storage.deleteFlow(parseInt(req.query.id as string), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});

    // --- WHATSAPP (sem alteração) ---
    // ... (seu código de rotas do whatsapp aqui)
    apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.connectToWhatsApp(); res.status(202).json({ message: "Iniciando conexão." }); } catch(e) { next(e); }});
    apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res, next) => { try { const status = WhatsappConnectionService.getStatus(req.user!.id); res.json(status || { status: 'disconnected' }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.disconnectWhatsApp(); res.json({ message: "Desconexão solicitada." }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/reload-flow', (req, res) => res.json({ message: "Recarga solicitada (implementação pendente)." }));


    // Registrar Routers e Handlers de Erro
    app.use('/api', publicRouter);
    app.use('/api', apiRouter);
    app.use(handleZodError);
    app.use(handleError);
    
    return createServer(app);
}

export const RouterSetup = {
    registerRoutes: doRegisterRoutes
};
