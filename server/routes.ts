// server/routes.ts
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

// Cria os diretórios para upload se não existirem
[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configuração do Multer para upload de criativos
const creativesUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 } // Limite de 15MB
});

// Configuração do Multer para upload de assets de Landing Page
const lpAssetUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase())
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

// Configuração do Multer para upload de anexos do chat MCP
const mcpAttachmentUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

// Interface para requisições autenticadas
export interface AuthenticatedRequest extends Request {
    user?: schemaShared.User;
}

// Middleware para verificar o token JWT
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Bypass de autenticação para ambiente de desenvolvimento
        if (process.env.FORCE_AUTH_BYPASS === 'true') {
            const user = await storage.getUser(1);
            req.user = user || {
                id: 1,
                username: 'admin_bypass',
                email: 'admin@usbmkt.com',
                password: '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            return next();
        }
        
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido.' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        const user = await storage.getUser(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expirado.' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({ error: 'Token inválido.' });
        }
        next(error); // Passa outros erros para o error handler
    }
};

// Gerenciador de instâncias do serviço WhatsApp
const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();

function getWhatsappServiceForUser(userId: number): WhatsappConnectionService {
    if (!whatsappServiceInstances.has(userId)) {
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}

// =========================================================================
// FUNÇÃO PRINCIPAL QUE REGISTRA TODAS AS ROTAS NA APLICAÇÃO EXPRESS
// =========================================================================
export function registerRoutes(app: Express): HttpServer {
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    
    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    // ------------------------- ROTAS PÚBLICAS -------------------------

    publicRouter.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });
    
    publicRouter.post('/auth/register', async (req, res, next) => {
        try {
            const data = schemaShared.insertUserSchema.parse(req.body);
            const existing = await storage.getUserByEmail(data.email);
            if (existing) {
                return res.status(409).json({ error: 'Email já cadastrado.' });
            }
            const user = await storage.createUser(data);
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
        } catch (e) {
            next(e);
        }
    });
    
    publicRouter.post('/auth/login', async (req, res, next) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
            }
            const user = await storage.getUserByEmail(email);
            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }
            const isValid = await storage.validatePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
        } catch (e) {
            next(e);
        }
    });
    
    publicRouter.get('/landingpages/slug/:slug', async (req, res, next) => {
        try {
            const lp = await storage.getLandingPageBySlug(req.params.slug);
            if (!lp) {
                return res.status(404).json({ error: 'Página não encontrada' });
            }
            res.json(lp);
        } catch(e) {
            next(e);
        }
    });

    // ------------------------- ROTAS PROTEGIDAS -------------------------
    apiRouter.use(authenticateToken);
    
    // Dashboard
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const dashboardData = await storage.getDashboardData(req.user.id);
            res.json(dashboardData);
        } catch (e) { next(e); }
    });
    
    // Campaigns
    apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const campaigns = await storage.getCampaigns(req.user.id);
            res.json(campaigns);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertCampaignSchema.parse(req.body);
            const campaign = await storage.createCampaign({ ...data, userId: req.user.id });
            res.status(201).json(campaign);
        } catch (e) { next(e); }
    });
    
    apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
            const campaign = await storage.getCampaign(id, req.user.id);
            res.json(campaign);
        } catch(e) { next(e); }
    });
    
    apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
            const data = schemaShared.insertCampaignSchema.partial().parse(req.body);
            const campaign = await storage.updateCampaign(id, data, req.user.id);
            res.json(campaign);
        } catch (e) { next(e); }
    });
    
    apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
            await storage.deleteCampaign(id, req.user.id);
            res.status(204).send();
        } catch (e) { next(e); }
    });
    
    // Creatives
    apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const campaignIdQuery = req.query.campaignId as string;
            const campaignId = campaignIdQuery === 'null' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined);
            const creatives = await storage.getCreatives(req.user.id, campaignId);
            res.json(creatives);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertCreativeSchema.parse({
                ...req.body,
                fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null
            });
            const creative = await storage.createCreative({ ...data, userId: req.user.id });
            res.status(201).json(creative);
        } catch (e) { next(e); }
    });
    
    apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
            const updateData = schemaShared.insertCreativeSchema.partial().parse({
                ...req.body,
                fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl
            });
            const updated = await storage.updateCreative(id, updateData, req.user.id);
            if (!updated) return res.status(404).json({error: "Criativo não encontrado"});
            res.json(updated);
        } catch(e) { next(e); }
    });
    
    apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
            await storage.deleteCreative(id, req.user.id);
            res.status(204).send();
        } catch (e) { next(e); }
    });
    
    // Funnels
    apiRouter.get('/funnels', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const funnels = await storage.getFunnels(req.user.id);
            res.json(funnels);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/funnels', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertFunnelSchema.parse(req.body);
            const funnel = await storage.createFunnel({ ...data, userId: req.user.id });
            res.status(201).json(funnel);
        } catch(e) { next(e); }
    });
    
    // Copies
    apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const { campaignId, phase, purpose, search } = req.query;
            const copies = await storage.getCopies(
                req.user.id, 
                campaignId ? Number(campaignId) : undefined, 
                phase as string, 
                purpose as string, 
                search as string
            );
            res.json(copies);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertCopySchema.parse(req.body);
            const copy = await storage.createCopy({ ...data, userId: req.user.id });
            res.status(201).json(copy);
        } catch (e) { next(e); }
    });
    
    apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da cópia inválido.' });
            await storage.deleteCopy(id, req.user.id);
            res.status(204).send();
        } catch (e) { next(e); }
    });
    
    // Landing Pages
    apiRouter.get('/landingpages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const landingPages = await storage.getLandingPages(req.user.id);
            res.json(landingPages);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const lpData = schemaShared.insertLandingPageSchema.parse({ ...req.body });
            const landingPage = await storage.createLandingPage({ ...lpData, userId: req.user.id });
            res.status(201).json(landingPage);
        } catch(e) { next(e); }
    });
    
    apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user.id);
            if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.' });
            res.json({ project: lp.grapesJsData || {} });
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
    
    apiRouter.delete('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID da landing page inválido.' });
            await storage.deleteLandingPage(id, req.user.id);
            res.status(204).send();
        } catch(e) { next(e); }
    });
    
    // Assets
    apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
            const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`;
            res.status(200).json([{ src: publicUrl }]);
        } catch(e) { next(e); }
    });
    
    apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => {
        try {
            const { assets } = req.body;
            if (Array.isArray(assets)) {
                assets.forEach(asset => {
                    try {
                        const filename = path.basename(new URL(asset.src).pathname);
                        const filePath = path.join(LP_ASSETS_DIR, filename);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    } catch (e) {
                        logger.warn({ asset: asset.src, error: e}, `Erro ao deletar asset`);
                    }
                });
            }
            res.status(200).json({ message: "Solicitação processada." });
        } catch(e) { next(e); }
    });
    
    // Budgets
    apiRouter.get('/budgets', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const budgets = await storage.getBudgets(req.user.id);
            res.json(budgets);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertBudgetSchema.parse(req.body);
            const budget = await storage.createBudget({ ...data, userId: req.user.id });
            res.status(201).json(budget);
        } catch (e) { next(e); }
    });
    
    // Alerts
    apiRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const alerts = await storage.getAlerts(req.user.id, req.query.unread === 'true');
            res.json(alerts);
        } catch(e) { next(e); }
    });
    
    apiRouter.put('/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' });
            await storage.markAlertAsRead(id, req.user.id);
            res.status(200).json({ success: true });
        } catch (e) { next(e); }
    });
    
    // Flows
    apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const userId = req.user.id;
            const flowIdQuery = req.query.id as string | undefined;
            if (flowIdQuery) {
                const flowId = parseInt(flowIdQuery);
                if (isNaN(flowId)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
                const flow = await storage.getFlow(flowId, userId);
                return flow ? res.json(flow) : res.status(404).json({ error: 'Fluxo não encontrado.' });
            }
            const campaignIdQuery = req.query.campaignId as string | undefined;
            let campaignId: number | null | undefined = undefined;
            if (campaignIdQuery === 'null' || campaignIdQuery === 'none') {
                campaignId = null;
            } else if (campaignIdQuery) {
                const parsedId = parseInt(campaignIdQuery);
                if (!isNaN(parsedId)) campaignId = parsedId;
            }
            const flows = await storage.getFlows(userId, campaignId);
            res.json(flows);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertFlowSchema.parse(req.body);
            const flow = await storage.createFlow({ ...data, userId: req.user.id });
            res.status(201).json(flow);
        } catch(e) { next(e); }
    });
    
    apiRouter.put('/flows/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
            const data = schemaShared.insertFlowSchema.partial().parse(req.body);
            const flow = await storage.updateFlow(id, data, req.user.id);
            res.json(flow);
        } catch(e) { next(e); }
    });
    
    apiRouter.delete('/flows/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
            await storage.deleteFlow(id, req.user.id);
            res.status(204).send();
        } catch(e) { next(e); }
    });
    
    // WhatsApp routes
    apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const service = getWhatsappServiceForUser(req.user.id);
            await service.connectToWhatsApp();
            res.status(202).json({ message: "Iniciando conexão." });
        } catch(e) { next(e); }
    });
    
    apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const status = WhatsappConnectionService.getStatus(req.user.id);
            res.json(status);
        } catch(e) { next(e); }
    });
    
    apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const service = getWhatsappServiceForUser(req.user.id);
            await service.disconnectWhatsApp();
            res.json({ message: "Desconexão solicitada." });
        } catch(e) { next(e); }
    });
    
    apiRouter.get('/whatsapp/contacts', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const contacts = await storage.getContacts(req.user.id);
            res.json(contacts);
        } catch(e) { next(e); }
    });
    
    apiRouter.get('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const contactNumber = req.query.contactNumber as string;
            if(!contactNumber) return res.status(400).json({ error: "Número do contato é obrigatório."});
            const messages = await storage.getMessages(req.user.id, contactNumber);
            res.json(messages);
        } catch(e) { next(e); }
    });
    
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
    
    // WhatsApp Templates
    apiRouter.get('/whatsapp/templates', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const templates = await storage.getWhatsappTemplates(req.user.id);
            res.json(templates);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/whatsapp/templates', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertWhatsappMessageTemplateSchema.parse(req.body);
            const newTemplate = await storage.createWhatsappTemplate({ ...data, userId: req.user.id });
            res.status(201).json(newTemplate);
        } catch (e) { next(e); }
    });
    
    apiRouter.put('/whatsapp/templates/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: "ID do template inválido." });
            const data = schemaShared.insertWhatsappMessageTemplateSchema.partial().parse(req.body);
            const updatedTemplate = await storage.updateWhatsappTemplate(id, data, req.user.id);
            if (!updatedTemplate) return res.status(404).json({ error: "Template não encontrado." });
            res.json(updatedTemplate);
        } catch (e) { next(e); }
    });
    
    apiRouter.delete('/whatsapp/templates/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ error: "ID do template inválido." });
            const success = await storage.deleteWhatsappTemplate(id, req.user.id);
            if (!success) return res.status(404).json({ error: "Template não encontrado." });
            res.status(204).send();
        } catch (e) { next(e); }
    });
    
    // MCP (AI Chat) Routes
    apiRouter.post('/mcp/converse', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const { message, sessionId } = req.body;
            const attachmentUrl = req.file ? `/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}` : undefined;
            const payload = await handleMCPConversation(req.user.id, message, sessionId ? parseInt(sessionId) : undefined, attachmentUrl);
            res.json(payload);
        } catch (e) { next(e); }
    });
    
    // Chat Sessions
    apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const sessions = await storage.getChatSessions(req.user.id);
            res.json(sessions);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const data = schemaShared.insertChatSessionSchema.parse(req.body);
            const session = await storage.createChatSession(req.user.id, data.title);
            res.status(201).json(session);
        } catch (e) { next(e); }
    });
    
    apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const sessionId = parseInt(req.params.sessionId);
            if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
            const messages = await storage.getChatMessages(sessionId, req.user.id);
            res.json(messages);
        } catch (e) { next(e); }
    });
    
    apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const sessionId = parseInt(req.params.sessionId);
            if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
            const { title } = req.body;
            if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Título é obrigatório.' });
            const updated = await storage.updateChatSessionTitle(sessionId, req.user.id, title);
            if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.' });
            res.json(updated);
        } catch (e) { next(e); }
    });
    
    apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.' });
            const sessionId = parseInt(req.params.sessionId);
            if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
            await storage.deleteChatSession(sessionId, req.user.id);
            res.status(204).send();
        } catch (e) { next(e); }
    });

    // ------------------- REGISTRO DOS ROTEADORES E ERROR HANDLER -------------------

    app.use('/public', publicRouter); // Registra rotas públicas sem prefixo de API
    app.use('/api', apiRouter);       // Registra rotas protegidas com prefixo /api

    // Middleware de tratamento de erros. Deve ser o último 'app.use'.
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        if (err instanceof ZodError) {
            // Erro de validação do Zod
            return res.status(400).json({ error: 'Dados de entrada inválidos.', details: err.errors });
        }
        // Loga o erro para depuração
        logger.error(err, 'Ocorreu um erro inesperado no servidor');
        // Resposta genérica para o cliente
        res.status(500).json({ error: 'Erro interno do servidor.' });
    };
    app.use(errorHandler);

    // Retorna o servidor HTTP criado para ser iniciado no arquivo principal (index.ts)
    return createServer(app);
}
