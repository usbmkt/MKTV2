// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage"; // <-- Voltando para importação nomeada
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Alteração: Importar tudo de shared/schema como um namespace
import * as schemaShared from "../shared/schema"; 
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY, PORT as SERVER_PORT } from './config'; 

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Routes] Diretório criado: ${dir}`);
    }
});

// Configurações do Multer (sem alteração)
const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });

export interface AuthenticatedRequest extends Request {
  user?: schemaShared.User; // Usando o tipo User do namespace schemaShared
}

// Middlewares (authenticateToken, handleZodError, handleError) permanecem os mesmos
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH_BYPASS] Autenticação bypassada. Usando usuário mock.');
    req.user = {
      id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com',
      password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date(),
    };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
    if (typeof decoded.userId !== 'number') {
        console.error('[AUTH_MIDDLEWARE] Token decodificado não contém um userId numérico:', decoded);
        return res.status(403).json({ error: 'Formato de token inválido.' });
    }
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      console.warn(`[AUTH_MIDDLEWARE] Usuário com ID ${decoded.userId} não encontrado, token pode ser antigo.`);
      return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    }
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
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message, expected: (e as any).expected, received: (e as any).received }))
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
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[GEMINI] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[GEMINI] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou inválida.");
}

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5-API', version: '1.0.0' }));

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = schemaShared.insertUserSchema.parse(req.body);
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
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const isValidPassword = await storage.validatePassword(password, user.password);
      if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (error) { console.error(`[LOGIN_HANDLER] Erro no handler de login para email ${req.body.email}:`, error); next(error); }
  });
  
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { if (!req.user || typeof req.user.id !== 'number') return res.status(401).json({ error: 'Usuário não autenticado.' });
      const userId = req.user.id; const timeRange = req.query.timeRange as string || '30d';
      res.json(await storage.getDashboardData(userId, timeRange));
    } catch (error) { next(error); }
  });
  
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); res.json(await storage.getCampaigns(req.user.id)); } catch (error) { next(error); }});
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const campaignDataToValidate = { ...req.body, userId: req.user.id }; const validatedData = schemaShared.insertCampaignSchema.parse(campaignDataToValidate); res.status(201).json(await storage.createCampaign(validatedData)); } catch (error) { next(error); }});
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const campaign = await storage.getCampaign(id, req.user.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.json(campaign); } catch (error) { next(error); }});
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const { userId, ...updateDataFromClient } = req.body; const campaignData = schemaShared.insertCampaignSchema.partial().parse(updateDataFromClient); const campaign = await storage.updateCampaign(id, campaignData, req.user.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.json(campaign); } catch (error) { next(error); }});
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const success = await storage.deleteCampaign(id, req.user.id); if (!success) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.status(200).json({ message: 'Campanha excluída.' }); } catch (error) { next(error); }});

  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const campaignIdQuery = req.query.campaignId as string | undefined; let campaignId: number | null | undefined = undefined; if (campaignIdQuery === 'null' || campaignIdQuery === '') campaignId = null; else if (campaignIdQuery) { const parsedId = parseInt(campaignIdQuery); if (isNaN(parsedId)) return res.status(400).json({ error: 'ID da campanha inválido.' }); campaignId = parsedId; } res.json(await storage.getCreatives(req.user.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); let campaignId: number | null | undefined = undefined; if (req.body.campaignId === 'null' || req.body.campaignId === '') campaignId = null; else if (req.body.campaignId !== undefined) { const parsedId = parseInt(req.body.campaignId); campaignId = isNaN(parsedId) ? undefined : parsedId; } const creativeDataToValidate = { ...req.body, userId: req.user.id, campaignId: campaignId, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : (req.body.fileUrl || null), }; const validatedData = schemaShared.insertCreativeSchema.parse(creativeDataToValidate); const creative = await storage.createCreative(validatedData); res.status(201).json(creative); } catch (error) { if (req.file && error instanceof Error) { fs.unlink(path.join(CREATIVES_ASSETS_DIR, req.file.filename), (err) => { if (err) console.error("Erro ao deletar arquivo de criativo:", err);});} next(error); }});
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' }); const creative = await storage.getCreative(id, req.user.id); if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' }); const success = await storage.deleteCreative(id, req.user.id); if (!success) return res.status(404).json({ error: 'Falha ao excluir criativo.' }); if (creative.fileUrl) { try { const relativeFilePath = creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl; const filePath = path.join(process.cwd(), relativeFilePath); if (fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if (err) console.error("Erro ao deletar arquivo físico:", err); else console.log("Arquivo físico deletado:", filePath);}); else console.warn("Arquivo físico não encontrado:", filePath); } catch (fileError) { console.error("Erro ao processar caminho do arquivo:", fileError);}} res.status(200).json({ message: 'Criativo excluído.' }); } catch (error) { next(error); }});
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' }); const userId = req.user.id; const existingCreative = await storage.getCreative(id, userId); if (!existingCreative) { if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Erro ao deletar arquivo órfão:", err);}); return res.status(404).json({ error: 'Criativo não encontrado.' }); } const { userId: _, ...updateDataFromClient } = req.body; let campaignIdToSet: number | null | undefined = updateDataFromClient.campaignId; if (updateDataFromClient.campaignId === 'null' || updateDataFromClient.campaignId === '') campaignIdToSet = null; else if (updateDataFromClient.campaignId !== undefined) { const parsedId = parseInt(updateDataFromClient.campaignId); campaignIdToSet = isNaN(parsedId) ? undefined : parsedId; } const dataToValidate = { ...updateDataFromClient, campaignId: campaignIdToSet }; const validatedUpdateData = schemaShared.insertCreativeSchema.partial().parse(dataToValidate); let newFileUrl: string | null | undefined = existingCreative.fileUrl; if (req.file) { newFileUrl = `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`; if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) { const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl); if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo antigo:", err);});}} else if (validatedUpdateData.hasOwnProperty('fileUrl') && (validatedUpdateData.fileUrl === null || validatedUpdateData.fileUrl === "null")) { newFileUrl = null; if (existingCreative.fileUrl) { const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl); if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo existente (null):", err);});}} validatedUpdateData.fileUrl = newFileUrl; const updatedCreative = await storage.updateCreative(id, validatedUpdateData, userId); if (!updatedCreative) { if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Erro ao deletar novo arquivo (update DB falhou):", err);}); return res.status(404).json({ error: 'Falha ao atualizar criativo.' }); } res.json(updatedCreative); } catch (error) { if (req.file) { fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Erro ao deletar novo arquivo (falha geral PUT):", unlinkErr); }); } next(error); }});

  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { 
    try {
        if (!req.user || typeof req.user.id !== 'number') { return res.status(401).json({ error: 'Usuário não autenticado corretamente.' }); }
        const { product, audience, objective, tone, copyPurposeKey, details, launchPhase } = req.body;
        if (!genAI) { return res.status(503).json({ error: "Serviço de IA não configurado." }); }
        if (!product || !audience || !copyPurposeKey || !details || !launchPhase ) { return res.status(400).json({ error: "Informações insuficientes (product, audience, copyPurposeKey, details, launchPhase obrigatórios)." });}
        const currentPurposeConfig = schemaShared.allCopyPurposesConfig.find(p => p.key === copyPurposeKey); 
        if (!currentPurposeConfig) { return res.status(400).json({ error: "Finalidade da copy desconhecida." }); }
        const launchPhaseLabel = launchPhase === 'pre_launch' ? 'Pré-Lançamento' : launchPhase === 'launch' ? 'Lançamento' : 'Pós-Lançamento';
        let prompt = `Contexto da IA: Você é um Copywriter Mestre... (prompt completo como no seu original) ...DETALHES ESPECÍFICOS... ${Object.entries(details).map(([key, value]) => `- ${currentPurposeConfig.fields.find(f => f.name === key)?.label || key}: ${value || '(Não informado)'}`).join('\n')} ... TAREFA: ...`;
        const baseInfoForEnhancer = { product, audience, objective, tone };
        if (currentPurposeConfig.promptEnhancer) { prompt = currentPurposeConfig.promptEnhancer(prompt, details, baseInfoForEnhancer as any); }
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { responseMimeType: "application/json", responseSchema: schemaShared.aiResponseSchema as any, maxOutputTokens: 3000, temperature: 0.75 }, safetySettings: [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE } ]});
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        let generatedData; try { generatedData = typeof responseText === 'string' ? JSON.parse(responseText) : responseText; } catch (parseError) { console.error("Erro parsear JSON da IA:", parseError, "Resposta bruta:", responseText); throw new Error("A IA retornou JSON inválido."); }
        res.json(generatedData);
    } catch (error) { console.error('[POST /api/copies/generate] Erro:', error); if ((error as any).response?.promptFeedback) { console.error('Feedback Gemini:', JSON.stringify((error as any).response.promptFeedback, null, 2)); return res.status(400).json({ error: "IA bloqueou resposta.", details: (error as any).response.promptFeedback }); } next(error); }
  });
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const cIdQ = req.query.campaignId as string | undefined; let cId: number | null | undefined; if(cIdQ === 'null' || cIdQ === '') cId=null; else if(cIdQ) {const p = parseInt(cIdQ); if(isNaN(p)) return res.status(400).json({error: 'ID Campanha Inválido'}); cId=p;} const phase = req.query.phase as string | undefined; const purposeKey = req.query.purposeKey as string | undefined; const searchTerm = req.query.search as string | undefined; res.json(await storage.getCopies(req.user.id, cId, phase, purposeKey, searchTerm));} catch(e){next(e);}});
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const dataToValidate = { ...req.body, userId: req.user.id, }; const validatedData = schemaShared.insertCopySchema.parse(dataToValidate); res.status(201).json(await storage.createCopy(validatedData));} catch(e){next(e);}});
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido'}); const s = await storage.deleteCopy(id, req.user.id); if(!s) return res.status(404).json({error: 'Não encontrado'}); res.status(200).json({message: 'Excluído'});} catch(e){next(e);}});
  app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido'}); const { userId, id: bodyId, createdAt, lastUpdatedAt, ...updateDataFromClient } = req.body; const validatedData = schemaShared.insertCopySchema.partial().parse(updateDataFromClient); const updated = await storage.updateCopy(id, validatedData, req.user.id); if(!updated) return res.status(404).json({error: 'Não encontrado'}); res.json(updated);} catch(e){next(e);}});
  
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const onlyUnread = req.query.unread === 'true'; res.json(await storage.getAlerts(req.user.id, onlyUnread)); } catch (error) { next(error); }});
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' }); const success = await storage.markAlertAsRead(id, req.user.id); if (!success) return res.status(404).json({ error: 'Alerta não encontrado.' }); res.json({ success: true, message: 'Alerta lido.' }); } catch (error) { next(error); }});
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const campaignIdQuery = req.query.campaignId as string | undefined; let campaignId: number | null | undefined = undefined; if(campaignIdQuery === 'null' || campaignIdQuery === '') campaignId = null; else if (campaignIdQuery) { const pId = parseInt(campaignIdQuery); if(isNaN(pId)) return res.status(400).json({error: 'ID da campanha inválido'}); campaignId = pId;} res.json(await storage.getBudgets(req.user.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const budgetData = schemaShared.insertBudgetSchema.parse({ ...req.body, userId: req.user.id }); res.status(201).json(await storage.createBudget(budgetData)); } catch (error) { next(error); }});
  
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); res.json(await storage.getLandingPages(req.user.id)); } catch (error) { next(error); }});
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const { grapesJsData, ...otherData } = req.body; const lpData = schemaShared.insertLandingPageSchema.parse({ ...otherData, userId: req.user.id, grapesJsData: grapesJsData || {} }); if (lpData.slug) { const existing = await storage.getLandingPageBySlug(lpData.slug); if (existing) return res.status(409).json({ error: 'Slug já existe.'}); } res.status(201).json(await storage.createLandingPage(lpData)); } catch (error) { next(error); }});
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user.id); if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.'}); res.json({ project: lp.grapesJsData || {} }); } catch (e) { next(e); }});
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const { userId: _, slug, ...lpDataRaw } = req.body; const lpData = schemaShared.insertLandingPageSchema.partial().parse(lpDataRaw); if(slug) { const existing = await storage.getLandingPageBySlug(slug); if(existing && existing.id !== id) return res.status(409).json({error: 'Slug já existe.'}); (lpData as any).slug = slug; } const updated = await storage.updateLandingPage(id, lpData, req.user.id); if(!updated) return res.status(404).json({error: 'LP não encontrada.'}); res.json(updated); } catch (e) { next(e); }});
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const success = await storage.deleteLandingPage(id, req.user.id); if(!success) return res.status(404).json({error: 'LP não encontrada.'}); res.status(200).json({message: 'LP excluída.'});} catch(e){next(e);}});
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req, res, next) => { if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo.' }); const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${SERVER_PORT}`; const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`; res.status(200).json([{ src: publicUrl }]);});
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {const {assets} = req.body; if(!Array.isArray(assets)) return res.status(400).json({error: 'Assets inválidos.'}); assets.forEach(a => { try { if (a && typeof a.src === 'string') { const assetUrl = new URL(a.src); const filename = path.basename(assetUrl.pathname); if (filename.includes("..") || !assetUrl.pathname.includes(`/${UPLOADS_ROOT_DIR}/lp-assets/`)) { console.warn(`[ASSET_DELETE_LP] Tentativa de path traversal ou URL inválida: ${a.src}`); return; } const filePath = path.join(LP_ASSETS_DIR, filename); if(fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if(err) console.error("Erro ao deletar asset:", err)});}} catch(e){ console.error("Erro ao tentar deletar asset de LP:", e);} }); res.status(200).json({message: 'Solicitação processada.'});} catch(e){next(e);}});
  
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req, res, next) => {if (!req.file) return res.status(400).json({ error: 'Nenhum anexo.' }); const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${SERVER_PORT}`; const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}`; res.status(200).json({ url: publicUrl });});
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { 
    try {
      if (!req.user || typeof req.user.id !== 'number') { return res.status(401).json({ error: 'Usuário não autenticado corretamente.' }); }
      const { message: userMessage, sessionId, attachmentUrl } = req.body; const userId = req.user.id;
      if (!userMessage && !attachmentUrl) { return res.status(400).json({ error: "Mensagem ou anexo é obrigatório." }); }
      let currentSession: schemaShared.ChatSession | undefined;
      if (sessionId) { currentSession = await storage.getChatSession(sessionId, userId); }
      if (!currentSession) { currentSession = await storage.createChatSession(userId, `Conversa com IA ${new Date().toLocaleDateString('pt-BR')}`); }
      await storage.addChatMessage({ sessionId: currentSession.id, sender: 'user', text: userMessage || (attachmentUrl ? "Anexo enviado." : ""), attachmentUrl: attachmentUrl || undefined, });
      let agentReplyText: string; let action: string | undefined; let payload: any | undefined;
      if (genAI && userMessage) {
        const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const promptForIntent = `O usuário perguntou: "${userMessage}". Ele está pedindo para navegar para alguma seção da plataforma? Se sim, qual? Responda APENAS com a rota exata (ex: /dashboard, /campaigns). Se não for um pedido de navegação, responda "NÃO".`;
        const intentResult = await intentModel.generateContent(promptForIntent); const intentResponse = intentResult.response.text().trim();
        const validRoutes = [ "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages", "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations" ];
        if (validRoutes.includes(intentResponse)) { agentReplyText = `Claro! Te levarei para ${intentResponse.replace("/", "") || "o Dashboard"}...`; action = "navigate"; payload = intentResponse;
        } else { const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); const messagesFromDb = await storage.getChatMessages(currentSession.id, userId); const historyForGemini = messagesFromDb.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{text: msg.text}] })); const chat = model.startChat({ history: historyForGemini, generationConfig: { maxOutputTokens: 300 }, safetySettings: [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE } ]}); const result = await chat.sendMessage(userMessage || "Processar anexo"); agentReplyText = result.response.text(); }
      } else { agentReplyText = `Recebido: "${userMessage}". IA não disponível.`; }
      await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
      return res.json({ reply: agentReplyText, sessionId: currentSession.id, action, payload });
    } catch (error) { console.error("[MCP_AGENT] Erro no /api/mcp/converse:", error); next(error); }
  });
  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const userId = req.user.id; const { title } = schemaShared.insertChatSessionSchema.partial().parse(req.body); const newSession = await storage.createChatSession(userId, title || 'Nova Conversa'); res.status(201).json(newSession); } catch (error) { next(error); }});
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const userId = req.user.id; res.json(await storage.getChatSessions(userId)); } catch (error) { next(error); }});
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; res.json(await storage.getChatMessages(sessionId, userId)); } catch (error) { next(error); }});
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; const { title } = req.body; if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ error: 'Título inválido.'}); const updated = await storage.updateChatSessionTitle(sessionId, userId, title); if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user.id; const success = await storage.deleteChatSession(sessionId, userId); if (!success) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.status(200).json({ message: 'Sessão excluída.' }); } catch (error) { next(error); }});

  app.get('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const cIdQ = req.query.campaignId as string | undefined; let cId: number | null | undefined; if(cIdQ === 'null' || cIdQ === '') cId=null; else if(cIdQ) {const p = parseInt(cIdQ); if(isNaN(p)) return res.status(400).json({error: 'ID Campanha Inválido'}); cId=p;} res.json(await storage.getFunnels(req.user.id, cId));} catch(e){next(e);}});
  app.post('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const data = schemaShared.insertFunnelSchema.parse({...req.body, userId: req.user.id}); res.status(201).json(await storage.createFunnel(data));} catch(e){next(e);}});
  app.get('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Funil Inválido'}); const f = await storage.getFunnel(id, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); res.json(f); } catch(e){next(e);}});
  app.put('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id))return res.status(400).json({error: 'ID Funil Inválido'}); const {userId, ...updateData} = req.body; const data=schemaShared.insertFunnelSchema.partial().parse(updateData); const f = await storage.updateFunnel(id, data, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); res.json(f);} catch(e){next(e);}});
  app.delete('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Funil Inválido'}); const s = await storage.deleteFunnel(id, req.user.id); if(!s) return res.status(404).json({error: 'Funil não encontrado'}); res.status(200).json({message: 'Funil excluído'});} catch(e){next(e);}});
  app.get('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const fId=parseInt(req.params.funnelId); if(isNaN(fId)) return res.status(400).json({error: 'ID Funil Inválido'}); res.json(await storage.getFunnelStages(fId, req.user.id));} catch(e){next(e);}});
  app.post('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const fId=parseInt(req.params.funnelId); if(isNaN(fId)) return res.status(400).json({error: 'ID Funil Inválido'}); const f = await storage.getFunnel(fId, req.user.id); if(!f) return res.status(404).json({error: 'Funil não encontrado'}); const data = schemaShared.insertFunnelStageSchema.parse({...req.body, funnelId: fId}); res.status(201).json(await storage.createFunnelStage(data));} catch(e){next(e);}});
  app.put('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Etapa Inválido'}); const {funnelId, ...updateData} = req.body; const data=schemaShared.insertFunnelStageSchema.partial().parse(updateData); const s = await storage.updateFunnelStage(id, data, req.user.id); if(!s) return res.status(404).json({error: 'Etapa não encontrada'}); res.json(s);} catch(e){next(e);}});
  app.delete('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id=parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID Etapa Inválido'}); const s = await storage.deleteFunnelStage(id, req.user.id); if(!s) return res.status(404).json({error: 'Etapa não encontrada'}); res.status(200).json({message: 'Etapa excluída'});} catch(e){next(e);}});


  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));

  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
