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
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';
import { handleMCPConversation } from './mcp_handler';

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
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { if (err instanceof ZodError) { return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))}); } next(err); };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { console.error(`[HANDLE_ERROR] ${req.method} ${req.originalUrl}:`, err.message, err.stack ? err.stack.substring(0, 300) : ''); if (err instanceof multer.MulterError) return res.status(400).json({ error: `Erro no upload: ${err.message}`}); if (err.message?.includes('Tipo de arquivo inválido')) return res.status(400).json({ error: err.message }); if (err.constructor?.name === 'GoogleGenerativeAIFetchError') return res.status((err as any).status || 500).json({ error: `Erro na IA: ${(err as any).message}` }); res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno do servidor.' });};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[GEMINI_MAIN] SDK do Gemini inicializado com sucesso para uso geral (Copies, MCP).");
  } catch (error) {
    console.error("[GEMINI_MAIN] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI_MAIN] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou inválida. Funcionalidades de IA estarão desabilitadas ou limitadas.");
}

export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));

  // Rotas de Autenticação, Dashboard, Campanhas, Criativos (mantidas como no seu arquivo)
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

  // Rota de Geração de Copy AVANÇADA
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { product, audience, objective, tone, copyPurpose, details } = req.body;

      if (!genAI) {
        return res.status(503).json({ error: "Serviço de IA não está configurado ou indisponível." });
      }
      if (!product || !audience || !copyPurpose || !details) {
        return res.status(400).json({ error: "Informações insuficientes para gerar a copy. Produto, público, finalidade e detalhes da finalidade são obrigatórios." });
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        generationConfig: {
            maxOutputTokens: 1024, // Aumentado para permitir mais detalhes
            temperature: 0.75, // Um pouco mais criativo
        }
      });

      let prompt = `Você é um especialista em copywriting para marketing digital.
      Informações Gerais:
      - Produto/Serviço Principal da Marca: "${product}"
      - Público-Alvo Geral da Marca: "${audience}"
      - Objetivo Geral da Marca (pode ser sobreposto pelo objetivo da copy): "${objective}"
      - Tom de Voz Geral da Marca: "${tone}"

      A finalidade específica desta copy é: "${copyPurpose}".
      Detalhes específicos para esta finalidade:
      `;

      for (const key in details) {
        if (Object.prototype.hasOwnProperty.call(details, key) && details[key]) {
          prompt += `- ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: "${details[key]}"\n`; // Formata camelCase para Título de Caso
        }
      }

      let instruction = "";
      let expectedOutputs = 1; // Quantas variações completas esperamos
      let outputFormatDetails = "Forneça a copy completa e bem formatada.";

      switch (copyPurpose) {
        case 'anuncio_evento_gratuito':
          instruction = `Gere uma copy completa para um anúncio de evento online gratuito (como Facebook ou Instagram Ads). Inclua um headline chamativo, um corpo de texto que destaque a promessa e benefícios, e um call-to-action claro. Use o tom de voz especificado. Máximo de 3 parágrafos para o corpo.`;
          outputFormatDetails = `Estruture a resposta com "Headline:", "Corpo do Anúncio:", e "CTA:".`;
          expectedOutputs = 2; // Gerar 2 variações
          break;
        case 'email_boas_vindas':
          instruction = `Escreva o corpo completo de um e-mail de boas-vindas e confirmação de inscrição. O e-mail deve ser amigável, confirmar o motivo da inscrição, entregar qualquer item prometido (link/informação), sugerir próximos passos e usar o nome do remetente.`;
          outputFormatDetails = `Forneça o e-mail completo, começando com uma saudação e terminando com uma despedida e assinatura.`;
          break;
        case 'anuncio_download_material':
          instruction = `Crie uma copy persuasiva para um anúncio (ex: Facebook, LinkedIn) incentivando o download de um material rico. Destaque o principal benefício e o que o usuário encontrará no material. Inclua um headline, um corpo de texto e um call-to-action. Adapte para ser curto e direto.`;
          outputFormatDetails = `Estruture a resposta com "Headline:", "Corpo do Anúncio:", e "CTA:".`;
          expectedOutputs = 2;
          break;
        // ADICIONE MAIS CASES AQUI PARA CADA 'copyPurpose' DEFINIDO NO FRONTEND
        // Exemplo:
        // case 'post_curiosidade_antecipacao':
        //   instruction = `Crie um post para redes sociais (Instagram/Facebook) que gere curiosidade e antecipação sobre "${product}" para "${audience}". Use o tom "${tone}". Inclua uma pergunta ou gancho para engajamento.`;
        //   outputFormatDetails = `Forneça o texto completo do post.`;
        //   break;
        default:
          instruction = `Crie uma copy de marketing digital persuasiva com base nas informações fornecidas.`;
      }

      prompt += `\nInstrução Específica: ${instruction}\nFormato Esperado da Resposta: ${outputFormatDetails}`;
      
      const generatedResults = [];
      for (let i = 0; i < expectedOutputs; i++) {
        try {
            console.log(`[GEMINI_COPIES_GENERATE] Enviando prompt (tentativa ${i+1}/${expectedOutputs}): ${prompt.substring(0, 200)}...`);
            const result = await model.generateContent(prompt + (expectedOutputs > 1 ? `\nPor favor, gere uma variação ${i+1} desta copy.` : ''));
            const responseText = result.response.text().trim();
            console.log(`[GEMINI_COPIES_GENERATE] Resposta da IA (tentativa ${i+1}): ${responseText.substring(0,100)}...`);
            
            // Tentar extrair partes se o formato foi solicitado
            if ((copyPurpose === 'anuncio_evento_gratuito' || copyPurpose === 'anuncio_download_material') && expectedOutputs > 1) {
                const headlineMatch = responseText.match(/Headline:([\s\S]*?)(Corpo do Anúncio:|CTA:|$)/i);
                const bodyMatch = responseText.match(/Corpo do Anúncio:([\s\S]*?)(CTA:|$)/i);
                const ctaMatch = responseText.match(/CTA:([\s\S]*)/i);

                generatedResults.push({ type: 'headline', content: headlineMatch ? headlineMatch[1].trim() : `Headline Variação ${i+1}`, platform: 'geral', purpose: copyPurpose });
                generatedResults.push({ type: 'body', content: bodyMatch ? bodyMatch[1].trim() : (headlineMatch ? `Corpo para ${headlineMatch[1].trim()}` : `Corpo Variação ${i+1}`), platform: 'geral', purpose: copyPurpose });
                generatedResults.push({ type: 'cta', content: ctaMatch ? ctaMatch[1].trim() : `CTA Variação ${i+1}`, platform: 'geral', purpose: copyPurpose });
            } else {
                 generatedResults.push({ type: copyPurpose, content: responseText, platform: 'geral', purpose: copyPurpose });
            }

        } catch (generationError) {
            console.error(`[GEMINI_COPIES_GENERATE] Erro na tentativa ${i+1} de geração:`, generationError);
            generatedResults.push({ type: 'error_generation', content: `Falha ao gerar variação ${i+1}.`, platform: 'sistema', purpose: copyPurpose });
        }
      }

      if (generatedResults.length === 0) {
        generatedCopies.push({ type: 'fallback', content: 'Não foi possível gerar a copy com os detalhes fornecidos. Tente ajustar os inputs ou a finalidade.', platform: 'sistema', purpose: copyPurpose });
      } else {
        generatedCopies = generatedResults;
      }

      res.json(generatedCopies);

    } catch (error) {
      console.error('[COPIES_GENERATE_ADVANCED] Erro geral no endpoint:', error);
      next(error);
    }
  });
  
  // Rotas de CRUD de Copies, Alerts, Budgets, Landing Pages, Assets, MCP, Chat Sessions, Funnels (mantidas como no seu arquivo)
  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const contactNumber = req.query.contact as string | undefined; res.json(await storage.getMessages(req.user!.id, contactNumber)); } catch (error) { next(error); }});
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const messageData = insertWhatsappMessageSchema.parse({ ...req.body, userId: req.user!.id }); res.status(201).json(await storage.createMessage(messageData)); } catch (error) { next(error); }});
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await storage.getContacts(req.user!.id)); } catch (error) { next(error); }});
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const campaignIdQuery = req.query.campaignId as string | undefined; const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' ? null : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined); if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' }); res.json(await storage.getCopies(req.user!.id, campaignId)); } catch (error) { next(error); }});
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const copyData = insertCopySchema.parse({ ...req.body, userId: req.user!.id, campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : null }); res.status(201).json(await storage.createCopy(copyData)); } catch (error) { next(error); }});
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' }); const success = await storage.deleteCopy(id, req.user!.id); if (!success) return res.status(404).json({ error: 'Copy não encontrada.' }); res.status(200).json({ message: 'Copy excluída.' }); } catch (error) { next(error); }});
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
