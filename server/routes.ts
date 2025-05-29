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
  LandingPage,
  ChatMessage,
  ChatSession
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');

// Garantir que os diretórios de upload existam
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
  console.warn("[GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada. O Agente MCP terá funcionalidade limitada de IA.");
}

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
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para criativos.'));
  },
});

const lpAssetUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase());
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.'));
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para anexos do MCP.'));
  },
});

interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Bypass de autenticação para desenvolvimento/teste
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH] Bypass ativo - criando usuário mock');
    req.user = {
      id: 1,
      username: 'admin',
      email: 'admin@usbmkt.com',
      password: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
    if (typeof decoded.userId !== 'number') {
        return res.status(403).json({ error: 'Token inválido: userId não é numérico.' });
    }
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expirado.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
        return res.status(403).json({ error: 'Token inválido.' });
    }
    console.error("[AUTH_MIDDLEWARE] Erro inesperado na autenticação do token:", error);
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
  if (err.stack) {
    console.error(err.stack);
  }

  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}. Verifique o nome do campo esperado.`});
  }
  if (err.message && (err.message.includes('Tipo de arquivo inválido') || err.code === 'LIMIT_FILE_SIZE' || err.code === 'ENOENT')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.constructor && err.constructor.name === 'GoogleGenerativeAIFetchError') {
     const generativeError = err as any;
     const status = generativeError.status || 500;
     const message = generativeError.message || 'Erro ao comunicar com o serviço de IA.';
     console.error(`[GEMINI_API_ERROR] Status: ${status}, Message: ${message}`, generativeError.errorDetails || generativeError);
     return res.status(status).json({ error: `Erro na IA: ${message}` });
  }


  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor.';
  res.status(statusCode).json({ error: message });
};


export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint for Render
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'MKTV5',
      version: '1.0.0'
    });
  });

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = insertUserSchema.parse(req.body);
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

  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }
      const isValidPassword = await storage.validatePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({
        user: { id: user.id, username: user.username, email: user.email },
        token
      });
    } catch (error) {
      console.error(`[LOGIN] Erro no handler de login:`, error);
      next(error);
    }
  });

  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const timeRange = req.query.timeRange as string || '30d';
      const dashboardData = await storage.getDashboardData(userId, timeRange);
      res.json(dashboardData);
    } catch (error) { next(error); }
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
      // Remover a lógica de parseamento manual de campaignId daqui
      const creativeData = insertCreativeSchema.parse({
        ...req.body,
        userId: req.user!.id,
        fileUrl: req.file ? `/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}` : req.body.fileUrl || null,
      });
      const creative = await storage.createCreative(creativeData);
      res.status(201).json(creative);
    } catch (error) {
      if (req.file && error instanceof Error && (error.message.includes('Tipo de arquivo inválido') || (error as any).code === 'LIMIT_FILE_SIZE')) {
         fs.unlink(path.join(CREATIVES_ASSETS_DIR, req.file.filename), (unlinkErr) => {
          if (unlinkErr) console.error("Erro ao deletar arquivo de criativo após falha:", unlinkErr);
        });
      }
      next(error);
    }
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
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Erro ao deletar arquivo físico ${filePath}:`, err);
          });
        }
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
      if (!existingCreative) {
        return res.status(404).json({ error: 'Criativo não encontrado ou não pertence ao usuário.' });
      }

      // Remover a lógica de parseamento manual de campaignId daqui
      const { userId: _, ...updateDataRaw } = req.body;
      const updateData = insertCreativeSchema.partial().parse(updateDataRaw); // O Zod agora lida com campaignId

      let newFileUrl: string | null | undefined = undefined;
      const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

      if (req.file) {
        newFileUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/creatives-assets/${req.file.filename}`;
        if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) {
          try {
            const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`[CREATIVE_UPDATE] Old file deleted: ${oldFilePath}`);
            }
          } catch (unlinkErr) {
            console.error(`[CREATIVE_UPDATE] Error deleting old file ${existingCreative.fileUrl}:`, unlinkErr);
          }
        }
      } else if (req.body.fileUrl === "null" && existingCreative.fileUrl) {
          try {
            const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`[CREATIVE_UPDATE] Existing file removed: ${oldFilePath}`);
            }
          } catch (unlinkErr) {
            console.error(`[CREATIVE_UPDATE] Error deleting existing file ${existingCreative.fileUrl}:`, unlinkErr);
          }
          newFileUrl = null;
      } else {
        newFileUrl = existingCreative.fileUrl;
      }

      if (newFileUrl !== undefined) {
        updateData.fileUrl = newFileUrl;
      }

      // campaignId já é tratado pelo Zod schema

      const updatedCreative = await storage.updateCreative(id, updateData, userId);
      if (!updatedCreative) {
        return res.status(404).json({ error: 'Criativo não encontrado ou não pertence ao usuário.' });
      }
      res.json(updatedCreative);
    } catch (error) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Erro ao deletar novo arquivo de criativo após falha:", unlinkErr);
        });
      }
      next(error);
    }
  });


  app.get('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const contactNumber = req.query.contact as string | undefined;
      res.json(await storage.getMessages(req.user!.id, contactNumber));
    } catch (error) { next(error); }
  });
  app.post('/api/whatsapp/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const messageData = insertWhatsappMessageSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createMessage(messageData));
    } catch (error) { next(error); }
  });
  app.get('/api/whatsapp/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json(await storage.getContacts(req.user!.id)); } catch (error) { next(error); }
  });

  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getCopies(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const copyData = insertCopySchema.parse({ ...req.body, userId: req.user!.id, campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : null });
      res.status(201).json(await storage.createCopy(copyData));
    } catch (error) { next(error); }
  });
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' });
      const success = await storage.deleteCopy(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Copy não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Copy excluída com sucesso.' });
    } catch (error) { next(error); }
  });
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { product, audience, objective, tone } = req.body;
      if (!product || !audience || !objective || !tone) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
      }

      if (!genAI) {
        return res.status(500).json({ error: "Serviço de IA não disponível." });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      
      const prompts = [
        {
          type: 'headline',
          platform: 'Facebook',
          prompt: `Crie um headline persuasivo para Facebook sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 60 caracteres. Seja direto e impactante.`
        },
        {
          type: 'cta',
          platform: 'Google',
          prompt: `Crie um call-to-action (CTA) convincente para Google Ads sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 30 palavras.`
        },
        {
          type: 'description',
          platform: 'Instagram',
          prompt: `Crie uma descrição persuasiva para Instagram sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 125 caracteres.`
        }
      ];

      const generatedCopies = [];
      
      for (const promptData of prompts) {
        try {
          const result = await model.generateContent(promptData.prompt);
          const content = result.response.text().trim();
          
          generatedCopies.push({
            type: promptData.type,
            content: content,
            platform: promptData.platform
          });
        } catch (error) {
          console.error(`[GEMINI] Erro ao gerar ${promptData.type}:`, error);
          // Fallback para conteúdo padrão em caso de erro
          generatedCopies.push({
            type: promptData.type,
            content: `${promptData.type === 'headline' ? '🚀' : promptData.type === 'cta' ? 'Clique aqui e descubra como' : 'Solução perfeita para'} ${audience} ${promptData.type === 'headline' ? 'com nossa solução inovadora para' : promptData.type === 'cta' ? 'estão revolucionando seus resultados com' : 'que buscam'} ${objective.toLowerCase()}${promptData.type === 'headline' ? '!' : promptData.type === 'cta' ? '!' : '. Com nosso'} ${promptData.type !== 'headline' ? product + (promptData.type === 'description' ? ', você alcança resultados extraordinários em tempo recorde.' : '!') : product + '!'}`,
            platform: promptData.platform
          });
        }
      }

      res.json(generatedCopies);
    } catch (error) { 
      console.error('[COPIES] Erro na geração:', error);
      next(error); 
    }
  });

  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const onlyUnread = req.query.unread === 'true';
      res.json(await storage.getAlerts(req.user!.id, onlyUnread));
    } catch (error) { next(error); }
  });
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' });
      const success = await storage.markAlertAsRead(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Alerta não encontrado ou já lido.' });
      res.json({ success: true, message: 'Alerta marcado como lido.' });
    } catch (error) { next(error); }
  });

  app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getBudgets(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });
  app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const budgetData = insertBudgetSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createBudget(budgetData));
    } catch (error) { next(error); }
  });

  app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json(await storage.getLandingPages(req.user!.id)); } catch (error) { next(error); }
  });
  app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { grapesJsData, ...otherData } = req.body;
      const lpData = insertLandingPageSchema.parse({ ...otherData, userId: req.user!.id, grapesJsData: grapesJsData || {} });
      if (lpData.slug) {
        const existingSlug = await storage.getLandingPageBySlug(lpData.slug);
        if (existingSlug) return res.status(409).json({ error: 'Este slug já está em uso.'});
      }
      res.status(201).json(await storage.createLandingPage(lpData));
    } catch (error) { next(error); }
  });
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { studioProjectId } = req.params;
      const landingPage = await storage.getLandingPageByStudioProjectId(studioProjectId, req.user!.id);
      if (!landingPage) return res.status(404).json({ error: 'Projeto de Landing Page não encontrado.' });
      res.json({ project: landingPage.grapesJsData || {} });
    }
    catch (error) { next(error); }
  });
  app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da Landing Page inválido.' });
      const { userId: _, slug, grapesJsData, ...otherData } = req.body;
      const lpDataToValidate = { ...otherData, grapesJsData: grapesJsData || {} };
      const lpData = insertLandingPageSchema.partial().parse(lpDataToValidate);
      if (slug) {
        const existingSlugPage = await storage.getLandingPageBySlug(slug);
        if (existingSlugPage && existingSlugPage.id !== id) return res.status(409).json({ error: 'Este slug já está em uso.' });
        (lpData as any).slug = slug;
      }
      const updatedLandingPage = await storage.updateLandingPage(id, lpData, req.user!.id);
      if (!updatedLandingPage) return res.status(404).json({ error: 'Landing Page não encontrada.' });
      res.json(updatedLandingPage);
    } catch (error) { next(error); }
  });
  app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da Landing Page inválido.' });
      const success = await storage.deleteLandingPage(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Landing Page não encontrada.' });
      res.status(200).json({ message: 'Landing Page excluída com sucesso.' });
    } catch (error) { next(error); }
  });

  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        console.log('[ASSET_UPLOAD_LP] Nenhum arquivo recebido.');
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      const publicUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/lp-assets/${req.file.filename}`;
      console.log(`[ASSET_UPLOAD_LP] Arquivo: ${req.file.originalname}, Salvo como: ${req.file.filename}, Campo: ${req.file.fieldname}, URL Pública: ${publicUrl}`);
      res.status(200).json([{ src: publicUrl }]);
    } catch(error) {
      console.error('[ASSET_UPLOAD_LP] Erro no handler:', error);
      next(error);
    }
  });

  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { assets } = req.body;
      if (!Array.isArray(assets) || assets.length === 0) return res.status(400).json({ error: 'Nenhum asset para exclusão.' });
      console.log('[ASSET_DELETE_LP] Solicitado para deletar:', assets);
      assets.forEach(asset => {
        if (asset && typeof asset.src === 'string') {
          try {
            const assetUrl = new URL(asset.src);
            const filename = path.basename(assetUrl.pathname);
            if (filename.includes('..') || !assetUrl.pathname.includes(`/${UPLOADS_ROOT_DIR}/lp-assets/`)) {
                console.warn(`[ASSET_DELETE_LP] Tentativa de path traversal ou URL inválida: ${asset.src}`);
                return;
            }
            const filePath = path.join(LP_ASSETS_DIR, filename);
            console.log(`[ASSET_DELETE_LP] Tentando deletar: ${filePath}`);
            if (fs.existsSync(filePath)) {
              fs.unlink(filePath, (err) => {
                if (err) console.error(`[ASSET_DELETE_LP] Erro ao deletar: ${filePath}`, err);
                else console.log(`[ASSET_DELETE_LP] Deletado: ${filePath}`);
              });
            } else {
              console.warn(`[ASSET_DELETE_LP] Não encontrado: ${filePath}`);
            }
          } catch (e) {
            console.warn(`[ASSET_DELETE_LP] URL inválida ou erro ao parsear: ${asset.src}`, e);
          }
        }
      });
      res.status(200).json({ message: 'Solicitação de exclusão de assets processada.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      if (!req.file) {
        console.log('[MCP_ATTACHMENT_UPLOAD] Nenhum arquivo recebido.');
        return res.status(400).json({ error: 'Nenhum arquivo de anexo enviado.' });
      }
      const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      const attachmentUrl = `${appBaseUrl}/${UPLOADS_ROOT_DIR}/mcp-attachments/${req.file.filename}`;
      console.log(`[MCP_ATTACHMENT_UPLOAD] Arquivo: ${req.file.originalname}, Salvo como: ${req.file.filename}, URL Pública: ${attachmentUrl}`);
      res.status(200).json({ url: attachmentUrl });
    } catch (error) {
      next(error);
    }
  });


  app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId, attachmentUrl } = req.body;
      const userId = req.user!.id;

      if (!message && !attachmentUrl) {
        return res.status(400).json({ error: 'Mensagem ou anexo é obrigatório.' });
      }

      console.log(`[MCP_AGENT] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${sessionId || 'Nova'})`);

      let currentSession: ChatSession | undefined;
      if (sessionId) {
        currentSession = await storage.getChatSession(sessionId, userId);
      }
      if (!currentSession) {
        console.log(`[MCP_AGENT] Criando nova sessão de chat para o usuário ${userId}`);
        currentSession = await storage.createChatSession(userId, `Conversa com IA ${new Date().toLocaleDateString('pt-BR')}`);
      }

      await storage.addChatMessage({
        sessionId: currentSession.id,
        sender: 'user',
        text: message || (attachmentUrl ? 'Anexo enviado.' : ''),
        attachmentUrl: attachmentUrl || null,
      });

      if (genAI && message) {
        const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const promptForIntent = `O usuário perguntou: "${message}". Ele está pedindo para navegar para alguma seção da plataforma? Se sim, qual? Responda APENAS com a rota exata (ex: /dashboard, /campaigns, /creatives, /budget, /landingpages, /whatsapp, /copy, /funnel, /metrics, /alerts, /export, /integrations). Se não for um pedido de navegação, responda "NÃO".
        Exemplos de intenção de navegação:
        - "Me leve para campanhas" -> /campaigns
        - "Quero ver o dashboard" -> /dashboard
        - "Abra a página de WhatsApp" -> /whatsapp
        - "Gerenciar criativos" -> /creatives
        - "Onde está o orçamento?" -> /budget
        - "Mostrar landing pages" -> /landingpages
        - "Ver alertas" -> /alerts
        - "Ir para funil" -> /funnel
        - "Eu quero exportar dados" -> /export
        - "Configurações de integração" -> /integrations
        - "Preciso de copy" -> /copy
        `;

        const intentResult = await intentModel.generateContent(promptForIntent);
        const intentResponse = intentResult.response.text().trim();
        const validRoutes = [
          "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages",
          "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations"
        ];

        if (validRoutes.includes(intentResponse)) {
            console.log(`[MCP_AGENT] Intenção de navegação detectada: ${intentResponse}`);
            const agentReplyText = `Claro! Te levarei para ${intentResponse.replace('/', '') || 'o Dashboard'}...`;
            await storage.addChatMessage({
              sessionId: currentSession.id,
              sender: 'agent',
              text: agentReplyText,
            });
            return res.json({
                reply: agentReplyText,
                action: "navigate",
                payload: intentResponse,
                sessionId: currentSession.id
            });
        }
      }

      let agentReplyText: string;
      if (genAI) {
        const modelName = "gemini-1.5-flash-latest";
        console.log(`[MCP_AGENT] Usando modelo para resposta: "${modelName}"`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const messagesFromDb: ChatMessage[] = await storage.getChatMessages(currentSession.id, userId);
        const historyForGemini = messagesFromDb.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));

        const systemPrompt = { role: "user", parts: [{ text: "Você é o Agente MCP, um assistente de IA para a plataforma de marketing digital USB MKT PRO V2. Sua principal função é auxiliar os usuários com informações sobre a plataforma e marketing digital. Responda sempre em Português do Brasil. Mantenha as respostas concisas e úteis." }] };
        const initialAgentResponse = { role: "model", parts: [{ text: "Olá! Eu sou o Agente MCP, seu assistente inteligente na plataforma USB MKT PRO V2. Como posso te ajudar com marketing digital hoje?" }] };

        const fullHistory = [systemPrompt, initialAgentResponse, ...historyForGemini];

        const chat = model.startChat({
          history: fullHistory,
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.7,
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
        });
        const result = await chat.sendMessage(message || "Processar anexo");
        const response = result.response;
        agentReplyText = response.text();
        console.log(`[MCP_AGENT] Gemini respondeu (resposta geral): "${agentReplyText}"`);

      } else {
        agentReplyText = `Recebido: "${message}". O serviço de IA (Gemini) não está configurado corretamente no servidor.`;
        console.log(`[MCP_AGENT] Respondendo (sem IA): "${agentReplyText}"`);
      }

      await storage.addChatMessage({
        sessionId: currentSession.id,
        sender: 'agent',
        text: agentReplyText,
      });

      return res.json({ reply: agentReplyText, sessionId: currentSession.id });

    } catch (error) {
      console.error('[MCP_AGENT] Erro detalhado no endpoint /api/mcp/converse:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      next(error);
    }
  });

  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { title } = insertChatSessionSchema.partial().parse(req.body);
      const newSession = await storage.createChatSession(userId, title || 'Nova Conversa');
      res.status(201).json(newSession);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const sessions = await storage.getChatSessions(userId);
      res.json(sessions);
    }
    catch (error) {
      next(error);
    }
  });

  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
      const userId = req.user!.id;
      const messages = await storage.getChatMessages(sessionId, userId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
      const userId = req.user!.id;
      const { title } = req.body;
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Novo título inválido.' });
      }
      const updatedSession = await storage.updateChatSessionTitle(sessionId, userId, title);
      if (!updatedSession) return res.status(404).json({ error: 'Sessão não encontrada ou não pertence ao usuário.' });
      res.json(updatedSession);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
      const userId = req.user!.id;
      const success = await storage.deleteChatSession(sessionId, userId);
      if (!success) return res.status(404).json({ error: 'Sessão não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Sessão de chat excluída com sucesso.' });
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
