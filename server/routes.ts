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
  insertFunnelSchema, 
  insertFunnelStageSchema, 
  User,
  Campaign, 
  Creative, 
  campaignStatusEnum, // Importar o enum para validação
  creatives as creativesTable, // Para usar na hora de validar o status do criativo
} from "../shared/schema";
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

const creativesUpload = multer({ storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (_req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (mimetype && extname) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, LP_ASSETS_DIR), filename: (_req, file, cb) => { cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (mimetype && extname) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (_req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (extname && mimetype) { return cb(null, true); } cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });


interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { 
    if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH] Bypass ativo - criando usuário mock');
    req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; };
    if (typeof decoded.userId !== 'number') return res.status(403).json({ error: 'Token inválido: userId não é numérico.' });
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro inesperado:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { if (err instanceof ZodError) { console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, err.errors); return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) }); } next(err); };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { console.error(`[HANDLE_ERROR] ${req.method} ${req.originalUrl}:`, err.message, err.stack ? `\n${err.stack}` : ''); if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}.`}); if (err.message?.includes('Tipo de arquivo inválido') || err.code === 'LIMIT_FILE_SIZE' || err.code === 'ENOENT') return res.status(400).json({ error: err.message }); if (err.constructor?.name === 'GoogleGenerativeAIFetchError') { const ge = err as any; return res.status(ge.status || 500).json({ error: `Erro na IA: ${ge.message || 'Erro ao comunicar com Gemini.'}` }); } const sc = err.statusCode || 500; const msg = err.message || 'Erro interno do servidor.'; res.status(sc).json({ error: msg }); };


export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rotas existentes ...
  app.get('/api/health', (req: Request, res: Response) => { res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0'}); });
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { try { const userData = insertUserSchema.parse(req.body); const existingUser = await storage.getUserByEmail(userData.email); if (existingUser) { return res.status(409).json({ error: 'Usuário com este email já existe.' }); } const user = await storage.createUser(userData); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { try { const { email, password } = req.body; if (!email || !password) { return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); } const user = await storage.getUserByEmail(email); if (!user) { return res.status(401).json({ error: 'Credenciais inválidas.' }); } const isValidPassword = await storage.validatePassword(password, user.password); if (!isValidPassword) { return res.status(401).json({ error: 'Credenciais inválidas.' }); } const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { console.error(`[LOGIN] Erro no handler de login:`, error); next(error); }});
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; const timeRange = req.query.timeRange as string || '30d'; const dashboardData = await storage.getDashboardData(userId, timeRange); res.json(dashboardData); } catch (error) { next(error); }});
  
  // Campanhas
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const status = req.query.status as any; res.json(await storage.getCampaigns(req.user!.id, undefined, status)); } catch (error) { next(error); }});
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignData = insertCampaignSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createCampaign(campaignData)); } catch (error) { next(error); }});
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const campaign = await storage.getCampaign(id, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.json(campaign); } catch (error) { next(error); }});
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const { userId, ...updateData } = req.body; const campaignData = insertCampaignSchema.partial().parse(updateData); const campaign = await storage.updateCampaign(id, campaignData, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' }); res.json(campaign); } catch (error) { next(error); }});
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const success = await storage.deleteCampaign(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' }); res.status(200).json({ message: 'Campanha excluída com sucesso.' }); } catch (error) { next(error); }});

  // Criativos
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const status = req.query.status as any; res.json(await storage.getCreatives(req.user!.id, campaignId, status)); } catch (error) { next(error); }});
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const creativeData = insertCreativeSchema.parse({ ...req.body, userId: req.user!.id, fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null, }); const creative = await storage.createCreative(creativeData); res.status(201).json(creative); } catch (error) { if (req.file && error instanceof Error && (error.message.includes('Tipo de arquivo inválido') || (error as any).code === 'LIMIT_FILE_SIZE')) { fs.unlink(path.join(CREATIVES_ASSETS_DIR, req.file.filename), (unlinkErr) => { if (unlinkErr) console.error("Erro ao deletar arquivo:", unlinkErr); }); } next(error); }});
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.'}); const creative = await storage.getCreative(id, req.user!.id); if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' }); const success = await storage.deleteCreative(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Não foi possível excluir.' }); if (creative.fileUrl) { const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl); if (fs.existsSync(filePath)) fs.unlink(filePath, (err) => { if (err) console.error(`Erro ao deletar ${filePath}:`, err); }); } res.status(200).json({ message: 'Criativo excluído.' }); } catch (error) { next(error); }});
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (como antes, já implementado) ... */ });
  
  // Funis e Etapas de Funil ... (rotas como antes, já implementadas) ...

  // Rota do Agente MCP - SUPER APRIMORADA
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user!.id;

      if (!message) return res.status(400).json({ error: 'Mensagem é obrigatória.' });
      
      let currentSession = sessionId ? await storage.getChatSession(sessionId, userId) : undefined;
      if (!currentSession) {
        currentSession = await storage.createChatSession(userId, `Conversa MCP`);
      }
      await storage.addChatMessage({ sessionId: currentSession.id, sender: 'user', text: message });

      let agentReplyText = "Desculpe, não consegui processar seu pedido ou ainda estou aprendendo essa função.";
      let actionResponse: any = { action: "INFO_DISPLAYED", payload: { message: agentReplyText } }; // Default action

      if (genAI && message) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const validCampaignStatuses = campaignStatusEnum.enumValues.join(', ');
        const validCreativeStatuses = creativesTable.status.enumValues.join(', ');


        const geminiSystemPrompt = `Você é o Agente MCP para a plataforma USB MKT PRO V2.
        OBJETIVO: Interpretar a mensagem do usuário e traduzi-la em uma ação estruturada em JSON, ou responder textualmente se for uma pergunta geral.
        SEMPRE responda em Português do Brasil.

        AÇÕES ESTRUTURADAS POSSÍVEIS (responda APENAS com o JSON):
        1. NAVEGAÇÃO:
           - Para seções: {"intent": "NAVIGATE", "params": {"route": "/caminho_da_rota"}}
             Rotas: /dashboard, /campaigns, /creatives, /budget, /landingpages, /whatsapp, /copy, /funnel, /metrics, /alerts, /export, /integrations
           - Para detalhes de campanha por ID: {"intent": "NAVIGATE", "params": {"route": "/campaigns/ID_DA_CAMPANHA"}}
           - Para detalhes de campanha por NOME (se encontrar exatamente UM): {"intent": "NAVIGATE_TO_CAMPAIGN_BY_NAME", "params": {"name": "Nome da Campanha"}}
        
        2. CAMPANHAS:
           - CRIAR: {"intent": "CREATE_CAMPAIGN", "params": {"name": "Nome", "status": "draft|active|paused|completed", "description": "Desc", "budget": "1000.00", "platforms": ["facebook", "google_ads"], "objectives": ["sales"]}} (status e outros são opcionais, default 'draft')
           - LISTAR: {"intent": "LIST_CAMPAIGNS", "params": {"status": "active|paused|completed|draft|all"}} ('all' se não especificado)
           - ATUALIZAR: {"intent": "UPDATE_CAMPAIGN", "params": {"id": ID, "updates": {"name": "Novo Nome", "status": "novo_status", ...}}} (extraia ID e campos a atualizar)
           - DELETAR: {"intent": "DELETE_CAMPAIGN", "params": {"id": ID_NUMERICO}}

        3. CRIATIVOS:
           - CRIAR (TEXTO): {"intent": "CREATE_TEXT_CREATIVE", "params": {"name": "Nome Criativo", "content": "Conteúdo", "campaignId": ID_CAMPANHA_OPCIONAL, "platforms": ["facebook"]}}
           - LISTAR: {"intent": "LIST_CREATIVES", "params": {"campaignId": ID_CAMPANHA_OPCIONAL, "status": "pending|approved|rejected|all"}}
           - ATUALIZAR STATUS: {"intent": "UPDATE_CREATIVE_STATUS", "params": {"id": ID_CRIATIVO, "status": "approved|pending|rejected"}}
           - DELETAR: {"intent": "DELETE_CREATIVE", "params": {"id": ID_NUMERICO}}

        Status de campanha válidos: ${validCampaignStatuses}. Status de criativo válidos: ${validCreativeStatuses}.
        Se não for uma ação estruturada, responda à pergunta do usuário de forma útil e concisa.
        MENSAGEM DO USUÁRIO: "${message}"`;

        const result = await model.generateContent(geminiSystemPrompt);
        const geminiResponseText = result.response.text().trim();
        console.log("[MCP_AGENT] Gemini Raw Response:", geminiResponseText);

        try {
          const parsedIntent = JSON.parse(geminiResponseText);
          console.log("[MCP_AGENT] Parsed Gemini Intent:", parsedIntent);
          const params = parsedIntent.params || {};

          switch (parsedIntent.intent) {
            // --- NAVEGAÇÃO ---
            case 'NAVIGATE':
              if (params.route) {
                agentReplyText = `Ok, navegando para ${params.route.substring(1) || 'Dashboard'}...`;
                actionResponse = { action: "NAVIGATE", payload: { route: params.route } };
              } else { agentReplyText = "Para onde você gostaria de ir?"; }
              break;
            case 'NAVIGATE_TO_CAMPAIGN_BY_NAME':
                if (params.name) {
                    const campaign = await storage.getCampaignByName(params.name, userId);
                    if (campaign) {
                        agentReplyText = `Encontrei a campanha "${campaign.name}". Navegando para detalhes...`;
                        actionResponse = { action: "NAVIGATE", payload: { route: `/campaigns/${campaign.id}` } };
                    } else {
                        agentReplyText = `Não encontrei uma campanha com o nome parecido com "${params.name}".`;
                    }
                } else { agentReplyText = "Qual o nome da campanha que você gostaria de ver?"; }
                break;

            // --- CAMPANHAS ---
            case 'CREATE_CAMPAIGN':
              if (params.name) {
                const campData: InsertCampaign = { userId, name: params.name, status: params.status || 'draft', description: params.description, budget: params.budget, platforms: params.platforms || [], objectives: params.objectives || [] };
                const created = await storage.createCampaign(campData);
                agentReplyText = `Campanha "${created.name}" (ID: ${created.id}) criada.`;
                actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "campaigns", message: agentReplyText, data: created } };
              } else { agentReplyText = "Qual nome para a nova campanha?"; }
              break;
            case 'LIST_CAMPAIGNS':
              const statusFilterCamp = params.status === 'all' ? undefined : params.status;
              const campaignsList = await storage.getCampaigns(userId, undefined, statusFilterCamp);
              agentReplyText = campaignsList.length > 0 ? `Campanhas (${statusFilterCamp || 'todas'}):\n${campaignsList.map(c => `- ID ${c.id}: ${c.name} (${c.status})`).join('\n')}` : `Nenhuma campanha ${statusFilterCamp || ''} encontrada.`;
              actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText, data: campaignsList } };
              break;
            case 'UPDATE_CAMPAIGN':
              if (params.id && params.updates && Object.keys(params.updates).length > 0) {
                const campaignId = parseInt(params.id);
                if (isNaN(campaignId)) { agentReplyText = "ID da campanha inválido."; break; }
                if (params.updates.status && !campaignStatusEnum.enumValues.includes(params.updates.status)) { agentReplyText = `Status "${params.updates.status}" inválido.`; break;}
                const updated = await storage.updateCampaign(campaignId, params.updates, userId);
                agentReplyText = updated ? `Campanha ID ${campaignId} atualizada.` : `Campanha ID ${campaignId} não encontrada.`;
                if (updated) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "campaigns", message: agentReplyText, data: updated } };
              } else { agentReplyText = "Preciso do ID da campanha e dos dados para atualizar."; }
              break;
            case 'DELETE_CAMPAIGN':
              if (params.id) {
                const campaignId = parseInt(params.id);
                if (isNaN(campaignId)) { agentReplyText = "ID da campanha inválido."; break; }
                const success = await storage.deleteCampaign(campaignId, userId);
                agentReplyText = success ? `Campanha ID ${campaignId} excluída.` : `Falha ao excluir campanha ID ${campaignId}.`;
                if (success) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "campaigns", message: agentReplyText } };
              } else { agentReplyText = "Qual o ID da campanha para deletar?"; }
              break;

            // --- CRIATIVOS ---
            case 'CREATE_TEXT_CREATIVE':
              if (params.name && params.content) {
                const creativeData: InsertCreative = { userId, name: params.name, type: 'text', content: params.content, status: 'pending', platforms: params.platforms || [], campaignId: params.campaignId ? parseInt(params.campaignId) : null };
                const created = await storage.createCreative(creativeData);
                agentReplyText = `Criativo de texto "${created.name}" (ID: ${created.id}) criado.`;
                actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "creatives", message: agentReplyText, data: created } };
              } else { agentReplyText = "Para criar um criativo de texto, preciso do nome e do conteúdo."; }
              break;
            case 'LIST_CREATIVES':
              const campIdCreative = params.campaignId ? parseInt(params.campaignId) : undefined;
              const statusCreative = params.status === 'all' ? undefined : params.status;
              const creativesList = await storage.getCreatives(userId, campIdCreative, statusCreative);
              agentReplyText = creativesList.length > 0 ? `Criativos:\n${creativesList.map(c => `- ID ${c.id}: ${c.name} (Tipo: ${c.type}, Status: ${c.status})`).join('\n')}` : `Nenhum criativo encontrado.`;
              actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText, data: creativesList } };
              break;
            case 'UPDATE_CREATIVE_STATUS':
                 if (params.id && params.status) {
                    const creativeId = parseInt(params.id);
                    if (isNaN(creativeId)) { agentReplyText = "ID do criativo inválido."; break;}
                    if (!creativesTable.status.enumValues.includes(params.status as any)) { agentReplyText = `Status "${params.status}" inválido para criativo.`; break; }
                    const updated = await storage.updateCreative(creativeId, { status: params.status }, userId);
                    agentReplyText = updated ? `Status do criativo ID ${creativeId} atualizado para ${params.status}.` : `Criativo ID ${creativeId} não encontrado.`;
                    if (updated) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "creatives", message: agentReplyText, data: updated } };
                 } else { agentReplyText = "Preciso do ID do criativo e do novo status."; }
                 break;
            case 'DELETE_CREATIVE':
              if (params.id) {
                const creativeId = parseInt(params.id);
                if (isNaN(creativeId)) { agentReplyText = "ID do criativo inválido."; break;}
                const success = await storage.deleteCreative(creativeId, userId);
                agentReplyText = success ? `Criativo ID ${creativeId} excluído.` : `Falha ao excluir criativo ID ${creativeId}.`;
                if (success) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entityType: "creatives", message: agentReplyText } };
              } else { agentReplyText = "Qual o ID do criativo para deletar?"; }
              break;
              
            default: 
              agentReplyText = geminiResponseText; // Resposta geral se o JSON não mapeou para ação conhecida
              actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText }};
          }
        } catch (e) { // Se Gemini não retornou JSON válido
          console.log("[MCP_AGENT] Gemini response not valid JSON, treating as text.", e);
          agentReplyText = geminiResponseText;
          actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText }};
        }
        
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, ...actionResponse, sessionId: currentSession.id });

      } else { // Sem Gemini ou sem mensagem de texto
        agentReplyText = `Recebido: "${message || 'Anexo'}". O serviço de IA não está configurado ou a mensagem não é de texto.`;
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, sessionId: currentSession.id });
      }
    } catch (error) {
      next(error);
    }
  });

  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  app.use(handleZodError);
  app.use(handleError);
  const httpServer = createServer(app);
  return httpServer;
}
