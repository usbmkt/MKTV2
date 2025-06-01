// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra'; // Usar fs-extra para garantir que a pasta seja criada
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
  insertFunnelSchema,
  insertFunnelStageSchema,
  User, 
  allCopyPurposesConfig,
  aiResponseSchema,
  // Schemas Zod para WhatsApp (se forem usados para validação de rota)
  // Por exemplo:
  // insertWhatsappConnectionSchema,
  // insertWhatsappFlowSchema,
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY, PORT as SERVER_PORT } from './config';
import { handleMCPConversation } from './mcp_handler';

import { WhatsappConnectionService } from "./services/whatsapp-connection.service"; // Já deve estar aqui

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

// Garantir que os diretórios de upload existam na inicialização
[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    fs.ensureDirSync(dir); // fs-extra garante que o diretório exista
    console.log(`[FS] Diretório verificado/criado: ${dir}`);
});

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });

export interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH_BYPASS] Autenticação bypassada. Usando usuário mock.');
    req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date() };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
    if (typeof decoded.userId !== 'number') return res.status(403).json({ error: 'Formato de token inválido.' });
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro inesperado na verificação do token:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, JSON.stringify(err.errors, null, 2));
    return res.status(400).json({
      error: "Erro de validação nos dados enviados.",
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }
  next(err);
};

const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[HANDLE_ERROR] Erro não tratado para ${req.method} ${req.originalUrl}:`, err.message);
  if (err.stack) console.error(err.stack);
  if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}. Verifique o nome do campo esperado.` });
  if (err.message && (err.message.includes("Tipo de arquivo inválido") || err.code === "LIMIT_FILE_SIZE" || err.code === "ENOENT")) return res.status(400).json({ error: err.message });
  if (err.constructor && err.constructor.name === "GoogleGenerativeAIFetchError") {
    const generativeError = err as any;
    const status = generativeError.status || 500;
    const message = generativeError.message || "Erro ao comunicar com o serviço de IA.";
    console.error(`[GEMINI_API_ERROR] Status: ${status}, Message: ${message}`, generativeError.errorDetails || generativeError);
    return res.status(status).json({ error: `Erro na IA: ${message}` });
  }
  const statusCode = err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";
  res.status(statusCode).json({ error: message });
};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
  try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log("[GEMINI_ROUTES] SDK do Gemini inicializado com sucesso."); }
  catch (error) { console.error("[GEMINI_ROUTES] Falha ao inicializar o SDK do Gemini:", error); genAI = null; }
} else { console.warn("[GEMINI_ROUTES] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou inválida."); }

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5-API', version: '1.0.0' }));

  // --- ROTAS DE AUTENTICAÇÃO ---
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) return res.status(409).json({ error: 'Usuário com este email já existe.' });
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) return res.status(409).json({ error: 'Nome de usuário já está em uso.' });
      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    let emailForLog: string | undefined = req.body.email; // Declarar fora do try para acesso no catch
    try {
      const { email, password } = req.body;
      emailForLog = email; // Atribuir após desestruturação bem-sucedida

      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const isValidPassword = await storage.validatePassword(password, user.password);
      if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) {
      console.error(`[LOGIN_HANDLER] Erro no handler de login para email ${emailForLog || 'desconhecido'}:`, error); // CORREÇÃO AQUI
      next(error);
    }
  });

  // --- ROTAS DO DASHBOARD ---
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || typeof req.user.id !== 'number') return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
      const userId = req.user.id;
      const timeRange = req.query.timeRange as string || '30d';
      const dashboardData = await storage.getDashboardData(userId, timeRange);
      res.json(dashboardData);
    } catch (error) { next(error); }
  });

  // --- ROTAS DE CAMPAIGNS --- (MANTIDAS COMO ANTES)
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); res.json(await storage.getCampaigns(req.user.id)); } catch (e) { next(e); }});
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const campaignData = insertCampaignSchema.parse({ ...req.body, userId: req.user.id }); res.status(201).json(await storage.createCampaign(campaignData)); } catch (e) { next(e); }});
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const campaign = await storage.getCampaign(id, req.user.id); if(!campaign) return res.status(404).json({error: 'Campanha não encontrada.'}); res.json(campaign); } catch (e) { next(e); }});
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const { userId, ...updateData } = req.body; const data = insertCampaignSchema.partial().parse(updateData); const camp = await storage.updateCampaign(id,data,req.user.id); if(!camp) return res.status(404).json({error: 'Campanha não encontrada.'}); res.json(camp); } catch (e) { next(e); }});
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const success=await storage.deleteCampaign(id,req.user.id); if(!success) return res.status(404).json({error: 'Campanha não encontrada.'}); res.status(200).json({message: 'Campanha excluída.'});} catch(e){next(e);}});

  // --- ROTAS DE CREATIVES --- (MANTIDAS COMO ANTES)
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const cIdQ = req.query.campaignId as string | undefined; let cId: number | null | undefined = undefined; if(cIdQ==='null'||cIdQ==='') cId=null; else if(cIdQ){ const pId=parseInt(cIdQ); if(isNaN(pId)) return res.status(400).json({error:'ID Campanha Inválido'}); cId=pId;} res.json(await storage.getCreatives(req.user.id, cId));}catch(e){next(e);}});
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); let cId:number|null|undefined=undefined; if(req.body.campaignId==='null'||req.body.campaignId==='') cId=null; else if(req.body.campaignId!==undefined){const pId=parseInt(req.body.campaignId); if(!isNaN(pId)) cId=pId;} const data=insertCreativeSchema.parse({...req.body, userId:req.user.id, campaignId: cId, fileUrl:req.file?`/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`: (req.body.fileUrl||null)}); res.status(201).json(await storage.createCreative(data));}catch(e){if(req.file && e instanceof Error){fs.unlink(path.join(CREATIVES_ASSETS_DIR,req.file.filename),err=>{if(err)console.error("Erro ao deletar arquivo:",err);});}next(e);}});
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const creative=await storage.getCreative(id, req.user.id); if(!creative) return res.status(404).json({error:'Criativo não encontrado.'}); const success = await storage.deleteCreative(id,req.user.id); if(!success) return res.status(404).json({error:'Falha ao excluir.'}); if(creative.fileUrl){try{const relPath=creative.fileUrl.startsWith('/')?creative.fileUrl.substring(1):creative.fileUrl; const absPath=path.join(process.cwd(),relPath); if(fs.existsSync(absPath)) fs.unlink(absPath,err=>{if(err)console.error("Erro ao deletar arquivo:",err);});}catch(fileErr){console.error("Erro ao processar path:", fileErr);}} res.status(200).json({message:'Criativo excluído.'});}catch(e){next(e);}});
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const userId=req.user.id; const existing=await storage.getCreative(id,userId); if(!existing){if(req.file)fs.unlink(req.file.path,err=>{if(err)console.error("Erro ao deletar arquivo órfão:",err);}); return res.status(404).json({error:'Criativo não encontrado.'});} const{userId:_,...updateClientData}=req.body; let campId:number|null|undefined = updateClientData.campaignId; if(updateClientData.campaignId==='null'||updateClientData.campaignId==='') campId=null; else if(updateClientData.campaignId!==undefined){const p=parseInt(updateClientData.campaignId); campId=isNaN(p)?undefined:p;} const dataValid={...updateClientData,campaignId:campId}; const validatedData=insertCreativeSchema.partial().parse(dataValid); let newFileUrl:string|null|undefined=existing.fileUrl; if(req.file){newFileUrl=`/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`; if(existing.fileUrl&&existing.fileUrl!==newFileUrl){const oldPath=path.join(process.cwd(),existing.fileUrl.startsWith('/')?existing.fileUrl.substring(1):existing.fileUrl); if(fs.existsSync(oldPath))fs.unlink(oldPath,err=>{if(err)console.error("Erro ao deletar arquivo antigo:",err);});}} else if(validatedData.hasOwnProperty('fileUrl')&&(validatedData.fileUrl===null||validatedData.fileUrl==="null")){newFileUrl=null; if(existing.fileUrl){const oldPath=path.join(process.cwd(),existing.fileUrl.startsWith('/')?existing.fileUrl.substring(1):existing.fileUrl); if(fs.existsSync(oldPath))fs.unlink(oldPath,err=>{if(err)console.error("Erro ao deletar arquivo existente:",err);});}} validatedData.fileUrl=newFileUrl; const updated=await storage.updateCreative(id,validatedData,userId); if(!updated){if(req.file)fs.unlink(req.file.path,err=>{if(err)console.error("Erro ao deletar novo arquivo após falha no update DB:",err);}); return res.status(404).json({error:'Falha ao atualizar.'});} res.json(updated);}catch(e){if(req.file)fs.unlink(req.file.path,unlinkErr=>{if(unlinkErr)console.error("Erro ao deletar novo arquivo de criativo após falha geral no PUT:",unlinkErr);}); next(e);}});
  
  // --- ROTAS DE COPIES --- (MANTIDAS COMO ANTES)
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (lógica mantida) ... */ });
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (lógica mantida) ... */ });
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const dataToValidate = { ...req.body, userId: req.user.id, }; const validatedData = insertCopySchema.parse(dataToValidate); const newCopy = await storage.createCopy(validatedData); res.status(201).json(newCopy); } catch (error) { next(error); }});
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (lógica mantida) ... */ });
  app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (lógica mantida) ... */ });

  // --- ROTAS DE ALERTS, BUDGETS, LANDING PAGES, ASSETS LP, MCP, CHAT, FUNNELS --- (MANTIDAS COMO ANTES)
  // ... (todas as suas rotas existentes permanecem aqui) ...
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const onlyUnread = req.query.unread === 'true'; res.json(await storage.getAlerts(req.user.id, onlyUnread)); } catch (error) { next(error); }});
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' }); const success = await storage.markAlertAsRead(id, req.user.id); if (!success) return res.status(404).json({ error: 'Alerta não encontrado.' }); res.json({ success: true, message: 'Alerta lido.' }); } catch (error) { next(error); }});
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const campaignIdQuery = req.query.campaignId as string | undefined; let campaignId: number | null | undefined = undefined; if(campaignIdQuery === 'null' || campaignIdQuery === '') campaignId = null; else if (campaignIdQuery) { const pId = parseInt(campaignIdQuery); if(isNaN(pId)) return res.status(400).json({error: 'ID da campanha inválido'}); campaignId = pId;} res.json(await storage.getBudgets(req.user.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const budgetData = insertBudgetSchema.parse({ ...req.body, userId: req.user.id }); res.status(201).json(await storage.createBudget(budgetData)); } catch (error) { next(error); }});
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); res.json(await storage.getLandingPages(req.user.id)); } catch (error) { next(error); }});
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const { grapesJsData, ...otherData } = req.body; const lpData = insertLandingPageSchema.parse({ ...otherData, userId: req.user.id, grapesJsData: grapesJsData || {} }); if (lpData.slug) { const existing = await storage.getLandingPageBySlug(lpData.slug); if (existing && existing.id !== (lpData as any).id) return res.status(409).json({ error: 'Slug já existe.'}); } res.status(201).json(await storage.createLandingPage(lpData)); } catch (error) { next(error); }});
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user.id); if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.'}); res.json({ project: lp.grapesJsData || {} }); } catch (e) { next(e); }});
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const { userId: _, slug, ...lpDataRaw } = req.body; const lpData = insertLandingPageSchema.partial().parse(lpDataRaw); if(slug) { const existing = await storage.getLandingPageBySlug(slug); if(existing && existing.id !== id) return res.status(409).json({error: 'Slug já existe.'}); (lpData as any).slug = slug; } const updated = await storage.updateLandingPage(id, lpData, req.user.id); if(!updated) return res.status(404).json({error: 'LP não encontrada.'}); res.json(updated); } catch (e) { next(e); }});
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const success = await storage.deleteLandingPage(id, req.user.id); if(!success) return res.status(404).json({error: 'LP não encontrada.'}); res.status(200).json({message: 'LP excluída.'});} catch(e){next(e);}});
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => { if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo.' }); const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${SERVER_PORT}`; const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`; res.status(200).json([{ src: publicUrl }]);});
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try {const {assets} = req.body; if(!Array.isArray(assets)) return res.status(400).json({error: 'Assets inválidos.'}); assets.forEach(a => { try { if (a && typeof a.src === 'string') { const assetUrl = new URL(a.src); const filename = path.basename(assetUrl.pathname); if (filename.includes("..") || !assetUrl.pathname.includes(`/${UPLOADS_ROOT_DIR}/lp-assets/`)) { console.warn(`[ASSET_DELETE_LP] Tentativa de path traversal ou URL inválida: ${a.src}`); return; } const filePath = path.join(LP_ASSETS_DIR, filename); if(fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if(err) console.error("Erro ao deletar asset:", err)});}} catch(e){ console.error("Erro ao tentar deletar asset de LP:", e);} }); res.status(200).json({message: 'Solicitação processada.'});} catch(e){next(e);}});
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {if (!req.file) return res.status(400).json({ error: 'Nenhum anexo.' }); const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${SERVER_PORT}`; const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}`; res.status(200).json({ url: publicUrl });});
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const {message, sessionId, attachmentUrl} = req.body; res.json(await handleMCPConversation(req.user.id, message, sessionId, attachmentUrl)); } catch(e) {next(e);}});
  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const userId = req.user.id; const { title } = insertChatSessionSchema.partial().parse(req.body); const newSession = await storage.createChatSession(userId, title || 'Nova Conversa'); res.status(201).json(newSession); } catch (error) { next(error); }});
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const userId = req.user.id; res.json(await storage.getChatSessions(userId)); } catch (error) { next(error); }});
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; res.json(await storage.getChatMessages(sessionId, userId)); } catch (error) { next(error); }});
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; const { title } = req.body; if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ error: 'Título inválido.'}); const updated = await storage.updateChatSessionTitle(sessionId, userId, title); if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; const success = await storage.deleteChatSession(sessionId, userId); if (!success) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.status(200).json({ message: 'Sessão excluída.' }); } catch (error) { next(error); }});
  app.get('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const cIdQ = req.query.campaignId as string | undefined; let cId: number | null | undefined; if(cIdQ === 'null' || cIdQ === '') cId=null; else if(cIdQ) {const p = parseInt(cIdQ); if(isNaN(p)) return res.status(400).json({error: 'ID Campanha Inválido'}); cId=p;} res.json(await storage.getFunnels(req.user.id, cId));} catch(e){next(e);}});
  app.post('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const data = insertFunnelSchema.parse({...req.body, userId: req.user.id}); res.status(201).json(await storage.createFunnel(data));} catch(e){next(e);}});
  app.get('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Funil Inválido'}); const f = await storage.getFunnel(id, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); res.json(f); } catch(e){next(e);}});
  app.put('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id))return res.status(400).json({error: 'ID Funil Inválido'}); const {userId, ...updateData} = req.body; const data=insertFunnelSchema.partial().parse(updateData); const f = await storage.updateFunnel(id, data, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); res.json(f);} catch(e){next(e);}});
  app.delete('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Funil Inválido'}); const s = await storage.deleteFunnel(id, req.user.id); if(!s) return res.status(404).json({error: 'Funil não encontrado'}); res.status(200).json({message: 'Funil excluído'});} catch(e){next(e);}});
  app.get('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const fId=parseInt(req.params.funnelId); if(isNaN(fId)) return res.status(400).json({error: 'ID Funil Inválido'}); res.json(await storage.getFunnelStages(fId, req.user.id));} catch(e){next(e);}});
  app.post('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const fId=parseInt(req.params.funnelId); if(isNaN(fId)) return res.status(400).json({error: 'ID Funil Inválido'}); const f = await storage.getFunnel(fId, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); const data = insertFunnelStageSchema.parse({...req.body, funnelId: fId}); res.status(201).json(await storage.createFunnelStage(data));} catch(e){next(e);}});
  app.put('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Etapa Inválido'}); const {funnelId, ...updateData} = req.body; const data=insertFunnelStageSchema.partial().parse(updateData); const s = await storage.updateFunnelStage(id, data, req.user.id); if(!s) return res.status(404).json({error: 'Etapa não encontrada'}); res.json(s);} catch(e){next(e);}});
  app.delete('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Etapa Inválido'}); const s = await storage.deleteFunnelStage(id, req.user.id); if(!s) return res.status(404).json({error: 'Etapa não encontrada'}); res.status(200).json({message: 'Etapa excluída'});} catch(e){next(e);}});


  // --- ROTAS DE WHATSAPP CONNECTION ---
  app.get('/api/whatsapp/connection/status', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const status = await WhatsappConnectionService.getConnectionStatus(req.user.id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/whatsapp/connection/connect', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Usuário não autenticado.' });
      // O método connect vai iniciar Baileys e o QR code será salvo no DB pelo serviço.
      // O frontend então pegará o QR via GET /status.
      await WhatsappConnectionService.connect(req.user.id);
      // Retorna um status inicial, o frontend deve pollar /status para QR/conexão completa.
      const currentStatus = await WhatsappConnectionService.getConnectionStatus(req.user.id);
      res.status(202).json({ message: 'Solicitação de conexão recebida.', status: currentStatus.connectionStatus, qrCode: currentStatus.qrCodeData });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/whatsapp/connection/disconnect', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Usuário não autenticado.' });
      await WhatsappConnectionService.disconnect(req.user.id);
      res.json({ message: 'Desconexão solicitada com sucesso.' });
    } catch (error) {
      next(error);
    }
  });

  // --- FIM DAS ROTAS DE WHATSAPP CONNECTION ---

  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
