// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Importar schemas Zod e tipos do shared/schema.ts
import {
  insertUserSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertWhatsappMessageSchema,
  insertCopySchema, // Este é o schema ZOD ATUALIZADO
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertFunnelSchema,
  insertFunnelStageSchema,
  User,
} from "../shared/schema";

// Importar configurações de copy e schemas de IA de client/src/config/copyConfigurations.ts
// O caminho relativo pode precisar de ajuste dependendo da estrutura do seu build.
// Se o `esbuild` não conseguir resolver, você pode precisar de uma estratégia diferente
// para compartilhar essa configuração (ex: um pacote 'shared-config' ou duplicar).
import {
  allCopyPurposesConfig,
  aiResponseSchema, // Usado para a rota de GERAÇÃO DE COPY no backend
} from "../client/src/config/copyConfigurations"; // <--- ATENÇÃO AO CAMINHO

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

const creativesUpload = multer({ /* ... (configuração do multer) ... */ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ /* ... (configuração do multer) ... */ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ /* ... (configuração do multer) ... */ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });

interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (seu middleware de autenticação) ... */ if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() }; return next(); } const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (!token) return res.status(401).json({ error: 'Token não fornecido.' }); try { const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; }; const user = await storage.getUser(decoded.userId); if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' }); req.user = user; next(); } catch (error) { if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' }); if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' }); console.error("[AUTH_MIDDLEWARE] Erro token:", error); return res.status(500).json({ error: 'Erro interno ao verificar token.' }); }};
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (seu handler de erro Zod) ... */ if (err instanceof ZodError) { console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, err.errors); return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))}); } next(err); };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (seu handler de erro geral) ... */ console.error(`[HANDLE_ERROR] Unhandled error for ${req.method} ${req.originalUrl}:`, err.message); if (err.stack) { console.error(err.stack); } if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") { return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}. Verifique o nome do campo esperado.` }); } if (err.message && (err.message.includes("Tipo de arquivo inválido") || err.code === "LIMIT_FILE_SIZE" || err.code === "ENOENT")) { return res.status(400).json({ error: err.message }); } if (err.constructor && err.constructor.name === "GoogleGenerativeAIFetchError") { const generativeError = err as any; const status = generativeError.status || 500; const message = generativeError.message || "Erro ao comunicar com o serviço de IA."; console.error(`[GEMINI_API_ERROR] Status: ${status}, Message: ${message}`, generativeError.errorDetails || generativeError); return res.status(status).json({ error: `Erro na IA: ${message}` }); } const statusCode = err.statusCode || 500; const message = err.message || "Erro interno do servidor."; res.status(statusCode).json({ error: message });};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
  try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log("[GEMINI_MAIN] SDK do Gemini inicializado."); } 
  catch (error) { console.error("[GEMINI_MAIN] Falha ao inicializar SDK Gemini:", error); genAI = null; }
} else { console.warn("[GEMINI_MAIN] GEMINI_API_KEY não configurada ou inválida."); }

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  // ... (outras rotas de campanha)
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  // ... (outras rotas de criativos)
  
  // --- Rota de Geração de Copy AVANÇADA (Backend) ---
  // Se você decidir mover a lógica de chamada à API Gemini para cá,
  // o frontend chamaria este endpoint em vez de chamar a Gemini diretamente.
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
        // @ts-ignore
        prompt = currentPurposeConfig.promptEnhancer(prompt, details, {product, audience, objective, tone});
      }
      
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        generationConfig: { 
            responseMimeType: "application/json", 
            // @ts-ignore
            responseSchema: aiResponseSchema, 
            maxOutputTokens: 2048, 
            temperature: 0.75 
        },
        safetySettings: [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, ],
      });
      
      console.log(`[GEMINI_BACKEND_COPIES_GENERATE] Enviando prompt: ${prompt.substring(0, 250)}...`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log(`[GEMINI_BACKEND_COPIES_GENERATE] Resposta da IA: ${responseText.substring(0,150)}...`);
      
      const generatedData = JSON.parse(responseText);
      res.json([generatedData]);

    } catch (error) {
      console.error('[BACKEND /api/copies/generate] Erro:', error);
      next(error);
    }
  });
  
  // --- ROTAS CRUD para COPIES (ATUALIZADAS) ---
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
      // Assegurar que os campos JSONB default sejam objetos vazios se não vierem do frontend
      dataToValidate.details = dataToValidate.details || {};
      dataToValidate.baseInfo = dataToValidate.baseInfo || {};
      dataToValidate.fullGeneratedResponse = dataToValidate.fullGeneratedResponse || {};
      dataToValidate.tags = dataToValidate.tags || [];
      dataToValidate.isFavorite = dataToValidate.isFavorite === undefined ? false : dataToValidate.isFavorite;


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
        const validatedData = insertCopySchema.partial().omit({ userId: true, id: true, createdAt: true, lastUpdatedAt: true }).parse(dataToValidate);
        
        const updatedCopy = await storage.updateCopy(id, validatedData, req.user!.id);
        if (!updatedCopy) {
            return res.status(404).json({ error: 'Copy não encontrada ou não pertence ao usuário.' });
        }
        res.json(updatedCopy);
    } catch (error) {
        next(error);
    }
  });

  // --- Outras rotas (manter as suas) ---
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // ... (manter suas outras rotas como estão)
  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const contactNumber = req.query.contact as string | undefined; res.json(await storage.getMessages(req.user!.id, contactNumber)); } catch (error) { next(error); }});
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const messageData = insertWhatsappMessageSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createMessage(messageData)); } catch (error) { next(error); }});
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getContacts(req.user!.id)); } catch (error) { next(error); }});
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

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
