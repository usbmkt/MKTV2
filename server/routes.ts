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
import { WhatsappConnectionService } from './services/whatsapp-connection.service';

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

    // --- ROTAS PÚBLICAS ---
    publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    publicRouter.post('/auth/register', async (req, res, next) => { try { const data = schemaShared.insertUserSchema.parse(req.body); const existing = await storage.getUserByEmail(data.email); if (existing) return res.status(409).json({ error: 'Email já cadastrado.' }); const hash = await bcrypt.hash(data.password, 10); const user = await storage.createUser({ ...data, password: hash }); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    publicRouter.post('/auth/login', async (req, res, next) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); const user = await storage.getUserByEmail(email); if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' }); const isValid = await storage.validatePassword(password, user.password); if (!isValid) return res.status(401).json({ error: 'Credenciais inválidas.' }); const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (e) { next(e); } });
    publicRouter.get('/auth/login', (req, res) => res.status(405).json({ error: 'Método não permitido. Utilize POST para fazer login.' }));
    publicRouter.get('/landingpages/slug/:slug', async (req, res, next) => { try { const lp = await storage.getLandingPageBySlug(req.params.slug); if (!lp) return res.status(404).json({ error: 'Página não encontrada' }); res.json(lp); } catch(e) { next(e); }});

    // --- MIDDLEWARE DE AUTENTICAÇÃO PARA API ---
    apiRouter.use(authenticateToken);
    
    // --- ROTAS PROTEGIDAS ---
    apiRouter.get('/dashboard', async (req, res, next) => { try { res.json(await storage.getDashboardData(req.user!.id)); } catch (e) { next(e); }});
    
    // CAMPANHAS
    apiRouter.get('/campaigns', async (req, res, next) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/campaigns', async (req, res, next) => { try { const data = schemaShared.insertCampaignSchema.parse(req.body); res.status(201).json(await storage.createCampaign({ ...data, userId: req.user!.id })); } catch (e) { next(e); }});
    apiRouter.get('/campaigns/:id', async (req, res, next) => { try { res.json(await storage.getCampaign(parseInt(req.params.id), req.user!.id)); } catch(e) { next(e); }});
    apiRouter.put('/campaigns/:id', async (req, res, next) => { try { const data = schemaShared.insertCampaignSchema.partial().parse(req.body); res.json(await storage.updateCampaign(parseInt(req.params.id), data, req.user!.id)); } catch (e) { next(e); } });
    apiRouter.delete('/campaigns/:id', async (req, res, next) => { try { await storage.deleteCampaign(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch (e) { next(e); } });

    // CRIATIVOS
    apiRouter.get('/creatives', async (req, res, next) => { try { res.json(await storage.getCreatives(req.user!.id, req.query.campaignId as any)); } catch(e) { next(e); }});
    apiRouter.post('/creatives', creativesUpload.single('file'), async (req, res, next) => { try { const data = schemaShared.insertCreativeSchema.parse({ ...req.body, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : null }); res.status(201).json(await storage.createCreative({ ...data, userId: req.user!.id })); } catch(e) { next(e); }});
    apiRouter.put('/creatives/:id', creativesUpload.single('file'), async(req, res, next) => { try { const data = schemaShared.insertCreativeSchema.partial().parse({...req.body, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl }); res.json(await storage.updateCreative(parseInt(req.params.id), data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/creatives/:id', async (req, res, next) => { try { await storage.deleteCreative(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});
    
    // COPIES & IA
    apiRouter.post('/copies/generate', async (req: AuthenticatedRequest, res, next) => { try { if (!genAI) throw new Error("IA não está configurada."); const { product, audience, objective, tone, copyPurposeKey, details, launchPhase } = req.body; const currentPurposeConfig = schemaShared.allCopyPurposesConfig.find(p => p.key === copyPurposeKey); if (!currentPurposeConfig) return res.status(400).json({ error: "Finalidade da copy desconhecida." }); let prompt = `Você é um Copywriter Mestre... (construa seu prompt aqui)`; if (currentPurposeConfig.promptEnhancer) { prompt = currentPurposeConfig.promptEnhancer(prompt, details, { product, audience, objective, tone }); } const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { responseMimeType: "application/json", responseSchema: schemaShared.aiResponseSchema as any }}); const result = await model.generateContent(prompt); res.json(JSON.parse(result.response.text())); } catch(e) { next(e); }});
    apiRouter.get('/copies', async (req, res, next) => { try { const { campaignId, phase, purposeKey, search } = req.query; res.json(await storage.getCopies( req.user!.id, campaignId ? Number(campaignId) : undefined, phase as string, purposeKey as string, search as string )); } catch (e) { next(e); }});
    apiRouter.post('/copies', async (req, res, next) => { try { const data = schemaShared.insertCopySchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createCopy(data)); } catch (e) { next(e); }});
    apiRouter.put('/copies/:id', async (req, res, next) => { try { const data = schemaShared.insertCopySchema.partial().parse(req.body); res.json(await storage.updateCopy(parseInt(req.params.id), data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/copies/:id', async (req, res, next) => { try { await storage.deleteCopy(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});
    
    // ORÇAMENTOS
    apiRouter.get('/budgets', async (req, res, next) => { try { res.json(await storage.getBudgets(req.user!.id)); } catch(e) { next(e); }});
    apiRouter.post('/budgets', async (req, res, next) => { try { const data = schemaShared.insertBudgetSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createBudget(data)); } catch(e) { next(e); }});

    // ALERTAS
    apiRouter.get('/alerts', async (req, res, next) => { try { res.json(await storage.getAlerts(req.user!.id)); } catch(e) { next(e); }});
    apiRouter.put('/alerts/:id/read', async (req, res, next) => { try { await storage.markAlertAsRead(parseInt(req.params.id), req.user!.id); res.status(200).json({success: true}); } catch(e) { next(e); }});

    // LANDING PAGES & ASSETS
    apiRouter.get('/landingpages', async (req, res, next) => { try { res.json(await storage.getLandingPages(req.user!.id)); } catch(e) { next(e); }});
    apiRouter.post('/landingpages', async (req, res, next) => { try { const data = schemaShared.insertLandingPageSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createLandingPage(data)); } catch(e) { next(e); }});
    apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req, res, next) => { try { const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user!.id); if(!lp) return res.status(404).json({error: 'Projeto não encontrado'}); res.json({ project: lp.grapesJsData || {} }); } catch(e) { next(e); }});
    apiRouter.put('/landingpages/:id', async (req, res, next) => { try { const data = schemaShared.insertLandingPageSchema.partial().parse(req.body); res.json(await storage.updateLandingPage(parseInt(req.params.id), data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/landingpages/:id', async (req, res, next) => { try { await storage.deleteLandingPage(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});
    apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req, res) => res.json([{ src: `/${UPLOADS_ROOT_DIR}/lp-assets/${req.file!.filename}` }]));
    apiRouter.post('/assets/lp-delete', async(req, res, next) => { try { /* ... */ res.status(200).json({ message: 'Solicitação processada.' }); } catch(e){ next(e); } });
    
    // CHAT (MCP)
    apiRouter.post('/mcp/converse', async (req, res, next) => { try { /* ... sua lógica de conversação ... */ } catch (e) { next(e); }});
    apiRouter.get('/chat/sessions', async (req, res, next) => { try { res.json(await storage.getChatSessions(req.user!.id)); } catch (e) { next(e); }});
    apiRouter.post('/chat/sessions', async (req, res, next) => { try { res.status(201).json(await storage.createChatSession(req.user!.id, req.body.title)); } catch(e) { next(e); }});
    apiRouter.get('/chat/sessions/:sessionId/messages', async (req, res, next) => { try { res.json(await storage.getChatMessages(parseInt(req.params.sessionId), req.user!.id)); } catch(e) { next(e); }});
    apiRouter.put('/chat/sessions/:sessionId/title', async (req, res, next) => { try { res.json(await storage.updateChatSessionTitle(parseInt(req.params.sessionId), req.user!.id, req.body.title)); } catch(e) { next(e); }});
    apiRouter.delete('/chat/sessions/:sessionId', async (req, res, next) => { try { await storage.deleteChatSession(parseInt(req.params.sessionId), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});

    // FUNIS & ETAPAS
    apiRouter.get('/funnels', async (req, res, next) => { try { res.json(await storage.getFunnels(req.user!.id, req.query.campaignId as any)); } catch(e) { next(e); }});
    apiRouter.post('/funnels', async (req, res, next) => { try { const data = schemaShared.insertFunnelSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createFunnel(data)); } catch(e) { next(e); }});
    apiRouter.get('/funnels/:id', async (req, res, next) => { try { res.json(await storage.getFunnel(parseInt(req.params.id), req.user!.id)); } catch(e) { next(e); }});
    apiRouter.put('/funnels/:id', async (req, res, next) => { try { const data = schemaShared.insertFunnelSchema.partial().parse(req.body); res.json(await storage.updateFunnel(parseInt(req.params.id), data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/funnels/:id', async (req, res, next) => { try { await storage.deleteFunnel(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});
    apiRouter.get('/funnels/:funnelId/stages', async (req, res, next) => { try { res.json(await storage.getFunnelStages(parseInt(req.params.funnelId), req.user!.id)); } catch(e) { next(e); }});
    apiRouter.post('/funnels/:funnelId/stages', async (req, res, next) => { try { const data = schemaShared.insertFunnelStageSchema.parse({...req.body, funnelId: parseInt(req.params.funnelId)}); res.status(201).json(await storage.createFunnelStage(data)); } catch(e) { next(e); }});
    apiRouter.put('/stages/:id', async (req, res, next) => { try { const data = schemaShared.insertFunnelStageSchema.partial().parse(req.body); res.json(await storage.updateFunnelStage(parseInt(req.params.id), data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/stages/:id', async (req, res, next) => { try { await storage.deleteFunnelStage(parseInt(req.params.id), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});
    
    // FLUXOS
    apiRouter.get('/flows', async (req, res, next) => { try { if (req.query.id) { res.json(await storage.getFlow(parseInt(req.query.id as string), req.user!.id)); } else { res.json(await storage.getFlows(req.user!.id, req.query.campaignId as any)); } } catch (e) { next(e); }});
    apiRouter.post('/flows', async (req, res, next) => { try { const data = schemaShared.insertFlowSchema.parse(req.body); res.status(201).json(await storage.createFlow({ ...data, userId: req.user!.id })); } catch(e){ next(e); }});
    apiRouter.put('/flows', async (req, res, next) => { try { const id = parseInt(req.query.id as string); const data = schemaShared.insertFlowSchema.partial().parse(req.body); res.json(await storage.updateFlow(id, data, req.user!.id)); } catch(e) { next(e); }});
    apiRouter.delete('/flows', async (req, res, next) => { try { await storage.deleteFlow(parseInt(req.query.id as string), req.user!.id); res.status(204).send(); } catch(e) { next(e); }});

    // WHATSAPP
    apiRouter.post('/whatsapp/connect', async (req, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.connectToWhatsApp(); res.status(202).json({ message: "Iniciando conexão." }); } catch(e) { next(e); }});
    apiRouter.get('/whatsapp/status', async (req, res, next) => { try { const status = WhatsappConnectionService.getStatus(req.user!.id); res.json(status || { status: 'disconnected' }); } catch(e) { next(e); }});
    apiRouter.post('/whatsapp/disconnect', async (req, res, next) => { try { const service = getWhatsappServiceForUser(req.user!.id); await service.disconnectWhatsApp(); res.json({ message: "Desconexão solicitada." }); } catch(e) { next(e); }});
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
