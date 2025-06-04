// server/routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { JWT_SECRET, GEMINI_API_KEY } from './config';
import { 
    users, insertUserSchema, 
    campaigns, insertCampaignSchema, 
    creatives, insertCreativeSchema, 
    budgets, insertBudgetSchema, 
    copies, insertCopySchema, 
    alerts, 
    metrics, 
    landingPages, insertLandingPageSchema, 
    funnels, insertFunnelSchema, 
    funnelStages, insertFunnelStageSchema, 
    flowsTable, insertFlowSchema, // Corrigido para flowsTable, e insertFlowSchema (verificar exportação em shared/schema.ts)
    chatSessions, insertChatSessionSchema,
    chatMessages, // insertChatMessageSchema (se necessário)
} from '../shared/schema';
import { z, ZodError } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MCPHandler } from './mcp_handler'; // Assumindo que MCPHandler é exportado corretamente

const mcpHandler = new MCPHandler(storage);

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    username: string;
  };
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.warn('[AUTH_BYPASS] Autenticação FORÇADAMENTE IGNORADA via FORCE_AUTH_BYPASS=true');
    const mockUser = await storage.getUser('admin@usbmkt.com');
    if (mockUser) {
        req.user = {id: mockUser.id, email: mockUser.email, username: mockUser.username! };
    } else {
        req.user = { id: 1, email: 'bypass@example.com', username: 'Bypass User' };
    }
    return next();
  }

  if (token == null) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET!, async (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    try {
      const userRecord = await storage.getUserById(decoded.id);
      if (!userRecord) {
        return res.status(404).json({ error: 'Usuário do token não encontrado' });
      }
      req.user = { id: userRecord.id, email: userRecord.email, username: userRecord.username! };
      next();
    } catch (error) {
      console.error("Erro ao buscar usuário do token:", error);
      return res.status(500).json({ error: 'Erro interno ao verificar usuário do token' });
    }
  });
};

const createUploadMiddleware = (destination: string, fieldName: string = 'file') => {
    const storageConfig = multer.diskStorage({
        destination: async (req, file, cb) => {
            const uploadPath = path.join(__dirname, '..', 'uploads', destination);
            try {
                await fs.mkdir(uploadPath, { recursive: true });
                cb(null, uploadPath);
            } catch (error: any) {
                console.error(`Falha ao criar diretório de upload ${uploadPath}:`, error);
                cb(error, uploadPath);
            }
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
    return multer({
        storage: storageConfig,
        limits: { fileSize: 25 * 1024 * 1024 }, 
        fileFilter: (req, file, cb) => {
            const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|txt|ogg|mp3|wav|webp/;
            const mimetype = allowedTypes.test(file.mimetype);
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            if (mimetype && extname) {
                return cb(null, true);
            }
            cb(new Error('Tipo de arquivo não suportado: ' + file.mimetype + ' ou ' + path.extname(file.originalname)));
        }
    }).single(fieldName);
};

const creativesUpload = createUploadMiddleware('creatives-assets');
const lpAssetUpload = createUploadMiddleware('lp-assets');
const mcpAttachmentUpload = createUploadMiddleware('mcp-attachments');

const router = Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    let logMessage = `${new Date().toLocaleTimeString()} [api-server] ${req.method} ${req.originalUrl} ${res.statusCode} in ${duration}ms`;
    if (res.locals.errorMessage) {
      logMessage += ` :: ${JSON.stringify(res.locals.errorMessage)}`;
    }
    if (process.env.NODE_ENV !== 'production' || (!req.originalUrl.startsWith('/assets/') && req.originalUrl !== '/api/health' && !req.originalUrl.includes('/uploads/'))) {
        console.log(logMessage);
    }
  });
  next();
});

const handleZodError = (err: ZodError, req: Request, res: Response, next: NextFunction) => {
  const errors = err.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
  res.locals.errorMessage = { error: "Erro de validação", details: errors };
  res.status(400).json(res.locals.errorMessage);
};

// Auth Routes
router.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const userRecord = await storage.createUser(userData);
    if (!userRecord) return res.status(500).json({ error: 'Falha ao criar usuário' });
    const token = jwt.sign({ id: userRecord.id, email: userRecord.email }, JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user: { id: userRecord.id, username: userRecord.username, email: userRecord.email }, token });
  } catch (error: any) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(409).json({ error: "Este e-mail já está em uso." });
    }
    if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed: users.username')) {
        return res.status(409).json({ error: "Este nome de usuário já está em uso." });
    }
    next(error);
  }
});
router.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const userRecord = await storage.validatePassword(email, password);
    if (!userRecord) {
      res.locals.errorMessage = {error: "Credenciais inválidas."};
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: userRecord.id, email: userRecord.email }, JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user: { id: userRecord.id, username: userRecord.username, email: userRecord.email }, token });
  } catch (error) {
    next(error);
  }
});
router.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
});

// Health Check
router.get('/api/health', (req, res) => res.status(200).send('OK'));

// Dashboard Route
router.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const data = await storage.getDashboardData(req.user.id);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Campaigns Routes
const partialCampaignSchema = insertCampaignSchema.partial().omit({ userId: true, id: true, createdAt: true });
router.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaignData = insertCampaignSchema.omit({ userId: true, id: true, createdAt: true, updatedAt: true }).parse(req.body);
    const campaign = await storage.createCampaign(req.user.id, campaignData);
    res.status(201).json(campaign);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});
router.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaignResults = await storage.getCampaigns(req.user.id);
    res.json(campaignResults);
  } catch (error) {
    next(error);
  }
});
router.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const campaign = await storage.getCampaignById(req.user.id, id);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});
router.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const campaignData = partialCampaignSchema.parse(req.body);
    const campaign = await storage.updateCampaign(req.user.id, id, campaignData);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não autorizada' });
    res.json(campaign);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});
router.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const result = await storage.deleteCampaign(req.user.id, id);
    if (!result.success) return res.status(404).json({ error: 'Campanha não encontrada ou não autorizada' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Creatives Routes
const partialCreativeSchema = insertCreativeSchema.partial().omit({ userId: true, id: true, createdAt: true });
router.post('/api/creatives', authenticateToken, creativesUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const payload: any = { ...req.body };
        if (req.file) payload.fileUrl = `/uploads/creatives-assets/${req.file.filename}`;
        
        if (payload.campaignId && payload.campaignId !== 'null' && payload.campaignId !== '') {
            payload.campaignId = parseInt(payload.campaignId, 10);
            if (isNaN(payload.campaignId)) payload.campaignId = null;
        } else {
            payload.campaignId = null;
        }
        const creativeData = insertCreativeSchema.omit({ userId: true, id: true, createdAt: true, updatedAt: true }).parse(payload);
        const creative = await storage.createCreative(req.user.id, creativeData);
        res.status(201).json(creative);
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const campaignIdQuery = req.query.campaignId as string | undefined;
        const campaignId = campaignIdQuery ? parseInt(campaignIdQuery, 10) : undefined;
        if (campaignIdQuery && isNaN(campaignId!)) return res.status(400).json({ error: "ID de Campanha inválido" });
        
        const creativeResults = await storage.getCreatives(req.user.id, campaignId);
        res.json(creativeResults);
    } catch (error) {
        next(error);
    }
});
router.get('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID do criativo inválido" });
        // const creative = await storage.getCreativeById(req.user.id, id); // Necessário implementar em storage.ts
        // if (!creative) return res.status(404).json({ error: 'Criativo não encontrado' });
        // res.json(creative);
        res.status(501).json({error: "Rota GET /api/creatives/:id não completamente implementada no storage."});
    } catch (error) {
        next(error);
    }
});
router.put('/api/creatives/:id', authenticateToken, creativesUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID do criativo inválido" });
        
        const payload: any = { ...req.body };
        if (req.file) payload.fileUrl = `/uploads/creatives-assets/${req.file.filename}`;
        if (payload.campaignId && payload.campaignId !== 'null' && payload.campaignId !== '') {
            payload.campaignId = parseInt(payload.campaignId, 10);
            if (isNaN(payload.campaignId)) payload.campaignId = null;
        } else if (payload.campaignId === 'null' || payload.campaignId === '') {
            payload.campaignId = null;
        }

        const creativeData = partialCreativeSchema.parse(payload);
        const creative = await storage.updateCreative(req.user.id, id, creativeData);
        if (!creative) return res.status(404).json({ error: 'Criativo não encontrado ou não autorizado' });
        res.json(creative);
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID do criativo inválido" });
        const result = await storage.deleteCreative(req.user.id, id);
        if (!result.success) return res.status(404).json({ error: 'Criativo não encontrado ou não autorizado' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Copies Routes
const partialCopySchema = insertCopySchema.partial().omit({ userId: true, id: true, createdAt: true});
router.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const copyData = insertCopySchema.omit({ userId: true, id: true, createdAt:true}).parse(req.body);
        const newCopy = await storage.createCopy(req.user.id, copyData);
        res.status(201).json(newCopy);
    } catch(error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const campaignIdQuery = req.query.campaignId as string | undefined;
        const campaignId = campaignIdQuery ? parseInt(campaignIdQuery, 10) : undefined;
        if (campaignIdQuery && isNaN(campaignId!)) return res.status(400).json({ error: "ID de Campanha inválido" });
        const copiesResults = await storage.getCopies(req.user.id, campaignId);
        res.json(copiesResults);
    } catch (error) {
        next(error);
    }
});
// PUT e DELETE para Copies podem ser adicionados aqui

// Flows Routes
const partialFlowUpdateSchema = insertFlowSchema.partial().extend({
  elements: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }).nullable().optional(),
}).omit({ userId: true, id: true, createdAt: true, updatedAt: true });

router.post('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let flowDataToParse = { ...req.body };
    if (flowDataToParse.campaign_id === null || flowDataToParse.campaign_id === 'null' || flowDataToParse.campaign_id === '') {
        flowDataToParse.campaign_id = null;
    } else if (flowDataToParse.campaign_id !== undefined && typeof flowDataToParse.campaign_id === 'string') {
        const parsedCampaignId = parseInt(flowDataToParse.campaign_id, 10);
        flowDataToParse.campaign_id = isNaN(parsedCampaignId) ? null : parsedCampaignId;
    } else if (typeof flowDataToParse.campaign_id !== 'number' && flowDataToParse.campaign_id !== null) {
        flowDataToParse.campaign_id = null;
    }
    const flowDataValidated = insertFlowSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true }).parse(flowDataToParse);
    const newFlow = await storage.createFlow(req.user.id, flowDataValidated);
    res.status(201).json(newFlow);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});
router.get('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    const campaignIdQuery = req.query.campaignId as string | undefined;
    if (flowIdQuery) {
      const id = parseInt(flowIdQuery, 10);
      if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });
      const flow = await storage.getFlowById(req.user.id, id);
      if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });
      return res.json(flow);
    } else {
      const flowResults = await storage.getFlows(req.user.id, campaignIdQuery);
      return res.json(flowResults);
    }
  } catch (error) {
    next(error);
  }
});
router.put('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    if (!flowIdQuery) return res.status(400).json({ error: "ID do fluxo é obrigatório na query string" });
    const id = parseInt(flowIdQuery, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });
    
    let flowDataToParse = { ...req.body };
     if (flowDataToParse.campaign_id === null || flowDataToParse.campaign_id === 'null' || flowDataToParse.campaign_id === '') {
        flowDataToParse.campaign_id = null;
    } else if (flowDataToParse.campaign_id !== undefined && typeof flowDataToParse.campaign_id === 'string') {
        const parsedCampaignId = parseInt(String(flowDataToParse.campaign_id), 10);
        flowDataToParse.campaign_id = isNaN(parsedCampaignId) ? null : parsedCampaignId;
    } else if (typeof flowDataToParse.campaign_id !== 'number' && flowDataToParse.campaign_id !== null) {
         flowDataToParse.campaign_id = undefined; 
    }
    const flowDataValidated = partialFlowUpdateSchema.parse(flowDataToParse);
    const updatedFlow = await storage.updateFlow(req.user.id, id, flowDataValidated);
    if (!updatedFlow) return res.status(404).json({ error: 'Fluxo não encontrado ou não autorizado' });
    res.json(updatedFlow);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});
router.delete('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    if (!flowIdQuery) return res.status(400).json({ error: "ID do fluxo é obrigatório na query string" });
    const id = parseInt(flowIdQuery, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });
    const result = await storage.deleteFlow(req.user.id, id);
    if (!result.success) return res.status(404).json({ error: result.message || 'Fluxo não encontrado ou não autorizado' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// WhatsApp Related Routes
router.post('/api/whatsapp/reload-flow', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        console.log(`[WhatsApp Flow Reload] Usuário ${req.user.id} solicitou recarga de fluxo.`);
        res.json({ message: "Solicitação de recarga de fluxo recebida (placeholder)." });
    } catch (error) {
        console.error("Erro ao processar recarga de fluxo do WhatsApp:", error);
        next(error);
    }
});

// Landing Page Routes
const partialLandingPageSchema = insertLandingPageSchema.partial().omit({ userId: true, id: true, createdAt: true, publishedAt: true, publicUrl: true });
router.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pageData = insertLandingPageSchema.omit({userId: true, id: true, createdAt: true, updatedAt: true, publishedAt: true, publicUrl: true}).parse(req.body);
        const newPage = await storage.createLandingPage(req.user.id, pageData);
        res.status(201).json(newPage);
    } catch(error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pages = await storage.getLandingPages(req.user.id);
        res.json(pages);
    } catch (error) {
        next(error);
    }
});
router.get('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID da Landing Page inválido" });
        const page = await storage.getLandingPageById(req.user.id, id);
        if (!page) return res.status(404).json({ error: 'Landing Page não encontrada' });
        res.json(page);
    } catch (error) {
        next(error);
    }
});
router.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID da Landing Page inválido" });
        const pageData = partialLandingPageSchema.parse(req.body);
        const page = await storage.updateLandingPage(req.user.id, id, pageData);
        if (!page) return res.status(404).json({ error: 'Landing Page não encontrada ou não autorizada' });
        res.json(page);
    } catch (error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID da Landing Page inválido" });
        const result = await storage.deleteLandingPage(req.user.id, id);
        if (!result.success) return res.status(404).json({ error: 'Landing Page não encontrada ou não autorizada' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
router.get('/api/landingpages/slug/:slug', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = await storage.getLandingPageBySlug(req.params.slug);
        if (!page || page.status !== 'published') {
            return res.status(404).json({ error: 'Página não encontrada ou não publicada.' });
        }
        res.json({ name: page.name, description: page.description, grapesJsData: page.grapesJsData, studioProjectId: page.studioProjectId });
    } catch (error) {
        next(error);
    }
});
router.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const page = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId);
        if (!page) return res.status(404).json({ error: 'Projeto de Landing Page não encontrado.' });
        res.json(page);
    } catch (error) {
        next(error);
    }
});
router.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload, (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const fileUrl = `/uploads/lp-assets/${req.file.filename}`;
    res.json([fileUrl]); 
});

// Copy Generation Route
router.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { prompt, type, platform, tone, keywords, targetAudience, campaignObjective, language = 'Português (Brasil)', numSuggestions = 3 } = req.body;
        if (!prompt && (!campaignObjective || !targetAudience)) {
            return res.status(400).json({ error: "Prompt ou detalhes da campanha (objetivo, público) são necessários." });
        }
        if (!GEMINI_API_KEY) return res.status(503).json({ error: "Serviço de IA indisponível: API Key não configurada." });
        
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const generationConfig = { temperature: 0.8, topK: 32, topP: 0.9, maxOutputTokens: 1024 };
        const safetySettings = [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, ];
        const actualPrompt = prompt || `Gere ${numSuggestions} sugestões de copy para ${type || 'um anúncio'} na plataforma ${platform || 'geral'}. Tom: ${tone || 'neutro'}. Palavras-chave: ${keywords || 'não especificadas'}. Público-alvo: ${targetAudience}. Objetivo da campanha: ${campaignObjective}. Idioma: ${language}. Formato de saída: JSON com uma chave "suggestions" contendo um array de strings.`;
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{text: actualPrompt }] }], generationConfig, safetySettings });
        const responseText = result.response.text();
        try {
            const parsedResponse = JSON.parse(responseText);
            if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
                 res.json({ suggestions: parsedResponse.suggestions.slice(0, numSuggestions) });
            } else {
                 res.json({ suggestions: [responseText] });
            }
        } catch (e) {
            const suggestions = responseText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, numSuggestions);
            res.json({ suggestions });
        }
    } catch (error: any) {
        console.error("Erro na geração de copy com Gemini:", error);
        const anyError = error as any;
        if (anyError.isGoogleGenerativeAIError === true) {
             res.status(500).json({ error: "Erro ao comunicar com o serviço de IA.", details: anyError.message });
        } else {
            next(error);
        }
    }
});

// MCP Routes
router.post('/api/mcp/converse', authenticateToken, mcpAttachmentUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { message, sessionId: currentSessionId, context } = req.body;
        let attachmentUrl = null;
        if (req.file) attachmentUrl = `/uploads/mcp-attachments/${req.file.filename}`;
        const response = await mcpHandler.handleConversation(req.user, message, attachmentUrl, currentSessionId, context);
        res.json(response);
    } catch (error) {
      if (req.file) await fs.unlink(req.file.path).catch(console.error);
      next(error);
    }
});
const partialChatSessionSchema = insertChatSessionSchema.pick({ title: true });
router.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { title } = req.body;
        const parsedData = partialChatSessionSchema.parse({ title });
        const session = await storage.createChatSession(req.user.id, parsedData.title!);
        res.status(201).json(session);
    } catch (error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessions = await storage.getChatSessions(req.user.id);
        res.json(sessions);
    } catch (error) {
        next(error);
    }
});
router.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        const session = await storage.getChatSessionById(req.user.id, sessionId);
        if (!session) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.json(session.messages || []);
    } catch (error) {
        next(error);
    }
});
router.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        const { title } = req.body;
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        const parsedData = partialChatSessionSchema.parse({ title });
        const updatedSession = await storage.updateChatSessionTitle(req.user.id, sessionId, parsedData.title!);
        if (!updatedSession) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.json(updatedSession);
    } catch (error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
router.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        const result = await storage.deleteChatSession(req.user.id, sessionId);
        if (!result.success) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Error handling middleware (final)
router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[GLOBAL_ERROR_HANDLER] ${new Date().toISOString()} Path: ${req.path}`);
  console.error(err);
  if (err instanceof ZodError) return handleZodError(err, req, res, _next);
  if (err instanceof multer.MulterError) {
    res.locals.errorMessage = { error: 'Erro de upload de arquivo', details: err.message, code: err.code };
    return res.status(400).json(res.locals.errorMessage);
  }
  const anyError = err as any;
  if (anyError.isGoogleGenerativeAIError === true) {
     res.locals.errorMessage = { error: 'Erro no serviço de IA (Google Gemini)', details: anyError.message };
     return res.status(502).json(res.locals.errorMessage);
  }
  res.locals.errorMessage = { error: 'Erro interno do servidor', details: err.message };
  return res.status(500).json(res.locals.errorMessage);
});

export default router;
