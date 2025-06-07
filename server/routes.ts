import type { Express, Request, Response, NextFunction, ErrorRequestHandler } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage"; 
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schemaShared from "../shared/schema"; 
import { ZodError } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config'; 
import { WhatsappConnectionService } from './services/whatsapp-connection.service';
import { handleMCPConversation } from "./mcp_handler";

// --- Configuração de Upload ---
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


// --- Tipos e Middlewares ---
export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (process.env.FORCE_AUTH_BYPASS === 'true') { 
        req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date() }; 
        return next(); 
    }
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
    if (!whatsappServiceInstances.has(userId)) {
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) { 
    try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); } 
    catch (error) { console.error("Falha ao inicializar GoogleGenerativeAI:", error); } 
}

// --- Função Principal de Setup das Rotas ---
async function doRegisterRoutes(app: Express): Promise<HttpServer> {
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    const handleZodError: ErrorRequestHandler = (err, req, res, next) => { 
        if (err instanceof ZodError) return res.status(400).json({ error: "Erro de validação.", details: err.errors });
        next(err); 
    };
    const handleError: ErrorRequestHandler = (err, req, res, next) => { 
        console.error(err); 
        res.status(err.statusCode || 500).json({ error: err.message || "Erro interno do servidor." });
    };
    
    // --- ROTAS PÚBLICAS E DE AUTENTICAÇÃO ---
    publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    publicRouter.post('/auth/register', async (req, res, next) => { try { const data = schemaShared.insertUserSchema.parse(req.body); const existing = await storage.getUserByEmail(data.email); if (existing) return res.status(409).json({ error: 'Email já cadastrado.' }); const hash = await bcrypt.hash(data.password, 10); const user = await storage.createUser({ ...data, password: hash }); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    publicRouter.post('/auth/login', async (req, res, next) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); const user = await storage.getUserByEmail(email); if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' }); const isValid = await storage.validatePassword(password, user.password); if (!isValid) return res.status(401).json({ error: 'Credenciais inválidas.' }); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    publicRouter.get('/landingpages/slug/:slug', async (req, res, next) => { try { const lp = await storage.getLandingPageBySlug(req.params.slug); if (!lp) return res.status(404).json({ error: 'Página não encontrada' }); res.json(lp); } catch(e) { next(e); }});

    // MIDDLEWARE DE AUTENTICAÇÃO PARA AS ROTAS ABAIXO
    apiRouter.use(authenticateToken);
    
    // --- ROTAS PROTEGIDAS ---

    // Dashboard
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getDashboardData(req.user!.id)); } catch (e) { next(e); }});

    // Campaigns
    apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertCampaignSchema.parse(req.body); res.status(201).json(await storage.createCampaign({ ...data, userId: req.user!.id })); } catch (e) { next(e); }});
    apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCampaign(parseInt(req.params.id), req.user!.id)); } catch(e) { next(e); }});
    apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertCampaignSchema.partial().parse(req.body); res.json(await storage.updateCampaign(parseInt(req.params.id), data, req.user!.id)); } catch (e) { next(e); } });
    apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteCampaign(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch (e) { next(e); } });

    // Creatives
    apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => { try { const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; res.json(await storage.getCreatives(req.user!.id, campaignId)); } catch (e) { next(e); }});
    apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertCreativeSchema.parse({ ...req.body, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null }); const creative = await storage.createCreative({ ...data, userId: req.user!.id }); res.status(201).json(creative); } catch (e) { next(e); } });
    apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { try { const id = parseInt(req.params.id); const updateData = schemaShared.insertCreativeSchema.partial().parse({ ...req.body, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl }); const updated = await storage.updateCreative(id, updateData, req.user!.id); if (!updated) return res.status(404).json({error: "Criativo não encontrado"}); res.json(updated); } catch(e){ next(e); }});
    apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteCreative(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch (e) { next(e); } });

    // Funnels
    apiRouter.get('/funnels', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getFunnels(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/funnels', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertFunnelSchema.parse(req.body); res.status(201).json(await storage.createFunnel({ ...data, userId: req.user!.id })); } catch(e){ next(e); }});

    // Metrics
    apiRouter.get('/metrics/campaign/:campaignId', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getMetricsForCampaign(parseInt(req.params.campaignId), req.user!.id)); } catch(e){ next(e); }});

    // Copies
    apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => { try { const { campaignId, phase, purpose, search } = req.query; res.json(await storage.getCopies(req.user!.id, campaignId ? Number(campaignId) : undefined, phase as string, purpose as string, search as string)); } catch (e) { next(e); } });
    apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertCopySchema.parse(req.body); res.status(201).json(await storage.createCopy({ ...data, userId: req.user!.id })); } catch (e) { next(e); } });
    apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteCopy(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch (e) { next(e); }});
    
    // Landing Pages
    apiRouter.get('/landingpages', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getLandingPages(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => { try { const lpData = schemaShared.insertLandingPageSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createLandingPage(lpData)); } catch(e) { next(e); }});
    apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => { try { const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user!.id); if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.' }); res.json({ project: lp.grapesJsData || {} }); } catch(e){ next(e); }});
    apiRouter.put('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { try { const lpData = schemaShared.insertLandingPageSchema.partial().parse(req.body); res.json(await storage.updateLandingPage(parseInt(req.params.id), lpData, req.user!.id)); } catch(e){ next(e); }});
    apiRouter.delete('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteLandingPage(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e){ next(e); }});

    // Assets para Landing Pages
    apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => { try { if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." }); const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`; const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`; res.status(200).json([{ src: publicUrl }]); } catch(e){ next(e); }});
    apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => { try { const { assets } = req.body; if (Array.isArray(assets)) { assets.forEach(asset => { try { const filename = path.basename(new URL(asset.src).pathname); const filePath = path.join(LP_ASSETS_DIR, filename); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { console.warn(`Erro ao deletar asset: ${asset.src}`, e); } }); } res.status(200).json({ message: "Solicitação processada." }); } catch(e){ next(e); }});
    
    // Budgets
    apiRouter.get('/budgets', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getBudgets(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertBudgetSchema.parse(req.body); res.status(201).json(await storage.createBudget({ ...data, userId: req.user!.id })); } catch (e) { next(e); }});
    
    // Alerts
    apiRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getAlerts(req.user!.id, req.query.unread === 'true')); } catch(e) { next(e); }});
    apiRouter.put('/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => { try { await storage.markAlertAsRead(parseInt(req.params.id), req.user!.id); res.status(200).json({ success: true }); } catch (e) { next(e); }});
    
    // ROTAS DE FLUXOS (WhatsApp)
    apiRouter.get('/flows', async (req: AuthenticatedRequest, res, next) => {
        try {
            const userId = req.user!.id;
            const flowIdQuery = req.query.id as string | undefined;
            const campaignIdQuery = req.query.campaignId as string | undefined;

            if (flowIdQuery) {
                const flowId = parseInt(flowIdQuery, 10);
                if (isNaN(flowId)) return res.status(400).json({ error: 'ID do fluxo inválido.' });
                const flow = await storage.getFlow(flowId, userId);
                return flow ? res.json(flow) : res.status(404).json({ error: 'Fluxo não encontrado.' });
            }

            let campaignId: number | null | undefined = undefined;
            if (campaignIdQuery === 'null' || campaignIdQuery === 'none') {
                campaignId = null;
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
    apiRouter.post('/flows', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertFlowSchema.parse(req.body); res.status(201).json(await storage.createFlow({ ...data, userId: req.user!.id })); } catch(e){ next(e); }});
    apiRouter.put('/flows', async (req: AuthenticatedRequest, res, next) => { try { const id = parseInt(req.query.id as string); const data = schemaShared.insertFlowSchema.partial().parse(req.body); res.json(await storage.updateFlow(id, data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/flows', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteFlow(parseInt(req.query.id as string), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});

    // ROTAS DO WHATSAPP
    apiRouter.post('/whatsapp/connect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.connectToWhatsApp(); res.status(202).json({ message: "Iniciando conexão." }); } catch(e) { next(e); }});
    apiRouter.get('/whatsapp/status', async (req: AuthenticatedRequest, res, next) => { try { const status = WhatsappConnectionService.getStatus(req.user!.id); res.json(status || { status: 'disconnected', userId: req.user!.id }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/disconnect', async (req: AuthenticatedRequest, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.disconnectWhatsApp(); res.json({ message: "Desconexão solicitada." }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/reload-flow', (req, res) => res.json({ message: "Recarga solicitada." }));
    
    // ROTAS PARA CONVERSAS (WhatsApp)
    apiRouter.get('/whatsapp/contacts', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getContacts(req.user!.id)); } catch(e) { next(e); }});
    apiRouter.get('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { try { const contactNumber = req.query.contactNumber as string; if(!contactNumber) return res.status(400).json({ error: "Número do contato é obrigatório."}); res.json(await storage.getMessages(req.user!.id, contactNumber)); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { try { const { contactNumber, message } = schemaShared.insertWhatsappMessageSchema.pick({contactNumber: true, message: true}).parse(req.body); const service = getWhatsappServiceForUser(req.user!.id); const fullJid = contactNumber.endsWith('@s.whatsapp.net') ? contactNumber : `${contactNumber}@s.whatsapp.net`; await service.sendMessage(fullJid, { text: message }); const savedMessage = await storage.createMessage({ contactNumber, message, direction: 'outgoing', userId: req.user!.id }); res.status(201).json(savedMessage); } catch (e) { next(e); } });

    // ROTAS DO MCP (AGENTE IA)
    apiRouter.post('/mcp/converse', async (req: AuthenticatedRequest, res, next) => { try { const { message, sessionId, attachmentUrl } = req.body; const payload = await handleMCPConversation(req.user!.id, message, sessionId, attachmentUrl); res.json(payload); } catch(e) { next(e); }});
    apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { try { const data = schemaShared.insertChatSessionSchema.parse(req.body); res.status(201).json(await storage.createChatSession(req.user!.id, data.title)); } catch(e) { next(e); }});
    apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getChatSessions(req.user!.id)); } catch(e){ next(e); }});
    apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getChatMessages(parseInt(req.params.sessionId), req.user!.id)); } catch(e){ next(e); }});
    apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => { try { const updated = await storage.updateChatSessionTitle(parseInt(req.params.sessionId), req.user!.id, req.body.title); res.json(updated); } catch(e){ next(e); }});
    apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => { try { await storage.deleteChatSession(parseInt(req.params.sessionId), req.user!.id); res.status(204).send(); } catch(e){ next(e); }});

    // --- REGISTRO DOS ROUTERS ---
    app.use('/api', publicRouter);
    app.use('/api', apiRouter);
    app.use(handleZodError);
    app.use(handleError);
    
    // Servir arquivos estáticos da pasta de uploads
    app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
    
    return createServer(app);
}

export const RouterSetup = {
    registerRoutes: doRegisterRoutes
};
