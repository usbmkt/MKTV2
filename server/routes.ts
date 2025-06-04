// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { storage } from "./storage"; // Garanta que o storage está correto
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from "../shared/schema"; // Importação correta
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

// Criação de diretórios (OK)
[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Routes] Diretório criado: ${dir}`);
    } else {
        console.log(`[Routes] Diretório já existe: ${dir}`);
    }
});

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[GEMINI] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada.");
}

const creativesUpload = multer({ storage: multer.diskStorage({ destination: CREATIVES_ASSETS_DIR, filename: (req, file, cb) => { const sfx = Date.now(); cb(null, `${file.fieldname}-${sfx}${path.extname(file.originalname)}`); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const types = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; cb(null, types.test(path.extname(file.originalname).toLowerCase()) && types.test(file.mimetype)); } });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: LP_ASSETS_DIR, filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_').toLowerCase()}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const types = /jpeg|jpg|png|gif|svg|webp/; cb(null, types.test(path.extname(file.originalname).toLowerCase()) && types.test(file.mimetype)); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: MCP_ATTACHMENTS_DIR, filename: (req, file, cb) => { const sfx = Date.now(); cb(null, `mcp-attachment-${sfx}${path.extname(file.originalname)}`); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const types = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; cb(null, types.test(path.extname(file.originalname).toLowerCase()) && types.test(file.mimetype)); } });

interface AuthenticatedRequest extends Request {  user?: schema.User; }

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    // @ts-ignore
    req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@usbmkt.com', createdAt: new Date(), updatedAt: new Date(), password: '' };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido. Acesso não autorizado.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário do token não encontrado.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro na verificação do token:", error);
    return res.status(500).json({ error: 'Falha na autenticação do token.' });
  }
};

// Handlers de erro permanecem aqui para serem usados pelos routers específicos se necessário,
// mas os globais estarão em server/index.ts
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... */ };
const handleErrorLocal = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (similar ao handleError global mas pode ser mais específico) */};


export async function registerRoutes(app: Express): Promise<void> {
  
  const publicRouter = express.Router();
  const apiRouter = express.Router(); // Router para rotas autenticadas

  // Rotas Públicas (Autenticação, Health Check, LP pública)
  publicRouter.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5' });
  });
  publicRouter.post('/auth/register', async (req, res, next) => {
    try {
      const userData = schema.insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) return res.status(409).json({ error: 'Usuário com este email já existe.' });
      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { next(error); }
  });
  publicRouter.post('/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      const user = await storage.getUserByEmail(email);
      if (!user || !(await storage.validatePassword(password, user.password))) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { next(error); }
  });
  publicRouter.get('/landingpages/slug/:slug', async (req, res, next) => {
    try {
      const { slug } = req.params;
      const landingPage = await storage.getLandingPageBySlug(slug);
      if (!landingPage || landingPage.status !== 'published') {
        return res.status(404).json({ error: 'Landing Page não encontrada ou não publicada.' });
      }
      res.json({ name: landingPage.name, data: landingPage.grapesJsData, publicUrl: landingPage.publicUrl });
    } catch (error) { next(error); }
  });
  
  // Aplicar autenticação para todas as rotas no apiRouter
  apiRouter.use(authenticateToken);

  // Rotas Protegidas
  apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const timeRange = req.query.timeRange as string || '30d';
      res.json(await storage.getDashboardData(userId, timeRange));
    } catch (error) { next(error); }
  });

  // Campaigns (no apiRouter)
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (e) { next(e); }});
  apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res, next) => { try { const data = schema.insertCampaignSchema.parse({...req.body, userId: req.user!.id }); res.status(201).json(await storage.createCampaign(data)); } catch (e) { next(e); }});
  apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { const id=parseInt(req.params.id); const c = await storage.getCampaign(id, req.user!.id); c ? res.json(c) : res.status(404).json({error:'Não encontrado'});} catch (e) { next(e); }});
  apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { const id=parseInt(req.params.id); const data = schema.insertCampaignSchema.partial().parse(req.body); const c = await storage.updateCampaign(id, data, req.user!.id); c ? res.json(c) : res.status(404).json({error:'Não encontrado'});} catch (e) { next(e); }});
  apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { try { const id=parseInt(req.params.id); const s = await storage.deleteCampaign(id, req.user!.id); s ? res.status(200).json({message:'Deletado'}) : res.status(404).json({error:'Não encontrado'});} catch (e) { next(e); }});

  // Creatives (no apiRouter)
  apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => { try { const cId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; res.json(await storage.getCreatives(req.user!.id, cId)); } catch(e) {next(e);}});
  apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { try { const data=schema.insertCreativeSchema.parse({...req.body, userId:req.user!.id, fileUrl: req.file ? `/uploads/creatives-assets/${req.file.filename}` : req.body.fileUrl||null}); res.status(201).json(await storage.createCreative(data));}catch(e){next(e);}});
  apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ...lógica completa do PUT creatives... */ });
  apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res, next) => { /* ...lógica completa do DELETE creatives... */ });

  // WhatsApp (no apiRouter)
  apiRouter.get('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getMessages(req.user!.id, req.query.contact as string | undefined)); } catch(e){next(e);} });
  apiRouter.post('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { try { const data = schema.insertWhatsappMessageSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createMessage(data));} catch(e){next(e);}});
  apiRouter.get('/whatsapp/contacts', async (req: AuthenticatedRequest, res, next) => { try {res.json(await storage.getContacts(req.user!.id));}catch(e){next(e);}});
  
  // Copies (no apiRouter)
  apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => { try { const cId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; res.json(await storage.getCopies(req.user!.id, cId)); } catch(e){next(e);}});
  apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => { try { const data=schema.insertCopySchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createCopy(data));}catch(e){next(e);}});
  apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => { try {const id=parseInt(req.params.id); await storage.deleteCopy(id, req.user!.id); res.sendStatus(204);}catch(e){next(e);}});
  apiRouter.post('/copies/generate', async (req: AuthenticatedRequest, res, next) => { /* ...lógica completa do POST copies/generate... */ });
  
  // Alerts (no apiRouter)
  apiRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => { try{ res.json(await storage.getAlerts(req.user!.id, req.query.unread === 'true'));} catch(e){next(e);}});
  apiRouter.put('/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => { try{ const id=parseInt(req.params.id); await storage.markAlertAsRead(id, req.user!.id); res.sendStatus(204);}catch(e){next(e);}});

  // Budgets (no apiRouter)
  apiRouter.get('/budgets', async (req: AuthenticatedRequest, res, next) => { try{ const cId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; res.json(await storage.getBudgets(req.user!.id, cId));}catch(e){next(e);}});
  apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => { try{ const data=schema.insertBudgetSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createBudget(data));}catch(e){next(e);}});
  
  // Landing Pages (rotas protegidas no apiRouter, exceto /slug/:slug que está no publicRouter)
  apiRouter.get('/landingpages', async (req: AuthenticatedRequest, res, next) => { try{res.json(await storage.getLandingPages(req.user!.id));}catch(e){next(e);}});
  apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => { try{ const data=schema.insertLandingPageSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createLandingPage(data));}catch(e){next(e);}});
  apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => { try{ const lp=await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user!.id); lp ? res.json({project: lp.grapesJsData || {}}): res.status(404).json({error: 'Não encontrado'});}catch(e){next(e);}});
  apiRouter.put('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { try{ const id=parseInt(req.params.id); const data=schema.insertLandingPageSchema.partial().parse(req.body); const lp=await storage.updateLandingPage(id,data,req.user!.id); lp ? res.json(lp): res.status(404).json({error:'Não encontrado'});}catch(e){next(e);}});
  apiRouter.delete('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { try{ const id=parseInt(req.params.id); await storage.deleteLandingPage(id, req.user!.id); res.sendStatus(204);}catch(e){next(e);}});

  // Assets (LP e MCP - protegidos)
  apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => { try{ if(!req.file) return res.status(400).json({error: 'No file'}); res.json([{src: `/uploads/lp-assets/${req.file.filename}`}]);}catch(e){next(e);}});
  apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => { /* ...lógica de delete asset... */ });
  apiRouter.post('/mcp/upload-attachment', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res, next) => { try{ if(!req.file) return res.status(400).json({error: 'No file'}); res.json({url: `/uploads/mcp-attachments/${req.file.filename}`});}catch(e){next(e);}});
  
  // MCP Converse (protegido)
  apiRouter.post('/mcp/converse', async (req: AuthenticatedRequest, res, next) => { /* ...lógica completa de /mcp/converse... */ });

  // Chat Sessions (protegido)
  apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { try{ const data=schema.insertChatSessionSchema.parse({...req.body, userId: req.user!.id}); res.status(201).json(await storage.createChatSession(req.user!.id, data.title));}catch(e){next(e);}});
  apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { try{res.json(await storage.getChatSessions(req.user!.id));}catch(e){next(e);}});
  apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => { try{const id=parseInt(req.params.sessionId); res.json(await storage.getChatMessages(id, req.user!.id));}catch(e){next(e);}});
  apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });


  // Montar os routers no app principal com o prefixo /api
  app.use('/api', publicRouter);
  app.use('/api', apiRouter); // Este já tem o authenticateToken aplicado internamente

  // Handlers de erro Zod e genérico (serão aplicados após estas rotas no server/index.ts)
  // app.use(handleZodError);
  // app.use(handleErrorLocal); // Ou use o global de server/index.ts
}
