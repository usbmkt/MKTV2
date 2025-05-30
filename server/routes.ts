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
  Creative, // Adicionado para checagem de tipo
  campaignStatusEnum, // Importar o enum para validação
  // LandingPage, // Já existe
  // ChatMessage, // Já existe
  // ChatSession // Já existe
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

// Multer configs (creativesUpload, lpAssetUpload, mcpAttachmentUpload)... (como antes)
const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (mimetype && extname) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (mimetype && extname) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); const mimetype = allowedTypes.test(file.mimetype); if (extname && mimetype) { return cb(null, true); } cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });


interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (como antes) ... */ };
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (como antes) ... */ };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (como antes) ... */ };


export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rotas existentes (Auth, Dashboard, Campanhas, Criativos, etc.) ... (como antes) ...
  app.get('/api/health', (req: Request, res: Response) => { res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0'}); });
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { try { const userData = insertUserSchema.parse(req.body); const existingUser = await storage.getUserByEmail(userData.email); if (existingUser) { return res.status(409).json({ error: 'Usuário com este email já existe.' }); } const user = await storage.createUser(userData); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { try { const { email, password } = req.body; if (!email || !password) { return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); } const user = await storage.getUserByEmail(email); if (!user) { return res.status(401).json({ error: 'Credenciais inválidas.' }); } const isValidPassword = await storage.validatePassword(password, user.password); if (!isValidPassword) { return res.status(401).json({ error: 'Credenciais inválidas.' }); } const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { console.error(`[LOGIN] Erro no handler de login:`, error); next(error); }});
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const userId = req.user!.id; const timeRange = req.query.timeRange as string || '30d'; const dashboardData = await storage.getDashboardData(userId, timeRange); res.json(dashboardData); } catch (error) { next(error); }});
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const status = req.query.status as any; res.json(await storage.getCampaigns(req.user!.id, undefined, status)); } catch (error) { next(error); }});
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignData = insertCampaignSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createCampaign(campaignData)); } catch (error) { next(error); }});
  app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const campaign = await storage.getCampaign(id, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' }); res.json(campaign); } catch (error) { next(error); }});
  app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const { userId, ...updateData } = req.body; const campaignData = insertCampaignSchema.partial().parse(updateData); const campaign = await storage.updateCampaign(id, campaignData, req.user!.id); if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' }); res.json(campaign); } catch (error) { next(error); }});
  app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const success = await storage.deleteCampaign(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' }); res.status(200).json({ message: 'Campanha excluída com sucesso.' }); } catch (error) { next(error); }});
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined; if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); const status = req.query.status as any; res.json(await storage.getCreatives(req.user!.id, campaignId, status)); } catch (error) { next(error); }});
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (como antes) ... */ });
  app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (como antes) ... */ });
  app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (como antes) ... */ });
  app.get('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getFunnels(req.user!.id)); } catch (error) { next(error); }});
  app.post('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = insertFunnelSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createFunnel(data)); } catch (error) { next(error); }});
  app.get('/api/funnels/:funnelId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.funnelId); if (isNaN(id)) return res.status(400).json({error: 'ID Inválido'}); const funnel = await storage.getFunnelWithStages(id, req.user!.id); if (!funnel) return res.status(404).json({ error: 'Funil não encontrado' }); res.json(funnel); } catch (error) { next(error); }});
  app.put('/api/funnels/:funnelId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.funnelId); if (isNaN(id)) return res.status(400).json({error: 'ID Inválido'}); const data = insertFunnelSchema.partial().parse(req.body); const updated = await storage.updateFunnel(id, data, req.user!.id); if (!updated) return res.status(404).json({ error: 'Funil não encontrado' }); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/funnels/:funnelId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.funnelId); if (isNaN(id)) return res.status(400).json({error: 'ID Inválido'}); const success = await storage.deleteFunnel(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Funil não encontrado' }); res.status(200).json({ message: 'Funil excluído.' }); } catch (error) { next(error); }});
  app.post('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const funnelId = parseInt(req.params.funnelId); if (isNaN(funnelId)) return res.status(400).json({error: 'ID Inválido'}); const data = insertFunnelStageSchema.parse({ ...req.body, funnelId }); const stage = await storage.createFunnelStage(data, req.user!.id); if(!stage) return res.status(400).json({error: 'Erro ao criar etapa'}); res.status(201).json(stage); } catch (error) { next(error); }});
  app.put('/api/funnels/:funnelId/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const stageId = parseInt(req.params.stageId); if (isNaN(stageId)) return res.status(400).json({error: 'ID Inválido'}); const data = insertFunnelStageSchema.partial().parse(req.body); const updated = await storage.updateFunnelStage(stageId, data, req.user!.id); if (!updated) return res.status(404).json({ error: 'Etapa não encontrada' }); res.json(updated); } catch (error) { next(error); }});
  app.delete('/api/funnels/:funnelId/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const stageId = parseInt(req.params.stageId); if (isNaN(stageId)) return res.status(400).json({error: 'ID Inválido'}); const success = await storage.deleteFunnelStage(stageId, req.user!.id); if (!success) return res.status(404).json({ error: 'Etapa não encontrada' }); res.status(200).json({ message: 'Etapa excluída.'}); } catch (error) { next(error); }});


  // Rota do Agente MCP - APRIMORADA
  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = req.body; // attachmentUrl removido por simplicidade nesta etapa de autonomia
      const userId = req.user!.id;

      if (!message) return res.status(400).json({ error: 'Mensagem é obrigatória.' });
      
      let currentSession = sessionId ? await storage.getChatSession(sessionId, userId) : undefined;
      if (!currentSession) {
        currentSession = await storage.createChatSession(userId, `Conversa Iniciada`);
      }
      await storage.addChatMessage({ sessionId: currentSession.id, sender: 'user', text: message });

      let agentReplyText = "Desculpe, não entendi o comando ou ainda não aprendi a fazer isso.";
      let actionResponse: any = { action: null, payload: null };

      if (genAI && message) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const geminiSystemPrompt = `Você é o Agente MCP, um assistente para a plataforma USB MKT PRO V2.
        Seu objetivo é ajudar o usuário a navegar e gerenciar campanhas e criativos.
        Responda sempre em Português do Brasil.
        
        Ações possíveis (priorize estas se a intenção for clara):
        1. NAVEGAÇÃO: Se o usuário pedir para ir a uma seção (dashboard, campaigns, creatives, budget, landingpages, whatsapp, copy, funnel, metrics, alerts, export, integrations), responda com JSON: 
           {"intent": "NAVIGATE", "params": {"route": "/caminho_da_rota"}}
           Se pedir detalhes de uma campanha por ID (ex: "ver campanha 10"), use a rota /campaigns/:id.

        2. CRIAR CAMPANHA: Se pedir para criar uma campanha E fornecer um nome. Status padrão é 'draft'.
           Responda com JSON: {"intent": "CREATE_CAMPAIGN", "params": {"name": "Nome Da Campanha", "status": "draft", "description": "Opcional", "budget": "OpcionalNumérico"}}
           Exemplo: "crie uma campanha chamada Super Promoção" -> {"intent": "CREATE_CAMPAIGN", "params": {"name": "Super Promoção", "status": "draft"}}

        3. LISTAR CAMPANHAS: Se pedir para listar campanhas, opcionalmente com status.
           Responda com JSON: {"intent": "LIST_CAMPAIGNS", "params": {"status": "active" | "paused" | "completed" | "draft" | "all"}} (all se não especificado)
           Exemplo: "liste minhas campanhas ativas" -> {"intent": "LIST_CAMPAIGNS", "params": {"status": "active"}}

        4. ATUALIZAR CAMPANHA: Se pedir para atualizar uma campanha por ID e fornecer os campos a mudar (nome, status, orçamento).
           Responda com JSON: {"intent": "UPDATE_CAMPAIGN", "params": {"id": ID_DA_CAMPANHA, "updates": {"name": "Novo Nome", "status": "novo_status", "budget": "NovoOrçamento"}}}
           Exemplo: "atualize o status da campanha 15 para pausado" -> {"intent": "UPDATE_CAMPAIGN", "params": {"id": 15, "updates": {"status": "paused"}}}

        5. DELETAR CAMPANHA: Se pedir para deletar uma campanha E fornecer um ID numérico.
           Responda com JSON: {"intent": "DELETE_CAMPAIGN", "params": {"id": NUMERO_DO_ID}}
           Exemplo: "delete a campanha 42" -> {"intent": "DELETE_CAMPAIGN", "params": {"id": 42}}

        6. CRIAR CRIATIVO (TEXTO): Se pedir para criar um criativo de TEXTO, com nome e conteúdo, opcionalmente associado a uma campanha por ID.
           Responda com JSON: {"intent": "CREATE_TEXT_CREATIVE", "params": {"name": "Nome Criativo", "content": "Conteúdo do Texto", "campaignId": ID_CAMPANHA_OPCIONAL}}
           Exemplo: "crie um criativo de texto para a campanha 7 chamado CTA Principal com texto 'Compre agora!'" -> {"intent": "CREATE_TEXT_CREATIVE", "params": {"name": "CTA Principal", "content": "Compre agora!", "campaignId": 7}}
        
        7. LISTAR CRIATIVOS: Se pedir para listar criativos, opcionalmente de uma campanha (por ID ou nome) ou por status.
           Responda com JSON: {"intent": "LIST_CREATIVES", "params": {"campaignId": ID_CAMPANHA, "status": "pending" | "approved" | "rejected" | "all"}}
           Exemplo: "liste os criativos aprovados da campanha 10" -> {"intent": "LIST_CREATIVES", "params": {"campaignId": 10, "status": "approved"}}
           
        8. DELETAR CRIATIVO: Se pedir para deletar um criativo E fornecer um ID numérico.
           Responda com JSON: {"intent": "DELETE_CREATIVE", "params": {"id": NUMERO_DO_ID}}

        Analise a mensagem do usuário: "${message}"
        Responda APENAS com o JSON para ações estruturadas. Se não for uma ação estruturada, responda normalmente à pergunta.`;

        const geminiResult = await model.generateContent(geminiSystemPrompt);
        const geminiResponseText = geminiResult.response.text().trim();
        
        console.log("[MCP_AGENT] Gemini Raw Response:", geminiResponseText);

        try {
          const parsedIntent = JSON.parse(geminiResponseText);
          console.log("[MCP_AGENT] Parsed Gemini Intent:", parsedIntent);

          switch (parsedIntent.intent) {
            case 'NAVIGATE':
              if (parsedIntent.params?.route) {
                agentReplyText = `Ok, navegando para ${parsedIntent.params.route}...`;
                actionResponse = { action: "NAVIGATE", payload: { route: parsedIntent.params.route } };
              } else { agentReplyText = "Para onde você gostaria de navegar?"; }
              break;
            
            case 'CREATE_CAMPAIGN':
              if (parsedIntent.params?.name) {
                const campData: InsertCampaign = {
                  userId,
                  name: parsedIntent.params.name,
                  status: parsedIntent.params.status || 'draft',
                  description: parsedIntent.params.description || '',
                  platforms: parsedIntent.params.platforms || [],
                  objectives: parsedIntent.params.objectives || [],
                  budget: parsedIntent.params.budget || null,
                };
                const created = await storage.createCampaign(campData);
                agentReplyText = `Campanha "${created.name}" (ID: ${created.id}) criada com status '${created.status}'.`;
                actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entity: "campaigns", message: agentReplyText } };
              } else { agentReplyText = "Qual nome você gostaria de dar para a nova campanha?"; }
              break;

            case 'LIST_CAMPAIGNS':
              const campaignsList = await storage.getCampaigns(userId, undefined, parsedIntent.params?.status !== 'all' ? parsedIntent.params?.status : undefined);
              if (campaignsList.length > 0) {
                agentReplyText = `Encontrei ${campaignsList.length} campanha(s)${parsedIntent.params?.status !== 'all' ? ' com status ' + parsedIntent.params?.status : ''}:\n` +
                                 campaignsList.map(c => `- ${c.name} (ID: ${c.id}, Status: ${c.status})`).join('\n');
              } else {
                agentReplyText = `Nenhuma campanha encontrada${parsedIntent.params?.status !== 'all' ? ' com status ' + parsedIntent.params?.status : ''}.`;
              }
              actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText } };
              break;

            case 'UPDATE_CAMPAIGN':
              if (parsedIntent.params?.id && parsedIntent.params?.updates) {
                const campaignId = parseInt(parsedIntent.params.id);
                const updates = parsedIntent.params.updates;
                // Validar status se presente
                if (updates.status && !campaignStatusEnum.enumValues.includes(updates.status)) {
                    agentReplyText = `Status "${updates.status}" inválido. Válidos: ${campaignStatusEnum.enumValues.join(', ')}.`;
                    break;
                }
                const updated = await storage.updateCampaign(campaignId, updates, userId);
                if (updated) {
                  agentReplyText = `Campanha ID ${campaignId} atualizada.`;
                  actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entity: "campaigns", message: agentReplyText } };
                } else { agentReplyText = `Campanha ID ${campaignId} não encontrada ou não pôde ser atualizada.`; }
              } else { agentReplyText = "Preciso do ID da campanha e dos dados para atualizar."; }
              break;

            case 'DELETE_CAMPAIGN':
              if (parsedIntent.params?.id) {
                const campaignId = parseInt(parsedIntent.params.id);
                const success = await storage.deleteCampaign(campaignId, userId);
                agentReplyText = success ? `Campanha ID ${campaignId} excluída.` : `Falha ao excluir campanha ID ${campaignId}.`;
                if (success) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entity: "campaigns", message: agentReplyText } };
              } else { agentReplyText = "Qual o ID da campanha para deletar?"; }
              break;

            case 'CREATE_TEXT_CREATIVE':
              if (parsedIntent.params?.name && parsedIntent.params?.content) {
                const creativeData: InsertCreative = {
                  userId,
                  name: parsedIntent.params.name,
                  type: 'text',
                  content: parsedIntent.params.content,
                  status: 'pending',
                  platforms: parsedIntent.params.platforms || [],
                  campaignId: parsedIntent.params.campaignId ? parseInt(parsedIntent.params.campaignId) : null,
                };
                const created = await storage.createCreative(creativeData);
                agentReplyText = `Criativo de texto "${created.name}" (ID: ${created.id}) criado.`;
                actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entity: "creatives", message: agentReplyText } };
              } else { agentReplyText = "Para criar um criativo de texto, preciso do nome e do conteúdo."; }
              break;
            
            case 'LIST_CREATIVES':
              const campIdForCreativeList = parsedIntent.params?.campaignId ? parseInt(parsedIntent.params.campaignId) : undefined;
              const creativeStatusFilter = parsedIntent.params?.status !== 'all' ? parsedIntent.params?.status : undefined;
              const creativesList = await storage.getCreatives(userId, campIdForCreativeList, creativeStatusFilter);
              if (creativesList.length > 0) {
                agentReplyText = `Encontrei ${creativesList.length} criativo(s):\n` +
                                 creativesList.map(c => `- ${c.name} (ID: ${c.id}, Tipo: ${c.type}, Status: ${c.status})`).join('\n');
              } else {
                agentReplyText = `Nenhum criativo encontrado com esses critérios.`;
              }
              actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText } };
              break;

            case 'DELETE_CREATIVE':
              if (parsedIntent.params?.id) {
                const creativeId = parseInt(parsedIntent.params.id);
                const success = await storage.deleteCreative(creativeId, userId);
                agentReplyText = success ? `Criativo ID ${creativeId} excluído.` : `Falha ao excluir criativo ID ${creativeId}.`;
                if (success) actionResponse = { action: "ACTION_SUCCESS_REFRESH_DATA", payload: { entity: "creatives", message: agentReplyText } };
              } else { agentReplyText = "Qual o ID do criativo para deletar?"; }
              break;
              
            default: // Gemini retornou JSON, mas com intent desconhecido
              agentReplyText = geminiResponseText; // Ou uma mensagem "Não entendi a ação estruturada."
          }
        } catch (e) { // Se Gemini não retornou JSON válido, tratar como resposta de texto.
          console.log("[MCP_AGENT] Gemini response was not valid JSON, treating as text reply.");
          agentReplyText = geminiResponseText;
           actionResponse = { action: "INFO_DISPLAYED", payload: { message: agentReplyText } };
        }
        
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, ...actionResponse, sessionId: currentSession.id });

      } else { // Sem Gemini ou sem mensagem de texto para IA
        agentReplyText = `Recebido: "${message || 'Anexo'}". O serviço de IA não está disponível ou a mensagem não pôde ser processada para ações complexas.`;
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
