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
  insertCopySchema, // Usar o schema atualizado de shared/schema.ts
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertFunnelSchema,
  insertFunnelStageSchema,
  User,
  allCopyPurposesConfig, // Importar para usar na rota /api/copies/generate se mover a lógica para cá
  aiResponseSchema, // Importar para usar na rota /api/copies/generate se mover a lógica para cá
} from "../shared/schema"; // Assumindo que allCopyPurposesConfig e aiResponseSchema estão em shared/schema.ts
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });

interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() }; return next(); } const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (!token) return res.status(401).json({ error: 'Token não fornecido.' }); try { const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; }; const user = await storage.getUser(decoded.userId); if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' }); req.user = user; next(); } catch (error) { if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' }); if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' }); console.error("[AUTH_MIDDLEWARE] Erro token:", error); return res.status(500).json({ error: 'Erro interno ao verificar token.' }); }};
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { if (err instanceof ZodError) { console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, err.errors); return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))}); } next(err); };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { console.error(`[HANDLE_ERROR] Unhandled error for ${req.method} ${req.originalUrl}:`, err.message); if (err.stack) { console.error(err.stack); } if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") { return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}. Verifique o nome do campo esperado.` }); } if (err.message && (err.message.includes("Tipo de arquivo inválido") || err.code === "LIMIT_FILE_SIZE" || err.code === "ENOENT")) { return res.status(400).json({ error: err.message }); } if (err.constructor && err.constructor.name === "GoogleGenerativeAIFetchError") { const generativeError = err as any; const status = generativeError.status || 500; const message = generativeError.message || "Erro ao comunicar com o serviço de IA."; console.error(`[GEMINI_API_ERROR] Status: ${status}, Message: ${message}`, generativeError.errorDetails || generativeError); return res.status(status).json({ error: `Erro na IA: ${message}` }); } const statusCode = err.statusCode || 500; const message = err.message || "Erro interno do servidor."; res.status(statusCode).json({ error: message });};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
  try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log("[GEMINI_MAIN] SDK do Gemini inicializado."); } 
  catch (error) { console.error("[GEMINI_MAIN] Falha ao inicializar SDK Gemini:", error); genAI = null; }
} else { console.warn("[GEMINI_MAIN] GEMINI_API_KEY não configurada ou inválida."); }

async function doRegisterRoutes(app: Express): Promise<HttpServer> { // Renomeado para doRegisterRoutes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { try { const userData = insertUserSchema.parse(req.body); const existingUser = await storage.getUserByEmail(userData.email); if (existingUser) { return res.status(409).json({ error: 'Usuário com este email já existe.' }); } const user = await storage.createUser(userData); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); const user = await storage.getUserByEmail(email); if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' }); const isValidPassword = await storage.validatePassword(password, user.password); if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' }); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN ||'7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getDashboardData(req.user!.id, req.query.timeRange as string || '30d')); } catch (error) { next(error); }});
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getCampaigns(req.user!.id)); } catch (error) { next(error); }});
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignData = insertCampaignSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createCampaign(campaignData)); } catch (error) { next(error); }});
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const campaign = await storage.getCampaign(id, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.json(campaign); } catch (error) { next(error); }});
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const { userId, ...updateData } = req.body; const campaignData = insertCampaignSchema.partial().parse(updateData); const campaign = await storage.updateCampaign(id, campaignData, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' }); res.json(campaign); } catch (error) { next(error); }});
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const success = await storage.deleteCampaign(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' }); res.status(200).json({ message: 'Campanha excluída com sucesso.' }); } catch (error) { next(error); }});
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignIdQuery = req.query.campaignId as string | undefined; const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined); if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); res.json(await storage.getCreatives(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const creativeData = insertCreativeSchema.parse({ ...req.body, userId: req.user!.id, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null }); res.status(201).json(await storage.createCreative(creativeData)); } catch (error) { next(error); }});
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' }); const creative = await storage.getCreative(id, req.user!.id); if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' }); const success = await storage.deleteCreative(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Criativo não encontrado ou não pode ser excluído.' }); if (creative.fileUrl) { const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl); if (fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if (err) console.error(`Erro ao deletar arquivo ${filePath}:`, err);});} res.status(200).json({ message: 'Criativo excluído com sucesso.' }); } catch (error) { next(error); }});
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' }); const userId = req.user!.id; const existingCreative = await storage.getCreative(id, userId); if (!existingCreative) return res.status(404).json({ error: 'Criativo não encontrado.' }); const { userId: _, ...updateDataRaw } = req.body; const updateData = insertCreativeSchema.partial().parse(updateDataRaw); let newFileUrl: string | null | undefined = existingCreative.fileUrl; if (req.file) { newFileUrl = `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`; if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) { const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl); if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo antigo:", err);}); } } else if (req.body.fileUrl === "null" || req.body.fileUrl === null) { newFileUrl = null; if (existingCreative.fileUrl) { const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl); if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (err) => { if (err) console.error("Erro ao deletar arquivo existente:", err);}); } } updateData.fileUrl = newFileUrl; const updatedCreative = await storage.updateCreative(id, updateData, userId); if (!updatedCreative) return res.status(404).json({ error: 'Criativo não atualizado.' }); res.json(updatedCreative); } catch (error) { next(error); }});
  
  // Rota de Geração de Copy AVANÇADA (Backend)
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { product, audience, objective, tone, copyPurposeKey, details, launchPhase } = req.body;

      if (!genAI) {
        return res.status(503).json({ error: "Serviço de IA não está configurado ou indisponível." });
      }
      if (!product || !audience || !copyPurposeKey || !details || !launchPhase) {
        return res.status(400).json({ error: "Informações insuficientes para gerar a copy." });
      }

      const currentPurposeConfig = allCopyPurposesConfig.find(p => p.key === copyPurposeKey);
      if (!currentPurposeConfig) {
        return res.status(400).json({ error: "Finalidade da copy desconhecida." });
      }

      const launchPhaseLabel = 
        launchPhase === 'pre_launch' ? 'Pré-Lançamento' :
        launchPhase === 'launch' ? 'Lançamento' :
        launchPhase === 'post_launch' ? 'Pós-Lançamento' : 'Fase Desconhecida';

      let prompt = `Contexto da IA: Você é um Copywriter Mestre, especialista em criar textos persuasivos e altamente eficazes para lançamentos digitais no mercado brasileiro. Sua linguagem deve ser adaptada ao tom solicitado.
---
INFORMAÇÕES BASE PARA ESTA COPY:
- Produto/Serviço Principal: "${product}"
- Público-Alvo Principal: "${audience}"
- Objetivo Geral da Campanha: "${objective}"
- Tom da Mensagem Desejado: "${tone}"
- Fase Atual do Lançamento: "${launchPhaseLabel}"
---
FINALIDADE ESPECÍFICA DESTA COPY:
- Nome da Finalidade: "${currentPurposeConfig.label}"
- Categoria: "${currentPurposeConfig.category}"
${currentPurposeConfig.description ? `- Descrição da Finalidade: "${currentPurposeConfig.description}"\n` : ''}---
DETALHES ESPECÍFICOS FORNECIDOS PARA ESTA FINALIDADE:
${Object.entries(details).map(([key, value]) => {
  const fieldConfig = currentPurposeConfig.fields.find(f => f.name === key);
  return `- ${fieldConfig?.label || key}: ${value || '(Não informado)'}`;
}).join('\n')}
---
TAREFA:
Com base em TODAS as informações acima, gere os seguintes textos para a finalidade "${currentPurposeConfig.label}".
Responda OBRIGATORIAMENTE em formato JSON VÁLIDO, seguindo o schema abaixo.
Observações importantes para sua geração:
- Incorpore os "Detalhes Específicos" de forma inteligente e natural na "mainCopy".
- Se um detalhe crucial não foi informado, use seu conhecimento para criar a melhor copy possível.
- Seja direto, claro e use gatilhos mentais apropriados.
- Para anúncios, pense em limite de caracteres.
- Para e-mails, estruture com parágrafos curtos e CTA claro.`;

      if (currentPurposeConfig.promptEnhancer) {
        // @ts-ignore TODO: Ajustar tipo de BaseGeneratorFormState se importado de config
        prompt = currentPurposeConfig.promptEnhancer(prompt, details, {product, audience, objective, tone});
      }
      
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        generationConfig: { 
            responseMimeType: "application/json", 
            // @ts-ignore
            responseSchema: aiResponseSchema, 
            maxOutputTokens: 2048, // Aumentado
            temperature: 0.75 
        },
        safetySettings: [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, ],
      });
      
      console.log(`[GEMINI_BACKEND_COPIES_GENERATE] Enviando prompt: ${prompt.substring(0, 250)}...`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log(`[GEMINI_BACKEND_COPIES_GENERATE] Resposta da IA: ${responseText.substring(0,150)}...`);
      
      const generatedData = JSON.parse(responseText);
      res.json([generatedData]); // Enviar como array para o frontend

    } catch (error) {
      console.error('[BACKEND /api/copies/generate] Erro:', error);
      next(error);
    }
  });
  
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignIdQuery = req.query.campaignId as string | undefined;
      const phase = req.query.phase as string | undefined;
      const purpose = req.query.purpose as string | undefined;
      const searchTerm = req.query.search as string | undefined;

      const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' || campaignIdQuery === undefined 
        ? undefined 
        : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined);
      
      if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && (campaignId === undefined || isNaN(campaignId))) {
        return res.status(400).json({ error: 'ID da campanha inválido para filtro.' });
      }
      
      const userCopies = await storage.getCopies(req.user!.id, campaignId, phase, purpose, searchTerm);
      res.json(userCopies);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = {
        ...req.body,
        userId: req.user!.id,
      };
      const validatedData = insertCopySchema.parse(dataToValidate);
      const newCopy = await storage.createCopy(validatedData);
      res.status(201).json(newCopy);
    } catch (error) {
      next(error); 
    }
  });
  
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' });
      const success = await storage.deleteCopy(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Copy não encontrada ou não pertence ao usuário.' });
      res.status(200).json({ message: 'Copy excluída com sucesso.' });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' });
        const dataToValidate = { ...req.body };
        // Omitir userId, id, createdAt do payload de update, pois não devem ser alterados pelo cliente ou são gerenciados pelo DB
        const validatedData = insertCopySchema.partial().omit({ userId: true, id: true, createdAt: true }).parse(dataToValidate);
        
        const updatedCopy = await storage.updateCopy(id, validatedData, req.user!.id);
        if (!updatedCopy) {
            return res.status(404).json({ error: 'Copy não encontrada ou não pertence ao usuário.' });
        }
        res.json(updatedCopy);
    } catch (error) {
        next(error);
    }
  });

  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const onlyUnread = req.query.unread === 'true'; res.json(await storage.getAlerts(req.user!.id, onlyUnread)); } catch (error) { next(error); }});
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' }); const success = await storage.markAlertAsRead(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Alerta não encontrado.' }); res.json({ success: true, message: 'Alerta lido.' }); } catch (error) { next(error); }});
  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const campaignIdQuery = req.query.campaignId as string | undefined; const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined); if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); res.json(await storage.getBudgets(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const budgetData = insertBudgetSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createBudget(budgetData)); } catch (error) { next(error); }});
  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getLandingPages(req.user!.id)); } catch (error) { next(error); }});
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const { grapesJsData, ...otherData } = req.body; const lpData = insertLandingPageSchema.parse({ ...otherData, userId: req.user!.id, grapesJsData: grapesJsData || {} }); if (lpData.slug) { const existing = await storage.getLandingPageBySlug(lpData.slug); if (existing) return res.status(409).json({ error: 'Slug já existe.'}); } res.status(201).json(await storage.createLandingPage(lpData)); } catch (error) { next(error); }});
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const lp = await storage.getLandingPageByStudioProjectId(req.params.studioProjectId, req.user!.id); if (!lp) return res.status(404).json({ error: 'Projeto não encontrado.'}); res.json({ project: lp.grapesJsData || {} }); } catch (e) { next(e); }});
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const { userId: _, slug, ...lpDataRaw } = req.body; const lpData = insertLandingPageSchema.partial().parse(lpDataRaw); if(slug) { const existing = await storage.getLandingPageBySlug(slug); if(existing && existing.id !== id) return res.status(409).json({error: 'Slug já existe.'}); (lpData as any).slug = slug; } const updated = await storage.updateLandingPage(id, lpData, req.user!.id); if(!updated) return res.status(404).json({error: 'LP não encontrada.'}); res.json(updated); } catch (e) { next(e); }});
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {const id = parseInt(req.params.id); if(isNaN(id)) return res.status(400).json({error: 'ID inválido.'}); const success = await storage.deleteLandingPage(id, req.user!.id); if(!success) return res.status(404).json({error: 'LP não encontrada.'}); res.status(200).json({message: 'LP excluída.'});} catch(e){next(e);}});
  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req, res, next) => { if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo.' }); const relativeUrl = `/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`; res.status(200).json([{ src: relativeUrl }]);});
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res, next) => { try {const {assets} = req.body; if(!Array.isArray(assets)) return res.status(400).json({error: 'Assets inválidos.'}); assets.forEach(a => { try { const assetPath = a.src.startsWith('/') ? a.src.substring(1) : a.src; if (assetPath.startsWith(`${UPLOADS_ROOT_DIR}/lp-assets/`)) { const filename = path.basename(assetPath); const fp = path.join(LP_ASSETS_DIR, filename); if(fs.existsSync(fp)) fs.unlink(fp, ()=>{});}} catch(e){ console.error("Erro ao tentar deletar asset de LP:", e);} }); res.status(200).json({message: 'Solicitação processada.'});} catch(e){next(e);}});
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req, res, next) => {if (!req.file) return res.status(400).json({ error: 'Nenhum anexo.' }); const relativeUrl = `/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}`; res.status(200).json({ url: relativeUrl });});
  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; const { title } = insertChatSessionSchema.partial().parse(req.body); const newSession = await storage.createChatSession(userId, title || 'Nova Conversa'); res.status(201).json(newSession); } catch (error) { next(error); }});
  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; res.json(await storage.getChatSessions(userId)); } catch (error) { next(error); }});
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; res.json(await storage.getChatMessages(sessionId, userId)); } catch (error) { next(error); }});
  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; const { title } = req.body; if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ error: 'Título inválido.'}); const updated = await storage.updateChatSessionTitle(sessionId, userId, title); if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const sessionId = parseInt(req.params.sessionId); if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' }); const userId = req.user!.id; const success = await storage.deleteChatSession(sessionId, userId); if (!success) return res.status(404).json({ error: 'Sessão não encontrada.'}); res.status(200).json({ message: 'Sessão excluída.' }); } catch (error) { next(error); }});
  app.get('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignIdQuery = req.query.campaignId as string | undefined; const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined); if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && isNaN(campaignId!)) { return res.status(400).json({ error: 'ID da campanha inválido para filtro de funis.' }); } res.json(await storage.getFunnels(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const funnelData = insertFunnelSchema.parse({ ...req.body, userId: req.user!.id }); const newFunnel = await storage.createFunnel(funnelData); res.status(201).json(newFunnel); } catch (error) { next(error); }});
  app.get('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do funil inválido.' }); const funnel = await storage.getFunnel(id, req.user!.id); if (!funnel) return res.status(404).json({ error: 'Funil não encontrado.' }); res.json(funnel); } catch (error) { next(error); }});
  app.put('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do funil inválido.' }); const { userId, ...updateData } = req.body; const funnelData = insertFunnelSchema.partial().parse(updateData); const updatedFunnel = await storage.updateFunnel(id, funnelData, req.user!.id); if (!updatedFunnel) return res.status(404).json({ error: 'Funil não encontrado ou não pertence ao usuário.' }); res.json(updatedFunnel); } catch (error) { next(error); }});
  app.delete('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID do funil inválido.' }); const success = await storage.deleteFunnel(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Funil não encontrado ou não pode ser excluído.' }); res.status(200).json({ message: 'Funil excluído com sucesso.' }); } catch (error) { next(error); }});
  app.get('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const funnelId = parseInt(req.params.funnelId); if (isNaN(funnelId)) return res.status(400).json({ error: 'ID do funil inválido.' }); const stages = await storage.getFunnelStages(funnelId, req.user!.id); res.json(stages); } catch (error) { next(error); }});
  app.post('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const funnelId = parseInt(req.params.funnelId); if (isNaN(funnelId)) return res.status(400).json({ error: 'ID do funil inválido.' }); const funnel = await storage.getFunnel(funnelId, req.user!.id); if (!funnel) return res.status(404).json({ error: 'Funil não encontrado ou não pertence ao usuário.' }); const stageData = insertFunnelStageSchema.parse({ ...req.body, funnelId }); const newStage = await storage.createFunnelStage(stageData); res.status(201).json(newStage); } catch (error) { next(error); }});
  app.put('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da etapa inválido.' }); const { funnelId, ...updateData } = req.body; const stageData = insertFunnelStageSchema.partial().parse(updateData); const updatedStage = await storage.updateFunnelStage(id, stageData, req.user!.id); if (!updatedStage) return res.status(404).json({ error: 'Etapa do funil não encontrada ou não pertence ao usuário.' }); res.json(updatedStage); } catch (error) { next(error); }});
  app.delete('/api/stages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da etapa inválido.' }); const success = await storage.deleteFunnelStage(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Etapa do funil não encontrada ou não pode ser excluída.' }); res.status(200).json({ message: 'Etapa do funil excluída com sucesso.' }); } catch (error) { next(error); }});

  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

// Correção para o erro de build: exportar a função como parte de um objeto
export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
