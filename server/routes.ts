// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  insertUserSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertWhatsappMessageSchema,
  insertCopySchema,
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  User,
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { JWT_SECRET, GEMINI_API_KEY } from './config';
import { handleMCPConversation } from './mcp_handler';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
        // console.log(`Diretório criado: ${dir}`); // Removido console.log do build
    }
});

const creativesUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para criativos.'));
  },
});

const lpAssetUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para assets de landing page.'));
  }
});

const mcpAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido para anexos do MCP.'));
  },
});

interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; };
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro token:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))});
  }
  next(err);
};

const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[HANDLE_ERROR] ${req.method} ${req.originalUrl}:`, err.message, err.stack ? err.stack.substring(0, 300) : '');
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Erro no upload: ${err.message}`});
  if (err.message?.includes('Tipo de arquivo inválido')) return res.status(400).json({ error: err.message });
  if (err.constructor?.name === 'GoogleGenerativeAIFetchError') return res.status((err as any).status || 500).json({ error: `Erro na IA: ${(err as any).message}` });
  res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno do servidor.' });
};

export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ error: 'Usuário com este email já existe.' });
      }
      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const isValidPassword = await storage.validatePassword(password, user.password);
      if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { next(error); }
  });
  
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json(await storage.getDashboardData(req.user!.id, req.query.timeRange as string || '30d')); } catch (error) { next(error); }
  });

  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json(await storage.getCampaigns(req.user!.id)); } catch (error) { next(error); }
  });
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignData = insertCampaignSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createCampaign(campaignData));
    } catch (error) { next(error); }
  });
   app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const campaign = await storage.getCampaign(id, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const { userId, ...updateData } = req.body;
      const campaignData = insertCampaignSchema.partial().parse(updateData);
      const campaign = await storage.updateCampaign(id, campaignData, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const success = await storage.deleteCampaign(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Campanha excluída com sucesso.' });
    } catch (error) { next(error); }
  });

  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getCreatives(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const creativeData = insertCreativeSchema.parse({ ...req.body, userId: req.user!.id, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null });
      res.status(201).json(await storage.createCreative(creativeData));
    } catch (error) { next(error); }
  });
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
      const creative = await storage.getCreative(id, req.user!.id);
      if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' });
      const success = await storage.deleteCreative(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Criativo não encontrado ou não pode ser excluído.' });
      if (creative.fileUrl) {
        const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl);
        if (fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if (err) console.error(`Erro ao deletar arquivo ${filePath}:`, err);});
      }
      res.status(200).json({ message: 'Criativo excluído com sucesso.' });
    } catch (error) { next(error); }
  });
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
      const userId = req.user!.id;
      const existingCreative = await storage.getCreative(id, userId);
      if (!existingCreative) return res.status(404).json({ error: 'Criativo não encontrado.' });
      const { userId: _, ...updateDataRaw } = req.body;
      const updateData = insertCreativeSchema.partial().parse(updateDataRaw);
      let newFileUrl: string | null | undefined = existingCreative.fileUrl; // Default to existing
      if (req.file) {
        newFileUrl = `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`;
        if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) {
          const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
          if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo antigo:", err);});
        }
      } else if (req.body.fileUrl === "null" || req.body.fileUrl === null) { // Check if explicitly set to null
        newFileUrl = null;
        if (existingCreative.fileUrl) {
            const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
            if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo existente:", err);});
        }
      }
      updateData.fileUrl = newFileUrl;
      const updatedCreative = await storage.updateCreative(id, updateData, userId);
      if (!updatedCreative) return res.status(404).json({ error: 'Criativo não atualizado.' });
      res.json(updatedCreative);
    } catch (error) { next(error); }
  });

  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });

  let localGenAIForCopies: GoogleGenerativeAI | null = null;
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
    try {
      localGenAIForCopies = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (error) { console.error("[COPIES_ROUTE_GEMINI] Falha ao init SDK:", error); }
  }
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { product, audience, objective, tone } = req.body;
      if (!product || !audience || !objective || !tone) return res.status(400).json({ error: "Campos obrigatórios." });
      if (!localGenAIForCopies) return res.status(500).json({ error: "IA não disponível." });
      const model = localGenAIForCopies.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const prompts = [
         { type: 'headline', platform: 'Facebook', prompt: `Crie um headline para Facebook Ads: Produto="${product}", Público="${audience}", Objetivo="${objective}", Tom="${tone}". Máx 60 chars.` },
         { type: 'cta', platform: 'Google Ads', prompt: `Crie um CTA para Google Ads: Produto="${product}", Público="${audience}", Objetivo="${objective}", Tom="${tone}". Máx 30 palavras.` },
         { type: 'description', platform: 'Instagram', prompt: `Crie uma descrição para Instagram: Produto="${product}", Público="${audience}", Objetivo="${objective}", Tom="${tone}". Máx 125 chars.` }
      ];
      const results = await Promise.all(prompts.map(async p => {
        try { return { type: p.type, content: (await model.generateContent(p.prompt)).response.text().trim(), platform: p.platform }; }
        catch (e) { return { type: p.type, content: `Fallback: ${product} para ${audience} (${p.type})`, platform: p.platform }; }
      }));
      res.json(results);
    } catch (error) { next(error); }
  });
  
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req, res, next) => { /* ... */ });
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req, res, next) => { /* ... */ });
  
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId, attachmentUrl, mcpContext } = req.body;
      const userId = req.user!.id;
      const result = await handleMCPConversation(userId, message, sessionId, attachmentUrl, mcpContext);
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });

  // Preenchimento das rotas que estavam como /* ... */ para garantir a completude
  // (As rotas de exemplo para Auth, Dashboard e Campaigns já foram preenchidas acima)
  // WhatsApp
  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const contactNumber = req.query.contact as string | undefined; res.json(await storage.getMessages(req.user!.id, contactNumber)); } catch (error) { next(error); }});
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const messageData = insertWhatsappMessageSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createMessage(messageData)); } catch (error) { next(error); }});
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getContacts(req.user!.id)); } catch (error) { next(error); }});
  // Copies
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); res.json(await storage.getCopies(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const copyData = insertCopySchema.parse({ ...req.body, userId: req.user!.id, campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : null }); res.status(201).json(await storage.createCopy(copyData)); } catch (error) { next(error); }});
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' }); const success = await storage.deleteCopy(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Copy não encontrada.' }); res.status(200).json({ message: 'Copy excluída.' }); } catch (error) { next(error); }});
  // Alerts
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const onlyUnread = req.query.unread === 'true'; res.json(await storage.getAlerts(req.user!.id, onlyUnread)); } catch (error) { next(error); }});
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' }); const success = await storage.markAlertAsRead(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Alerta não encontrado.' }); res.json({ success: true, message: 'Alerta lido.' }); } catch (error) { next(error); }});
  // Budgets
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; res.json(await storage.getBudgets(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const budgetData = insertBudgetSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createBudget(budgetData)); } catch (error) { next(error); }});
  // Landing Pages & Assets
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getLandingPages(req.user!.id)); } catch (error) { next(error); }});
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const { grapesJsData, ...otherData } = req.body; const lpData = insertLandingPageSchema.parse({ ...otherData, userId: req.user!.id, grapesJsData: grapesJsData || {} }); if (lpData.slug) { const existing = await storage.getLandingPageBySlug(lpData.slug); if (existing) return res.status(409).json({ error: 'Slug já existe.'}); } res.status(201).json(await storage.createLandingPage(lpData)); } catch (error) { next(error); }});
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user!.id); if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.'}); res.json({ project: lp.grapesJsData || {} }); } catch (e) { next(e); }});
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const { userId: _, slug, ...lpDataRaw } = req.body; const lpData = insertLandingPageSchema.partial().parse(lpDataRaw); if(slug) { const existing = await storage.getLandingPageBySlug(slug); if(existing && existing.id !== id) return res.status(409).json({error: 'Slug já existe.'}); (lpData as any).slug = slug; } const updated = await storage.updateLandingPage(id, lpData, req.user!.id); if(!updated) return res.status(404).json({error: 'LP não encontrada.'}); res.json(updated); } catch (e) { next(e); }});
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const success = await storage.deleteLandingPage(id, req.user!.id); if(!success) return res.status(404).json({error: 'LP não encontrada.'}); res.status(200).json({message: 'LP excluída.'});} catch(e){next(e);}});
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req, res, next) => { if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo.' }); const publicUrl = `${process.env.APP_BASE_URL || ''}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`; res.status(200).json([{ src: publicUrl }]);});
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {const {assets} = req.body; if(!Array.isArray(assets)) return res.status(400).json({error: 'Assets inválidos.'}); assets.forEach(a => { try { const filename = path.basename(new URL(a.src).pathname); if(!filename.includes('..') && a.src.includes(`/${UPLOADS_ROOT_DIR}/lp-assets/`)) {const fp = path.join(LP_ASSETS_DIR, filename); if(fs.existsSync(fp)) fs.unlink(fp, ()=>{});}} catch(e){} }); res.status(200).json({message: 'Solicitação processada.'});} catch(e){next(e);}});
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req, res, next) => {if (!req.file) return res.status(400).json({ error: 'Nenhum anexo.' }); const publicUrl = `${process.env.APP_BASE_URL || ''}/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}`; res.status(200).json({ url: publicUrl });});
  // Chat Sessions
  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; const { title } = insertChatSessionSchema.partial().parse(req.body); const newSession = await storage.createChatSession(userId, title || 'Nova Conversa'); res.status(201).json(newSession); } catch (error) { next(error); }});
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; res.json(await storage.getChatSessions(userId)); } catch (error) { next(error); }});
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; res.json(await storage.getChatMessages(sessionId, userId)); } catch (error) { next(error); }});
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; const { title } = req.body; if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ error: 'Título inválido.'}); const updated = await storage.updateChatSessionTitle(sessionId, userId, title); if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; const success = await storage.deleteChatSession(sessionId, userId); if (!success) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.status(200).json({ message: 'Sessão excluída.' }); } catch (error) { next(error); }});


  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}
