// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http"; // Certifique-se que HttpServer está importado corretamente se usado.
import { storage } from "./storage";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schema from "../shared/schema"; // Usando import * as schema
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
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; // Expandido para incluir mais tipos
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para anexos do MCP.'));
  },
});


interface AuthenticatedRequest extends Request {
  user?: schema.User; // Usando o tipo User do schema
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH] Bypass ativo - criando usuário mock');
    // @ts-ignore // Para suprimir erro de tipo se User tiver campos obrigatórios não preenchidos aqui
    req.user = {
      id: 1, // ID mock
      username: 'admin_bypass',
      email: 'admin_bypass@usbmkt.com',
      // Outros campos podem ser mockados se necessário para req.user
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
  if (err.stack && process.env.NODE_ENV === 'development') { // Mostrar stack apenas em dev
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
  res.status(statusCode).json({ error: message, details: process.env.NODE_ENV === 'development' ? err.stack : undefined });
};


// ADICIONAR 'export' AQUI
export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint for Render
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'MKTV5',
      version: '1.0.0' // Você pode pegar do package.json se quiser
    });
  });

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = schema.insertUserSchema.parse(req.body); // Usando schema.
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

  // Rotas protegidas
  app.use(authenticateToken); // Aplicar middleware de autenticação a todas as rotas abaixo

  app.get('/api/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const userId = req.user!.id;
      const timeRange = req.query.timeRange as string || '30d';
      const dashboardData = await storage.getDashboardData(userId, timeRange);
      res.json(dashboardData);
    } catch (error) { next(error); }
  });

  app.get('/api/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      res.json(await storage.getCampaigns(req.user!.id));
    } catch (error) { next(error); }
  });
  app.post('/api/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const campaignData = schema.insertCampaignSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createCampaign(campaignData));
    } catch (error) { next(error); }
  });
  app.get('/api/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const campaign = await storage.getCampaign(id, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  app.put('/api/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const { userId, ...updateData } = req.body; // userId do body não deve ser usado para update
      const campaignData = schema.insertCampaignSchema.partial().parse(updateData);
      const campaign = await storage.updateCampaign(id, campaignData, req.user!.id);
      if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não pertence ao usuário.' });
      res.json(campaign);
    } catch (error) { next(error); }
  });
  app.delete('/api/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      const success = await storage.deleteCampaign(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Campanha não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Campanha excluída com sucesso.' }); // Usar 200 ou 204
    } catch (error) { next(error); }
  });

  // Creatives
  app.get('/api/creatives', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getCreatives(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });

  app.post('/api/creatives', creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

  app.put('/api/creatives/:id', creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });
      const userId = req.user!.id;

      const existingCreative = await storage.getCreative(id, userId);
      if (!existingCreative) {
        if (req.file) fs.unlinkSync(req.file.path); // Deleta arquivo se o criativo não existe
        return res.status(404).json({ error: 'Criativo não encontrado ou não pertence ao usuário.' });
      }

      const { userId: _, ...updateDataRaw } = req.body;
      const updateData = schema.insertCreativeSchema.partial().parse(updateDataRaw);

      let newFileUrl: string | null | undefined = undefined; // Para não sobrescrever se não houver novo arquivo

      if (req.file) {
        newFileUrl = `/uploads/creatives-assets/${req.file.filename}`;
        // Se há um arquivo novo e um antigo, deletar o antigo
        if (existingCreative.fileUrl && existingCreative.fileUrl !== newFileUrl) {
          const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
           if (fs.existsSync(oldFilePath) && oldFilePath.includes(CREATIVES_ASSETS_DIR)) { // Segurança extra
            fs.unlink(oldFilePath, err => {
              if (err) console.error(`[Creative Update] Erro ao deletar arquivo antigo ${oldFilePath}:`, err);
            });
          }
        }
        updateData.fileUrl = newFileUrl; // Atualiza com o novo arquivo
      } else if (req.body.fileUrl === "null" || req.body.fileUrl === null) { // Se fileUrl foi explicitamente setado para null
        if (existingCreative.fileUrl) {
            const oldFilePath = path.join(process.cwd(), existingCreative.fileUrl.startsWith('/') ? existingCreative.fileUrl.substring(1) : existingCreative.fileUrl);
             if (fs.existsSync(oldFilePath) && oldFilePath.includes(CREATIVES_ASSETS_DIR)) {
                fs.unlink(oldFilePath, err => {
                  if (err) console.error(`[Creative Update] Erro ao deletar arquivo marcado como null ${oldFilePath}:`, err);
                });
            }
        }
        updateData.fileUrl = null; // Marca para o DB que o arquivo foi removido
      }
      // Se req.file não existe E req.body.fileUrl não é "null", não mexe em updateData.fileUrl, mantendo o existente.

      const updatedCreative = await storage.updateCreative(id, updateData, userId);
      if (!updatedCreative) { // Deveria ser redundante se existingCreative foi achado
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Falha ao atualizar o criativo.' });
      }
      res.json(updatedCreative);
    } catch (error) {
      if (req.file) { // Se houve erro e um arquivo foi upado, deleta-o
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Erro ao deletar novo arquivo de criativo após falha no PUT:", unlinkErr);
        });
      }
      next(error);
    }
  });

  app.delete('/api/creatives/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do criativo inválido.' });

      const creative = await storage.getCreative(id, req.user!.id); // Pega antes para saber o fileUrl
      if (!creative) return res.status(404).json({ error: 'Criativo não encontrado.' });

      const success = await storage.deleteCreative(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Criativo não encontrado ou não pode ser excluído.' });

      if (creative.fileUrl) {
        const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl);
        if (fs.existsSync(filePath) && filePath.includes(CREATIVES_ASSETS_DIR)) { // Segurança extra
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Erro ao deletar arquivo físico ${filePath} após exclusão do criativo:`, err);
            else console.log(`Arquivo ${filePath} deletado com sucesso.`);
          });
        }
      }
      res.status(200).json({ message: 'Criativo excluído com sucesso.' });
    } catch (error) { next(error); }
  });


  // WhatsApp Messages
  app.get('/api/whatsapp/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const contactNumber = req.query.contact as string | undefined;
      res.json(await storage.getMessages(req.user!.id, contactNumber));
    } catch (error) { next(error); }
  });
  app.post('/api/whatsapp/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const messageData = schema.insertWhatsappMessageSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createMessage(messageData));
    } catch (error) { next(error); }
  });
  app.get('/api/whatsapp/contacts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      res.json(await storage.getContacts(req.user!.id));
    } catch (error) { next(error); }
  });

  // Copies
  app.get('/api/copies', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getCopies(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });
  app.post('/api/copies', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const copyData = schema.insertCopySchema.parse({ ...req.body, userId: req.user!.id, campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : null });
      res.status(201).json(await storage.createCopy(copyData));
    } catch (error) { next(error); }
  });
  app.delete('/api/copies/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' });
      const success = await storage.deleteCopy(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Copy não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Copy excluída com sucesso.' });
    } catch (error) { next(error); }
  });
  app.post('/api/copies/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const { product, audience, objective, tone } = req.body;
      if (!product || !audience || !objective || !tone) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
      }

      if (!genAI) {
        return res.status(503).json({ error: "Serviço de IA não disponível no momento." });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const prompts = [
        { type: 'headline', platform: 'Facebook', prompt: `Crie um headline persuasivo para Facebook sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 60 caracteres. Seja direto e impactante.` },
        { type: 'cta', platform: 'Google', prompt: `Crie um call-to-action (CTA) convincente para Google Ads sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 30 palavras.` },
        { type: 'description', platform: 'Instagram', prompt: `Crie uma descrição persuasiva para Instagram sobre "${product}" direcionado para "${audience}" com objetivo de "${objective}" em tom "${tone}". Máximo 125 caracteres.` }
      ];
      const generatedCopies = await Promise.all(prompts.map(async (promptData) => {
        try {
          const result = await model.generateContent(promptData.prompt);
          return { type: promptData.type, content: result.response.text().trim(), platform: promptData.platform };
        } catch (error) {
          console.error(`[GEMINI] Erro ao gerar ${promptData.type}:`, error);
          return { type: promptData.type, content: `Falha ao gerar ${promptData.type}. Tente novamente.`, platform: promptData.platform, error: true };
        }
      }));
      res.json(generatedCopies);
    } catch (error) {
      console.error('[COPIES_GENERATE] Erro:', error);
      next(error);
    }
  });

  // Alerts
  app.get('/api/alerts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const onlyUnread = req.query.unread === 'true';
      res.json(await storage.getAlerts(req.user!.id, onlyUnread));
    } catch (error) { next(error); }
  });
  app.put('/api/alerts/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID do alerta inválido.' });
      const success = await storage.markAlertAsRead(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Alerta não encontrado ou já lido.' });
      res.json({ success: true, message: 'Alerta marcado como lido.' });
    } catch (error) { next(error); }
  });

  // Budgets
  app.get('/api/budgets', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      if (req.query.campaignId && isNaN(campaignId!)) return res.status(400).json({ error: 'ID da campanha inválido.' });
      res.json(await storage.getBudgets(req.user!.id, campaignId));
    } catch (error) { next(error); }
  });
  app.post('/api/budgets', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const budgetData = schema.insertBudgetSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createBudget(budgetData));
    } catch (error) { next(error); }
  });

  // Landing Pages
  app.get('/api/landingpages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      res.json(await storage.getLandingPages(req.user!.id));
    } catch (error) { next(error); }
  });
  app.post('/api/landingpages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const { grapesJsData, ...otherData } = req.body;
      const lpData = schema.insertLandingPageSchema.parse({ ...otherData, userId: req.user!.id, grapesJsData: grapesJsData || {} });
      if (lpData.slug) {
        const existingSlug = await storage.getLandingPageBySlug(lpData.slug);
        if (existingSlug) return res.status(409).json({ error: 'Este slug já está em uso.'});
      }
      res.status(201).json(await storage.createLandingPage(lpData));
    } catch (error) { next(error); }
  });
  app.get('/api/landingpages/slug/:slug', async (req: Request, res: Response, next: NextFunction) => {
    // Rota pública, não precisa de authenticateToken
    try {
      const { slug } = req.params;
      const landingPage = await storage.getLandingPageBySlug(slug);
      if (!landingPage || landingPage.status !== 'published') {
        return res.status(404).json({ error: 'Landing Page não encontrada ou não publicada.' });
      }
      res.json({ name: landingPage.name, data: landingPage.grapesJsData, publicUrl: landingPage.publicUrl }); // Ou o que for necessário
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const { studioProjectId } = req.params;
      const landingPage = await storage.getLandingPageByStudioProjectId(studioProjectId, req.user!.id);
      if (!landingPage) return res.status(404).json({ error: 'Projeto de Landing Page não encontrado.' });
      res.json({ project: landingPage.grapesJsData || {} });
    }
    catch (error) { next(error); }
  });
  app.put('/api/landingpages/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da Landing Page inválido.' });
      const { userId: _, slug, grapesJsData, ...otherData } = req.body;
      const lpDataToValidate = { ...otherData, grapesJsData: grapesJsData || {} };
      // Removendo id explicitamente pois o schema não espera
      const { id: lpIdToValidate, ...dataToParse } = lpDataToValidate;
      const lpData = schema.insertLandingPageSchema.partial().parse(dataToParse);

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
  app.delete('/api/landingpages/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID da Landing Page inválido.' });
      const success = await storage.deleteLandingPage(id, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Landing Page não encontrada.' });
      res.status(200).json({ message: 'Landing Page excluída com sucesso.' });
    } catch (error) { next(error); }
  });

  app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      if (!req.file) {
        console.log('[ASSET_UPLOAD_LP] Nenhum arquivo recebido.');
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const publicUrl = `/uploads/lp-assets/${req.file.filename}`; // URL relativa
      console.log(`[ASSET_UPLOAD_LP] Arquivo: ${req.file.originalname}, Salvo como: ${req.file.filename}, Campo: ${req.file.fieldname}, URL Pública Relativa: ${publicUrl}`);
      res.status(200).json([{ src: publicUrl }]); // GrapesJS Studio espera um array
    } catch(error) {
      console.error('[ASSET_UPLOAD_LP] Erro no handler:', error);
      next(error);
    }
  });
  app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const { assets } = req.body;
      if (!Array.isArray(assets) || assets.length === 0) return res.status(400).json({ error: 'Nenhum asset para exclusão.' });
      console.log('[ASSET_DELETE_LP] Solicitado para deletar:', assets);
      assets.forEach(asset => {
        if (asset && typeof asset.src === 'string') {
          try {
            // Validar se o path é relativo e dentro da pasta de uploads esperada
            const relativePath = asset.src.startsWith('/') ? asset.src.substring(1) : asset.src;
            if (!relativePath.startsWith(`${UPLOADS_ROOT_DIR}/lp-assets/`)) {
                console.warn(`[ASSET_DELETE_LP] Tentativa de acesso fora do diretório permitido: ${asset.src}`);
                return;
            }
            const filePath = path.join(process.cwd(), relativePath);
            if (filePath.includes('..')) { // Segurança extra contra path traversal
                console.warn(`[ASSET_DELETE_LP] Tentativa de path traversal detectada: ${asset.src}`);
                return;
            }

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
            console.warn(`[ASSET_DELETE_LP] Erro ao processar URL de asset para deleção: ${asset.src}`, e);
          }
        }
      });
      res.status(200).json({ message: 'Solicitação de exclusão de assets processada.' });
    } catch (error) {
      next(error);
    }
  });

  // MCP
  app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      if (!req.file) {
        console.log('[MCP_ATTACHMENT_UPLOAD] Nenhum arquivo recebido.');
        return res.status(400).json({ error: 'Nenhum arquivo de anexo enviado.' });
      }
      const attachmentUrl = `/uploads/mcp-attachments/${req.file.filename}`; // URL relativa
      console.log(`[MCP_ATTACHMENT_UPLOAD] Arquivo: ${req.file.originalname}, Salvo como: ${req.file.filename}, URL Pública Relativa: ${attachmentUrl}`);
      res.status(200).json({ url: attachmentUrl });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/mcp/converse', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const { message, sessionId, attachmentUrl } = req.body;
      const userId = req.user!.id;

      if (!message && !attachmentUrl) {
        return res.status(400).json({ error: 'Mensagem ou anexo é obrigatório.' });
      }
      console.log(`[MCP_AGENT] User ${userId} disse: "${message || '[Anexo]'}" (Session: ${sessionId || 'Nova'})`);

      let currentSession: schema.ChatSession | undefined; // Usando o tipo ChatSession do schema
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
        // ... (lógica de intenção de navegação e resposta geral com Gemini) ...
        // (Mantendo a lógica anterior, mas garantindo que os tipos estejam corretos se houver interação com DB)
        const intentModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        // ... prompt e processamento de intenção ...
        const intentResult = await intentModel.generateContent("Analise a intenção: " + message); // Simplificado para o exemplo
        const intentResponseText = intentResult.response.text().trim();
        const validRoutes = [
          "/dashboard", "/campaigns", "/creatives", "/budget", "/landingpages",
          "/whatsapp", "/copy", "/funnel", "/metrics", "/alerts", "/export", "/integrations"
        ];

        if (validRoutes.includes(intentResponseText)) {
            const agentReplyText = `Claro! Te levarei para ${intentResponseText.replace('/', '') || 'o Dashboard'}...`;
            await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
            return res.json({ reply: agentReplyText, action: "navigate", payload: intentResponseText, sessionId: currentSession.id });
        }
         // Lógica de resposta geral com Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const messagesFromDb = await storage.getChatMessages(currentSession.id, userId);
        const historyForGemini = messagesFromDb.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text || '' }] // Garantir que text não seja null
        }));

        const chat = model.startChat({
          history: historyForGemini,
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
          safetySettings: [ /* ... */ ]
        });
        const result = await chat.sendMessage(message || "Anexo recebido.");
        const agentReplyText = result.response.text();
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, sessionId: currentSession.id });

      } else if (attachmentUrl) { // Se for apenas um anexo sem mensagem de texto
        const agentReplyText = "Anexo recebido! Como posso ajudar com ele?";
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, sessionId: currentSession.id });
      } else { // Caso Gemini não esteja configurado e não seja anexo
        const agentReplyText = `Recebido: "${message}". O serviço de IA não está configurado.`;
        await storage.addChatMessage({ sessionId: currentSession.id, sender: 'agent', text: agentReplyText });
        return res.json({ reply: agentReplyText, sessionId: currentSession.id });
      }

    } catch (error) {
      console.error('[MCP_AGENT] Erro detalhado no endpoint /api/mcp/converse:', error);
      next(error);
    }
  });

  // Chat Sessions CRUD
  app.post('/api/chat/sessions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const userId = req.user!.id;
      const { title } = schema.insertChatSessionSchema.partial().parse(req.body);
      const newSession = await storage.createChatSession(userId, title || 'Nova Conversa');
      res.status(201).json(newSession);
    } catch (error) { next(error); }
  });
  app.get('/api/chat/sessions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      res.json(await storage.getChatSessions(req.user!.id));
    }
    catch (error) { next(error); }
  });
  app.get('/api/chat/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
      res.json(await storage.getChatMessages(sessionId, req.user!.id));
    } catch (error) { next(error); }
  });
  app.put('/api/chat/sessions/:sessionId/title', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  app.delete('/api/chat/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Usuário não autenticado.'});
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID da sessão inválido.' });
      const success = await storage.deleteChatSession(sessionId, req.user!.id);
      if (!success) return res.status(404).json({ error: 'Sessão não encontrada ou não pode ser excluída.' });
      res.status(200).json({ message: 'Sessão de chat excluída com sucesso.' });
    } catch (error) { next(error); }
  });

  // Servir arquivos estáticos de uploads
  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR), {
    fallthrough: false, // Importante para não deixar o erro vazar para o handler de SPA
    index: false // Não servir index.html de dentro da pasta uploads
  }));


  // Middlewares de tratamento de erro devem ser os últimos
  app.use(handleZodError);
  app.use(handleError); // Handler de erro genérico

  // Criação do servidor HTTP para compatibilidade com setupVite
  const httpServer = createHttpServer(app);
  return httpServer;
}
