// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from "../shared/schema";
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
        console.log(`Diretório criado: ${dir}`);
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

const creativesUpload = multer({ /* ...configuração existente... */ });
const lpAssetUpload = multer({ /* ...configuração existente... */ });
const mcpAttachmentUpload = multer({ /* ...configuração existente... */ });

interface AuthenticatedRequest extends Request {
  user?: schema.User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH] Bypass ativo - criando usuário mock');
    // @ts-ignore
    req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@usbmkt.com' };
    return next();
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; /* ... */ };
    const user = await storage.getUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
    if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
    console.error("[AUTH_MIDDLEWARE] Erro:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, err.errors);
    return res.status(400).json({
      error: "Erro de validação",
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  next(err);
};
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[HANDLE_ERROR] Unhandled error for ${req.method} ${req.originalUrl}:`, err.message);
    if (err.stack && process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
    // ... (outros tratamentos de erro específicos como Multer, Gemini) ...
    if (err instanceof multer.MulterError) { // Exemplo
        return res.status(400).json({ error: `Erro de Upload: ${err.message} (Campo: ${err.field})` });
    }
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erro interno do servidor.';
    res.status(statusCode).json({ error: message, details: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  };


export async function registerRoutes(app: Express): Promise<void> {
  // Não usar app.use(express.json()) ou urlencoded aqui, já estão em server/index.ts
  
  // Router para rotas públicas (autenticação, health-check)
  const publicRouter = express.Router();
  publicRouter.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' });
  });
  publicRouter.post('/auth/register', async (req, res, next) => { /* ...lógica de registro... */ });
  publicRouter.post('/auth/login', async (req, res, next) => { /* ...lógica de login... */ });
  // Rota pública para Landing Pages
  publicRouter.get('/landingpages/slug/:slug', async (req, res, next) => { /* ...lógica de get LP por slug... */ });


  // Router para rotas protegidas da API
  const apiRouter = express.Router();
  apiRouter.use(authenticateToken); // Aplicar autenticação AQUI para todas as rotas em apiRouter

  // Adicionar todas as rotas protegidas ao apiRouter
  apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  apiRouter.get('/creatives', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  apiRouter.get('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/whatsapp/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/whatsapp/contacts', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/copies/generate', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  apiRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/alerts/:id/read', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  apiRouter.get('/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/budgets', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Landing Pages (rotas protegidas)
  apiRouter.get('/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/landingpages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/landingpages/studio-project/:studioProjectId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/landingpages/:id', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Landing Page Assets (protegidas)
  apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // MCP (protegidas)
  apiRouter.post('/mcp/upload-attachment', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.post('/mcp/converse', async (req: AuthenticatedRequest, res, next) => { /* ... */ });

  // Chat Sessions (protegidas)
  apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  
  // Montar os routers no app principal
  app.use('/api', publicRouter); // Rotas públicas sob /api (ex: /api/auth/login)
  app.use('/api', apiRouter);    // Rotas protegidas sob /api (ex: /api/dashboard)

  // Servir arquivos estáticos de uploads (se ainda não configurado globalmente em index.ts)
  // É melhor manter isso em server/index.ts para produção, ANTES do fallback da SPA.
  // Se for manter aqui, garanta que não conflite com o server/index.ts.
  // Por ora, vamos remover daqui e centralizar em server/index.ts
  // app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));

  // Middlewares de tratamento de erro devem ser os últimos no app principal (server/index.ts)
  // app.use(handleZodError);
  // app.use(handleError);

  // Mantenha as implementações das rotas como antes
  // Exemplo de como preencher a rota de registro:
  publicRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = schema.insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ error: 'Usuário com este email já existe.' });
      }
      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({
        user: { id: user.id, username: user.username, email: user.email },
        token
      });
    } catch (error) {
      next(error);
    }
  });
  // Preencha as outras rotas de forma similar...
  // ... (resto das suas definições de rota, adaptadas para usar `apiRouter` ou `publicRouter`)
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const userId = req.user!.id;
      const timeRange = req.query.timeRange as string || '30d';
      const dashboardData = await storage.getDashboardData(userId, timeRange);
      res.json(dashboardData);
    } catch (error) { next(error); }
  });
  
  // Rotas de Campaigns
  apiRouter.get('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      res.json(await storage.getCampaigns(req.user!.id));
    } catch (error) { next(error); }
  });
  apiRouter.post('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const campaignData = schema.insertCampaignSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createCampaign(campaignData));
    } catch (error) { next(error); }
  });
  apiRouter.get('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const campaign = await storage.getCampaign(id, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  apiRouter.put('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const { userId, ...updateData } = req.body;
      const campaignData = schema.insertCampaignSchema.partial().parse(updateData);
      const campaign = await storage.updateCampaign(id, campaignData, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  apiRouter.delete('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const success = await storage.deleteCampaign(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Campanha excluída com sucesso.' });
    } catch (error) { next(error); }
  });

  // ... (Restante das suas rotas CRUD para Creatives, WhatsApp, Copies, Alerts, Budgets, Landing Pages, MCP, Chat Sessions)
  // Lembre-se de adicionar `if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});` no início de cada handler protegido
  // E usar schema.insertCreativeSchema.parse, etc.
    // Creatives
    apiRouter.get('/creatives', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
          if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
          res.json(await storage.getCreatives(req.user!.id, campaignId));
        } catch (error) { next(error); }
      });
    
      apiRouter.post('/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const creativeData = schema.insertCreativeSchema.parse({
            ...req.body,
            userId: req.user!.id,
            fileUrl: req.file ? `/uploads/creatives-assets/${req.file.filename}` : req.body.fileUrl || null,
          });
          const creative = await storage.createCreative(creativeData);
          res.status(201).json(creative);
        } catch (error) {
          if (req.file && error instanceof Error && (error.message.includes('Tipo de arquivo inválido') || (error as any).code === 'LIMIT_FILE_SIZE')) {
             fs.unlink(path.join(CREATIVES_ASSETS_DIR, req.file.filename), (unlinkErr) => {
              if (unlinkErr) console.error("Erro ao deletar arquivo de criativo após falha no POST:", unlinkErr);
            });
          }
          next(error);
        }
      });
    
      apiRouter.put('/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
          const userId = req.user!.id;
    
          const existingCreative = await storage.getCreative(id, userId);
          if (!existingCreative) {
            if (req.file) fs.unlinkSync(req.file.path); 
            return res.status(404).json({ error: 'Criativo não encontrado ou não pertence ao usuário.' });
          }
    
          const { userId: _, ...updateDataRaw } = req.body;
          const updateData = schema.insertCreativeSchema.partial().parse(updateDataRaw);
    
          let newFileUrl: string | null | undefined = undefined; 
    
          if (req.file) {
            newFileUrl = `/uploads/creatives-assets/${req.file.filename}`;
            if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) {
              const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
               if (fs.existsSync(oldFilePath) && oldFilePath.includes(CREATIVES_ASSETS_DIR)) { 
                fs.unlink(oldFilePath, err => {
                  if (err) console.error(`[Creative Update] Erro ao deletar arquivo antigo ${oldFilePath}:`, err);
                });
              }
            }
            updateData.fileUrl = newFileUrl;
          } else if (req.body.fileUrl === "null" || req.body.fileUrl === null) { 
            if (existingCreative.fileUrl) {
                const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
                 if (fs.existsSync(oldFilePath) && oldFilePath.includes(CREATIVES_ASSETS_DIR)) {
                    fs.unlink(oldFilePath, err => {
                      if (err) console.error(`[Creative Update] Erro ao deletar arquivo marcado como null ${oldFilePath}:`, err);
                    });
                }
            }
            updateData.fileUrl = null; 
          }
          
          const updatedCreative = await storage.updateCreative(id, updateData, userId);
          if (!updatedCreative) { 
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Falha ao atualizar o criativo.' });
          }
          res.json(updatedCreative);
        } catch (error) {
          if (req.file) { 
            fs.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr) console.error("Erro ao deletar novo arquivo de criativo após falha no PUT:", unlinkErr);
            });
          }
          next(error);
        }
      });
    
      apiRouter.delete('/creatives/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
    
          const creative = await storage.getCreative(id, req.user!.id); 
          if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' });
    
          const success = await storage.deleteCreative(id, req.user!.id);
          if (!success) return res.status(404).json({ error: 'Criativo não encontrado ou não pode ser excluído.' });
    
          if (creative.fileUrl) {
            const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl);
            if (fs.existsSync(filePath) && filePath.includes(CREATIVES_ASSETS_DIR)) { 
              fs.unlink(filePath, (err) => {
                if (err) console.error(`Erro ao deletar arquivo físico ${filePath} após exclusão do criativo:`, err);
                else console.log(`Arquivo ${filePath} deletado com sucesso.`);
              });
            }
          }
          res.status(200).json({ message: 'Criativo excluído com sucesso.' });
        } catch (error) { next(error); }
      });

    // Landing Page Assets (protegidas, então usam apiRouter)
    apiRouter.post('/assets/lp-upload', lpAssetUpload.single('file'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            }
            const publicUrl = `/uploads/lp-assets/${req.file.filename}`;
            res.status(200).json([{ src: publicUrl }]);
        } catch(error) {
            next(error);
        }
    });
    apiRouter.post('/assets/lp-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
            const { assets } = req.body;
            if (!Array.isArray(assets) || assets.length === 0) return res.status(400).json({ error: 'Nenhum asset para exclusão.' });
            
            assets.forEach(asset => {
                if (asset && typeof asset.src === 'string') {
                    try {
                        const relativePath = asset.src.startsWith('/') ? asset.src.substring(1) : asset.src;
                        if (!relativePath.startsWith(`${UPLOADS_ROOT_DIR}/lp-assets/`)) {
                             return; // Skip
                        }
                        const filePath = path.join(process.cwd(), relativePath);
                        if (fs.existsSync(filePath)) {
                          fs.unlink(filePath, (err) => { /* ... */ });
                        }
                    } catch (e) { /* ... */ }
                }
            });
            res.status(200).json({ message: 'Solicitação de exclusão de assets processada.' });
        } catch (error) {
            next(error);
        }
    });

    // MCP (protegidas)
    apiRouter.post('/mcp/upload-attachment', mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo de anexo enviado.' });
            }
            const attachmentUrl = `/uploads/mcp-attachments/${req.file.filename}`;
            res.status(200).json({ url: attachmentUrl });
        } catch (error) {
            next(error);
        }
    });
    apiRouter.post('/mcp/converse', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
            const { message, sessionId, attachmentUrl } = req.body;
            const userId = req.user!.id;

            // ... (sua lógica completa de /mcp/converse) ...
            // Esta é uma simplificação, cole sua lógica completa aqui.
            let currentSession = sessionId ? await storage.getChatSession(sessionId, userId) : await storage.createChatSession(userId);
            if (!currentSession) { // Se a sessão não pôde ser encontrada ou criada
                return res.status(500).json({ error: "Não foi possível obter ou criar uma sessão de chat."});
            }
            await storage.addChatMessage({sessionId: currentSession.id, sender: 'user', text: message || 'Anexo', attachmentUrl});

            if (genAI && message) {
                // Simulação de navegação
                if (message.toLowerCase().includes("dashboard")) {
                    await storage.addChatMessage({sessionId: currentSession.id, sender: 'agent', text: "Levando para o Dashboard..."});
                    return res.json({ reply: "Levando para o Dashboard...", action: "navigate", payload: "/dashboard", sessionId: currentSession.id });
                }
                // Resposta Gemini
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                const result = await model.generateContent(message);
                const agentReplyText = result.response.text();
                await storage.addChatMessage({sessionId: currentSession.id, sender: 'agent', text: agentReplyText});
                return res.json({ reply: agentReplyText, sessionId: currentSession.id });
            } else {
                const replyText = attachmentUrl ? "Anexo recebido." : "Não entendi.";
                await storage.addChatMessage({sessionId: currentSession.id, sender: 'agent', text: replyText});
                return res.json({ reply: replyText, sessionId: currentSession.id });
            }

        } catch (error) {
          console.error('[MCP_AGENT] Erro detalhado no endpoint /api/mcp/converse:', error);
          next(error);
        }
      });

    // Chat Sessions (protegidas)
    apiRouter.post('/chat/sessions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const userId = req.user!.id;
          const { title } = schema.insertChatSessionSchema.partial().parse(req.body);
          const newSession = await storage.createChatSession(userId, title || 'Nova Conversa');
          res.status(201).json(newSession);
        } catch (error) { next(error); }
      });
    apiRouter.get('/chat/sessions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          res.json(await storage.getChatSessions(req.user!.id));
        }
        catch (error) { next(error); }
      });
    apiRouter.get('/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const sessionId = parseInt(req.params.sessionId);
          if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
          res.json(await storage.getChatMessages(sessionId, req.user!.id));
        } catch (error) { next(error); }
      });
    apiRouter.put('/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const sessionId = parseInt(req.params.sessionId);
          if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
          const { title } = req.body;
          if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: 'Novo título inválido.' });
          }
          const updatedSession = await storage.updateChatSessionTitle(sessionId, req.user!.id, title);
          if (!updatedSession) return res.status(404).json({ error: 'Sessão não encontrada ou não pertence ao usuário.' });
          res.json(updatedSession);
        } catch (error) { next(error); }
      });
    apiRouter.delete('/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
          const sessionId = parseInt(req.params.sessionId);
          if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
          const success = await storage.deleteChatSession(sessionId, req.user!.id);
          if (!success) return res.status(404).json({ error: 'Sessão não encontrada ou não pode ser excluída.' });
          res.status(200).json({ message: 'Sessão de chat excluída com sucesso.' });
        } catch (error) { next(error); }
      });
}
