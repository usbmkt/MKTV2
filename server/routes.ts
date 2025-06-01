import express, { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { ZodError } from 'zod';
import { ClientError, fromZodError } from 'zod-validation-error';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

import { db } from './db.js';
import { 
    users, campaigns, creatives, metrics, whatsappMessages as whatsappMessagesTable, 
    copies, alerts, budgets, landingPages, chatSessions, chatMessages, 
    funnels, funnelStages, insertUserSchema, selectUserSchema, InsertUser, User, 
    InsertCampaign, insertCampaignSchema, Campaign, InsertCreative, insertCreativeSchema, Creative, 
    InsertCopy, insertCopySchema, Copy, AiResponseType, aiResponseSchema, 
    InsertBudget, insertBudgetSchema, Budget, InsertLandingPage, insertLandingPageSchema, LandingPage, 
    InsertChatSession, insertChatSessionSchema, ChatSession, InsertChatMessage, insertChatMessageSchema, ChatMessage, 
    InsertFunnel, insertFunnelSchema, Funnel, InsertFunnelStage, insertFunnelStageSchema, FunnelStage, 
    InsertAlert, insertAlertSchema, Alert, aiContentIdeasResponseSchema, aiOptimizeCopyResponseSchema,
} from '../shared/schema.js';
import { JWT_SECRET, GEMINI_API_KEY, GRAPESJS_STUDIO_LICENSE_KEY } from './config.js';
import { storage } from './storage.js';
import { handleMCPConversation, MCPResponsePayload } from './mcp_handler.js';
import { eq, and, or, desc, asc, isNull, gte, lte, ilike, count, sql } from 'drizzle-orm';

// Importa o WhatsappConnectionService e a interface de status
import { WhatsappConnectionService, WhatsappConnectionStatus } from './services/whatsapp-connection.service.js';

const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.join(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.join(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.join(UPLOADS_ROOT_DIR, 'mcp-attachments');

function ensureUploadsDirExists() {
  [UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}
ensureUploadsDirExists();


// Middleware de autenticação
interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.warn('WARN: Bypassing authentication for development.');
    let bypassUser = await storage.getUserByEmail('admin@usbmkt.com');
    if (!bypassUser) {
      const allUsers = await db.select().from(users).limit(1);
      if (allUsers.length > 0) {
        bypassUser = allUsers[0] as User;
      } else {
        console.warn('WARN: No users found for auth bypass, using minimal mock user.');
        bypassUser = { id: 1, username: 'admin_bypass', email: 'bypass@example.com', password: '', createdAt: new Date(), updatedAt: new Date() };
      }
    }
    req.user = bypassUser!;
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('Auth token missing');
    return res.status(401).json({ message: 'Token de autenticação ausente.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number; email: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      console.warn(`User not found for token: userId ${decoded.userId}`);
      return res.status(403).json({ message: 'Usuário não encontrado ou token inválido.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.warn('Invalid or expired token:', (err as Error).message);
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expirado. Por favor, faça login novamente.', code: 'TOKEN_EXPIRED' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ message: 'Token inválido.' });
    }
    return res.status(403).json({ message: 'Falha na autenticação do token.' });
  }
};

// Configuração do Multer para upload de criativos
const creativesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CREATIVES_ASSETS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const creativesUpload = multer({
  storage: creativesStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para criativos. Use imagens (jpeg, png, gif, webp) ou vídeos (mp4, mov, avi).'));
  }
});

// Configuração do Multer para upload de assets de Landing Page (GrapesJS)
const lpAssetStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LP_ASSETS_DIR);
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, Date.now() + '-' + originalName);
  }
});
const lpAssetUpload = multer({
  storage: lpAssetStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para assets de landing page. Use imagens (jpeg, png, gif, svg, webp).'));
  }
});

// Configuração do Multer para anexos do MCP
const mcpAttachmentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, MCP_ATTACHMENTS_DIR);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
const mcpAttachmentUpload = multer({
    storage: mcpAttachmentStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|mp4|mov|mp3|wav/;
      const mimetype = allowedTypes.test(file.mimetype);
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error('Tipo de arquivo não permitido para anexos do MCP.'));
    }
  });


// Handler de erro Zod
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError || err instanceof ClientError) {
    console.warn('Zod validation error:', err.message);
    const validationError = fromZodError(err as ZodError); 
    return res.status(400).json({
      message: 'Erro de validação.',
      errors: validationError.details,
    });
  }
  next(err);
};

// Handler de erro genérico
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err.stack || err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Erro no upload do arquivo: ${err.message}` });
  }
  if (err.message && err.message.includes('Tipo de arquivo não permitido')) {
      return res.status(400).json({ message: err.message });
  }
   if (err.message && (err.message.includes('GoogleGenerativeAI Error') || err.name === 'GoogleGenerativeAIError')) {
    return res.status(500).json({ message: 'Erro na API de IA da Google: ' + err.message });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Ocorreu um erro interno no servidor.';
  res.status(statusCode).json({ message });
};


let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("Google Generative AI SDK initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Google Generative AI SDK:", error);
  }
} else {
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
}

// Cache para instâncias do WhatsappConnectionService por userId
const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();

function getWhatsappServiceInstance(userId: number): WhatsappConnectionService {
  if (!whatsappServiceInstances.has(userId)) {
    console.log(`Creating new WhatsappConnectionService instance for userId: ${userId}`);
    whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
  }
  return whatsappServiceInstances.get(userId)!;
}


export class RouterSetup {
  static async registerRoutes(app: Express): Promise<Express> {
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mktv5-api',
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // --- Rotas de Autenticação ---
    app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validatedData = insertUserSchema.parse(req.body);
        const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
        if (existingUserByEmail) {
          return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }
        const existingUserByUsername = await storage.getUserByUsername(validatedData.username);
        if (existingUserByUsername) {
          return res.status(409).json({ message: 'Este nome de usuário já está em uso.' });
        }

        const newUser = await storage.createUser(validatedData);
        const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const { password, ...userWithoutPassword } = newUser;
        res.status(201).json({ user: userWithoutPassword, token });
      } catch (error) {
        next(error);
      }
    });

    app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const isValidPassword = await storage.validatePassword(password, user.password!);
        if (!isValidPassword) {
          return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
      } catch (error) {
        next(error);
      }
    });

    // --- Rotas do Dashboard ---
    app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        const timeRange = req.query.timeRange as string || '30d'; // Ex: '7d', '30d', '90d', 'all'
        const dashboardData = await storage.getDashboardData(userId, timeRange);
        res.json(dashboardData);
      } catch (error) {
        next(error);
      }
    });

    // --- Rotas de Campanhas ---
    app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const campaigns = await storage.getCampaigns(req.user!.id);
        res.json(campaigns);
      } catch (error) {
        next(error);
      }
    });
    app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const campaignData = insertCampaignSchema.omit({ userId: true }).parse(req.body);
        const newCampaign = await storage.createCampaign({ ...campaignData, userId: req.user!.id } as InsertCampaign);
        res.status(201).json(newCampaign);
      } catch (error) {
        next(error);
      }
    });
     app.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const campaignId = parseInt(req.params.id, 10);
        if (isNaN(campaignId)) return res.status(400).json({ message: 'ID da campanha inválido.' });
        const campaign = await storage.getCampaignById(campaignId, req.user!.id);
        if (!campaign) return res.status(404).json({ message: 'Campanha não encontrada.' });
        res.json(campaign);
      } catch (error) {
        next(error);
      }
    });
    app.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const campaignId = parseInt(req.params.id, 10);
        if (isNaN(campaignId)) return res.status(400).json({ message: 'ID da campanha inválido.' });
        // Omit userId from parsing, as it comes from token. Partial allows not all fields to be present.
        const campaignData = insertCampaignSchema.omit({ userId: true }).partial().parse(req.body);
        const updatedCampaign = await storage.updateCampaign(campaignId, req.user!.id, campaignData as Partial<Campaign>);
        if (!updatedCampaign) return res.status(404).json({ message: 'Campanha não encontrada ou não pertence ao usuário.' });
        res.json(updatedCampaign);
      } catch (error) {
        next(error);
      }
    });
    app.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const campaignId = parseInt(req.params.id, 10);
        if (isNaN(campaignId)) return res.status(400).json({ message: 'ID da campanha inválido.' });
        const success = await storage.deleteCampaign(campaignId, req.user!.id);
        if (!success) return res.status(404).json({ message: 'Campanha não encontrada ou não pertence ao usuário.' });
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    });

    // --- Rotas de Criativos ---
    app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const creativeDataPayload = { ...req.body };
            if (req.file) {
                creativeDataPayload.fileUrl = `/${UPLOADS_ROOT_DIR}/${CREATIVES_ASSETS_DIR.split(path.sep).pop()}/${req.file.filename}`;
            }
            // Parse and validate campaignId if present
            if (creativeDataPayload.campaignId && creativeDataPayload.campaignId !== 'null' && creativeDataPayload.campaignId !== 'undefined') {
                creativeDataPayload.campaignId = parseInt(creativeDataPayload.campaignId, 10);
                if (isNaN(creativeDataPayload.campaignId)) {
                    throw new Error("ID da Campanha inválido");
                }
            } else {
                creativeDataPayload.campaignId = null; // Ensure it's explicitly null if not provided or 'null'
            }
             // Handle platforms if it's a stringified JSON array
            if (typeof creativeDataPayload.platforms === 'string') {
                try {
                    creativeDataPayload.platforms = JSON.parse(creativeDataPayload.platforms);
                } catch (e) {
                    throw new Error("Formato de plataformas inválido. Deve ser um array JSON.");
                }
            }


            const validatedData = insertCreativeSchema.omit({ userId: true }).parse(creativeDataPayload);
            const newCreative = await storage.createCreative({ ...validatedData, userId: req.user!.id } as InsertCreative);
            res.status(201).json(newCreative);
        } catch (error) {
            // If there's an error and a file was uploaded, try to delete it
            if (req.file && req.file.path) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Erro ao deletar arquivo após falha na criação do criativo:", unlinkErr);
                });
            }
            next(error);
        }
    });
    app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;
            const { campaignId, type, status, searchTerm } = req.query;

            let campaignIdNum: number | null | undefined = undefined;
            if (typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== '') {
                if (campaignId === 'null') {
                    campaignIdNum = null;
                } else {
                    campaignIdNum = parseInt(campaignId, 10);
                    if (isNaN(campaignIdNum)) {
                       return res.status(400).json({ message: "ID da campanha inválido."});
                    }
                }
            }


            const creativesList = await storage.getCreatives(
                userId,
                campaignIdNum,
                type as string | undefined,
                status as string | undefined,
                searchTerm as string | undefined
            );
            res.json(creativesList);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const creativeId = parseInt(req.params.id, 10);
            if (isNaN(creativeId)) return res.status(400).json({ message: 'ID do criativo inválido.' });

            const creativeDataPayload = { ...req.body };
            let oldFileUrl: string | undefined = undefined;

            // Fetch existing creative to get old file URL if a new file is uploaded
            if (req.file) {
                const existingCreative = await storage.getCreativeById(creativeId, req.user!.id);
                if (existingCreative && existingCreative.fileUrl) {
                    oldFileUrl = existingCreative.fileUrl;
                }
                creativeDataPayload.fileUrl = `/${UPLOADS_ROOT_DIR}/${CREATIVES_ASSETS_DIR.split(path.sep).pop()}/${req.file.filename}`;
            } else if (creativeDataPayload.removeFile === 'true' || creativeDataPayload.removeFile === true) {
                 const existingCreative = await storage.getCreativeById(creativeId, req.user!.id);
                if (existingCreative && existingCreative.fileUrl) {
                    oldFileUrl = existingCreative.fileUrl; // Mark for deletion
                }
                creativeDataPayload.fileUrl = null; // Set to null in database
            }


            if (creativeDataPayload.campaignId && creativeDataPayload.campaignId !== 'null' && creativeDataPayload.campaignId !== 'undefined') {
                creativeDataPayload.campaignId = parseInt(creativeDataPayload.campaignId, 10);
                 if (isNaN(creativeDataPayload.campaignId)) {
                    throw new Error("ID da Campanha inválido");
                }
            } else {
                creativeDataPayload.campaignId = null;
            }
             if (typeof creativeDataPayload.platforms === 'string') {
                try {
                    creativeDataPayload.platforms = JSON.parse(creativeDataPayload.platforms);
                } catch (e) {
                    throw new Error("Formato de plataformas inválido. Deve ser um array JSON.");
                }
            }


            const validatedData = insertCreativeSchema.omit({ userId: true }).partial().parse(creativeDataPayload);
            const updatedCreative = await storage.updateCreative(creativeId, req.user!.id, validatedData as Partial<Creative>);

            if (!updatedCreative) {
                 if (req.file && req.file.path) {
                    fs.unlink(req.file.path, (err) => err && console.error("Error deleting new file after failed update:", err));
                }
                return res.status(404).json({ message: 'Criativo não encontrado ou não pertence ao usuário.' });
            }

            // Delete old file if a new one was uploaded and old one existed, or if removeFile was true
            if (oldFileUrl && (req.file || creativeDataPayload.fileUrl === null)) {
                const oldFilePath = path.join(process.cwd(), oldFileUrl.startsWith('/') ? oldFileUrl.substring(1) : oldFileUrl);
                fs.unlink(oldFilePath, (err) => {
                    if (err) console.error("Erro ao deletar arquivo antigo do criativo:", err, "Path:", oldFilePath);
                    else console.log("Arquivo antigo do criativo deletado:", oldFilePath);
                });
            }
            res.json(updatedCreative);
        } catch (error) {
             if (req.file && req.file.path) {
                fs.unlink(req.file.path, (err) => err && console.error("Error deleting new file after exception:", err));
            }
            next(error);
        }
    });
    app.delete('/api/creatives/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const creativeId = parseInt(req.params.id, 10);
            if (isNaN(creativeId)) return res.status(400).json({ message: 'ID do criativo inválido.' });

            const creative = await storage.getCreativeById(creativeId, req.user!.id);
            if (!creative) {
                return res.status(404).json({ message: 'Criativo não encontrado ou não pertence ao usuário.' });
            }

            const success = await storage.deleteCreative(creativeId, req.user!.id);
            if (!success) {
                // This case should ideally not be reached if the above check passes,
                // but good for safety.
                return res.status(404).json({ message: 'Falha ao deletar criativo.' });
            }

            // Delete the associated file from the filesystem
            if (creative.fileUrl) {
                const filePath = path.join(process.cwd(), creative.fileUrl.startsWith('/') ? creative.fileUrl.substring(1) : creative.fileUrl);
                fs.unlink(filePath, (err) => {
                    if (err) console.error("Erro ao deletar arquivo do criativo:", err, "Path:", filePath);
                    else console.log("Arquivo do criativo deletado:", filePath);
                });
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    // --- Rotas de Copies ---
    app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!genAI) {
                return res.status(503).json({ message: 'Serviço de IA não está disponível (API Key não configurada).' });
            }
            const { baseInfo, specificData, purposeKey, launchPhase, generationType, copyToOptimize } = req.body;

            if (!baseInfo || !specificData || !purposeKey || !launchPhase || !generationType) {
                return res.status(400).json({ message: 'Dados insuficientes para gerar a copy.' });
            }
            
            const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash-latest';
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: { responseMimeType: "application/json" }
            });

            let prompt = "";
            let resultSchema: typeof aiResponseSchema | typeof aiContentIdeasResponseSchema | typeof aiOptimizeCopyResponseSchema = aiResponseSchema;

            if (generationType === 'full_copy') {
                prompt = storage.constructCopyPrompt(baseInfo, specificData, purposeKey, launchPhase);
                resultSchema = aiResponseSchema;
            } else if (generationType === 'content_ideas') {
                prompt = storage.constructContentIdeasPrompt(baseInfo.product, baseInfo.audience);
                 resultSchema = aiContentIdeasResponseSchema;
            } else if (generationType === 'optimize_copy') {
                if (!copyToOptimize) return res.status(400).json({ message: "Copy para otimizar não fornecida." });
                prompt = storage.constructOptimizeCopyPrompt(copyToOptimize, baseInfo, specificData, purposeKey, launchPhase);
                 resultSchema = aiOptimizeCopyResponseSchema;
            } else {
                return res.status(400).json({ message: "Tipo de geração inválido." });
            }
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const parsedResponse = JSON.parse(responseText) as AiResponseType; // Assuming it's AiResponseType structure
            
            // Validate the AI's response against the schema
            const validationResult = resultSchema.safeParse(parsedResponse);
            if (!validationResult.success) {
                console.error("Resposta da IA falhou na validação Zod:", validationResult.error.issues);
                throw new Error(`A resposta da IA não corresponde ao formato esperado. Detalhes: ${validationResult.error.message}`);
            }

            res.json(validationResult.data);

        } catch (error) {
            console.error("Erro ao gerar copy com Gemini:", error);
            if (error instanceof Error && error.message.includes("GoogleGenerativeAI Error")) {
                 next(error); // Pass to generic handler for Google errors
            } else if (error instanceof SyntaxError) { // JSON parsing error
                next(new Error("Erro ao processar a resposta da IA (formato JSON inválido)."));
            }
            else {
                 next(new Error("Falha ao gerar copy com IA."));
            }
        }
    });
    app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;
            const { campaignId, phase, purposeKey, searchTerm, sortBy, sortOrder } = req.query;
            const copiesList = await storage.getCopies(
                userId,
                campaignId ? parseInt(campaignId as string) : undefined,
                phase as string | undefined,
                purposeKey as string | undefined,
                searchTerm as string | undefined,
                sortBy as string || 'createdAt',
                sortOrder as 'asc' | 'desc' || 'desc'
            );
            res.json(copiesList);
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const copyData = insertCopySchema.omit({ userId: true }).parse(req.body);
            const newCopy = await storage.createCopy({ ...copyData, userId: req.user!.id } as InsertCopy);
            res.status(201).json(newCopy);
        } catch (error) {
            next(error);
        }
    });
    app.get('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const copyId = parseInt(req.params.id, 10);
            const copy = await storage.getCopyById(copyId, req.user!.id);
            if (!copy) return res.status(404).json({ message: "Copy não encontrada." });
            res.json(copy);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const copyId = parseInt(req.params.id, 10);
            const copyData = insertCopySchema.omit({ userId: true }).partial().parse(req.body);
            const updatedCopy = await storage.updateCopy(copyId, req.user!.id, copyData);
            if (!updatedCopy) return res.status(404).json({ message: "Copy não encontrada ou não pertence ao usuário." });
            res.json(updatedCopy);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const copyId = parseInt(req.params.id, 10);
            const success = await storage.deleteCopy(copyId, req.user!.id);
            if (!success) return res.status(404).json({ message: "Copy não encontrada ou não pertence ao usuário." });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });
    
    // --- Rotas de Orçamentos (Budgets) ---
    app.get('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { campaignId } = req.query;
            const budgetsList = await storage.getBudgets(
                req.user!.id,
                campaignId ? parseInt(campaignId as string) : undefined
            );
            res.json(budgetsList);
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/budgets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const budgetData = insertBudgetSchema.omit({ userId: true }).parse(req.body);
            const newBudget = await storage.createBudget({ ...budgetData, userId: req.user!.id } as InsertBudget);
            res.status(201).json(newBudget);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/budgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const budgetId = parseInt(req.params.id, 10);
            const budgetData = insertBudgetSchema.omit({ userId: true }).partial().parse(req.body);
            const updatedBudget = await storage.updateBudget(budgetId, req.user!.id, budgetData);
             if (!updatedBudget) return res.status(404).json({ message: "Orçamento não encontrado ou não pertence ao usuário." });
            res.json(updatedBudget);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/budgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const budgetId = parseInt(req.params.id, 10);
            const success = await storage.deleteBudget(budgetId, req.user!.id);
            if (!success) return res.status(404).json({ message: "Orçamento não encontrado ou não pertence ao usuário." });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    // --- Rotas de Landing Pages ---
    app.get('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const lps = await storage.getLandingPages(req.user!.id);
            res.json(lps);
        } catch (error) {
            next(error);
        }
    });
    app.get('/api/landingpages/studio-project/:studioProjectId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { studioProjectId } = req.params;
            const lp = await storage.getLandingPageByStudioProjectId(studioProjectId, req.user!.id);
            if (!lp) {
                return res.status(404).json({ message: 'Projeto de Landing Page não encontrado.' });
            }
            // GrapesJS Studio SDK expects the project data under a "project" key,
            // and the data itself might be what's stored in grapesJsData or an empty object.
            res.json({ project: lp.grapesJsData || {} });
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // grapesJsData will come as req.body.projectData from the StudioEditorComponent
            // studioProjectId might come as req.body.studioProjectId if the studio generated one
            const { name, description, status, slug, projectData, studioProjectId: studioProjectIdFromClient } = req.body;
            
            if (!name || !slug) {
                return res.status(400).json({ message: "Nome e slug são obrigatórios para a landing page." });
            }

            const lpDataToInsert: Omit<InsertLandingPage, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
                name,
                slug,
                description: description || null,
                grapesJsData: projectData || {}, // GrapesJS data
                studioProjectId: studioProjectIdFromClient || null, // ID from GrapesJS Studio if available
                status: status || 'draft',
            };
            
            const validatedData = insertLandingPageSchema.omit({ userId: true, id: true, createdAt:true, updatedAt:true }).parse(lpDataToInsert);
            const newLp = await storage.createLandingPage({ ...validatedData, userId: req.user!.id } as InsertLandingPage);
            res.status(201).json(newLp);
        } catch (error) {
            next(error);
        }
    });
     app.put('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const lpId = parseInt(req.params.id, 10);
            if (isNaN(lpId)) return res.status(400).json({ message: 'ID da Landing Page inválido.' });

            const { name, description, status, slug, projectData, studioProjectId: studioProjectIdFromClient } = req.body;

            const lpDataToUpdate: Partial<Omit<InsertLandingPage, 'id' | 'userId'>> = {
                name,
                slug,
                description,
                grapesJsData: projectData,
                studioProjectId: studioProjectIdFromClient,
                status,
            };
            // Remove undefined fields so they don't overwrite existing data with nulls if not provided
            Object.keys(lpDataToUpdate).forEach(key => lpDataToUpdate[key as keyof typeof lpDataToUpdate] === undefined && delete lpDataToUpdate[key as keyof typeof lpDataToUpdate]);


            const validatedData = insertLandingPageSchema.omit({ userId: true, id: true, createdAt:true, updatedAt:true }).partial().parse(lpDataToUpdate);
            if (Object.keys(validatedData).length === 0) {
                return res.status(400).json({ message: "Nenhum dado fornecido para atualização." });
            }

            const updatedLp = await storage.updateLandingPage(lpId, req.user!.id, validatedData);
            if (!updatedLp) {
                return res.status(404).json({ message: 'Landing Page não encontrada ou não pertence ao usuário.' });
            }
            res.json(updatedLp);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/landingpages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const lpId = parseInt(req.params.id, 10);
            const success = await storage.deleteLandingPage(lpId, req.user!.id);
            if (!success) return res.status(404).json({ message: 'Landing Page não encontrada ou não pertence ao usuário.' });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
            }
            // The GrapesJS Studio SDK expects an array of asset objects
            const assetUrl = `/${UPLOADS_ROOT_DIR}/${LP_ASSETS_DIR.split(path.sep).pop()}/${req.file.filename}`;
            res.json([{ src: assetUrl }]);
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/assets/lp-delete', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { assets } = req.body; // Expected to be an array of { src: "url_do_asset_a_deletar" }
            if (!Array.isArray(assets) || assets.length === 0) {
                return res.status(400).json({ message: 'Nenhum asset especificado para exclusão.' });
            }

            const deletedAssets: string[] = [];
            const errors: { src: string, error: string }[] = [];

            for (const asset of assets) {
                if (asset && typeof asset.src === 'string') {
                    const assetPathRelative = asset.src.split(`/${UPLOADS_ROOT_DIR}/${LP_ASSETS_DIR.split(path.sep).pop()}/`)[1];
                    if (assetPathRelative) {
                        const assetPathFull = path.join(process.cwd(), LP_ASSETS_DIR, assetPathRelative);
                        try {
                            if (fs.existsSync(assetPathFull)) {
                                fs.unlinkSync(assetPathFull);
                                deletedAssets.push(asset.src);
                            } else {
                                errors.push({ src: asset.src, error: "Arquivo não encontrado no servidor." });
                            }
                        } catch (e: any) {
                            errors.push({ src: asset.src, error: e.message || "Erro ao deletar arquivo." });
                        }
                    } else {
                         errors.push({ src: asset.src, error: "Caminho do asset inválido ou não pertence a este diretório." });
                    }
                }
            }
            res.json({ deleted: deletedAssets, errors });
        } catch (error) {
            next(error);
        }
    });


    // --- Rotas de Chat (MCP) ---
    app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const sessions = await storage.getChatSessions(req.user!.id);
            res.json(sessions);
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { title } = req.body;
            const sessionData = insertChatSessionSchema.omit({userId: true}).parse({ title });
            const newSession = await storage.createChatSession({ ...sessionData, userId: req.user!.id } as InsertChatSession);
            res.status(201).json(newSession);
        } catch (error) {
            next(error);
        }
    });
    app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const sessionId = parseInt(req.params.sessionId, 10);
            // Verificar se a sessão pertence ao usuário (storage.getChatSessionById faria isso)
            const session = await storage.getChatSessionById(sessionId, req.user!.id);
            if (!session) return res.status(404).json({ message: "Sessão de chat não encontrada." });

            const messages = await storage.getChatMessages(sessionId);
            res.json(messages);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const sessionId = parseInt(req.params.sessionId, 10);
            const { title } = req.body;
            if (!title || typeof title !== 'string' || title.trim() === '') {
                return res.status(400).json({ message: "Título inválido." });
            }
            const updatedSession = await storage.updateChatSessionTitle(sessionId, req.user!.id, title);
            if (!updatedSession) return res.status(404).json({ message: "Sessão não encontrada ou não pertence ao usuário." });
            res.json(updatedSession);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const sessionId = parseInt(req.params.sessionId, 10);
            const success = await storage.deleteChatSession(sessionId, req.user!.id);
            if (!success) return res.status(404).json({ message: "Sessão não encontrada ou não pertence ao usuário." });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/mcp/converse', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!genAI) {
                return res.status(503).json({ message: 'Serviço de IA não está disponível.' });
            }
            const { message, sessionId, attachmentUrl } = req.body;
            const userId = req.user!.id;

            if (!message && !attachmentUrl) return res.status(400).json({ message: "Mensagem ou anexo são obrigatórios." });

            const responsePayload: MCPResponsePayload = await handleMCPConversation(
                userId,
                message,
                sessionId,
                genAI,
                storage,
                attachmentUrl
            );
            res.json(responsePayload);
        } catch (error) {
            console.error("Erro na rota /api/mcp/converse:", error);
            next(error);
        }
    });
     app.post('/api/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'Nenhum arquivo de anexo enviado.' });
            }
            const attachmentUrl = `/${UPLOADS_ROOT_DIR}/${MCP_ATTACHMENTS_DIR.split(path.sep).pop()}/${req.file.filename}`;
            res.json({ attachmentUrl });
        } catch (error) {
            next(error);
        }
    });


    // --- Rotas de Funis ---
    app.get('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { campaignId } = req.query;
            const funnelsList = await storage.getFunnels(
                req.user!.id,
                campaignId ? parseInt(campaignId as string) : undefined
            );
            res.json(funnelsList);
        } catch (error) {
            next(error);
        }
    });
    app.post('/api/funnels', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const funnelData = insertFunnelSchema.omit({ userId: true }).parse(req.body);
            const newFunnel = await storage.createFunnel({ ...funnelData, userId: req.user!.id } as InsertFunnel);
            res.status(201).json(newFunnel);
        } catch (error) {
            next(error);
        }
    });
    app.get('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const funnelId = parseInt(req.params.id, 10);
            const funnel = await storage.getFunnelById(funnelId, req.user!.id);
            if (!funnel) return res.status(404).json({ message: "Funil não encontrado." });
            res.json(funnel);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const funnelId = parseInt(req.params.id, 10);
            const funnelData = insertFunnelSchema.omit({ userId: true }).partial().parse(req.body);
            const updatedFunnel = await storage.updateFunnel(funnelId, req.user!.id, funnelData);
            if (!updatedFunnel) return res.status(404).json({ message: "Funil não encontrado ou não pertence ao usuário." });
            res.json(updatedFunnel);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/funnels/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const funnelId = parseInt(req.params.id, 10);
            const success = await storage.deleteFunnel(funnelId, req.user!.id);
            if (!success) return res.status(404).json({ message: "Funil não encontrado ou não pertence ao usuário." });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    // --- Rotas de Etapas do Funil (Funnel Stages) ---
    app.post('/api/funnels/:funnelId/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const funnelId = parseInt(req.params.funnelId, 10);
            // Check if funnel belongs to user
            const funnel = await storage.getFunnelById(funnelId, req.user!.id);
            if (!funnel) return res.status(404).json({ message: "Funil pai não encontrado."});

            const stageData = insertFunnelStageSchema.omit({ funnelId: true }).parse(req.body);
            const newStage = await storage.createFunnelStage({ ...stageData, funnelId } as InsertFunnelStage);
            res.status(201).json(newStage);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const stageId = parseInt(req.params.stageId, 10);
            const stageData = insertFunnelStageSchema.partial().omit({funnelId: true}).parse(req.body); // funnelId should not be updatable this way

            // Additional check: ensure stage belongs to a funnel of the user
            const currentStage = await db.query.funnelStages.findFirst({
                where: eq(funnelStages.id, stageId),
                with: { funnel: true }
            });
            if (!currentStage || currentStage.funnel.userId !== req.user!.id) {
                 return res.status(404).json({ message: "Etapa não encontrada ou não pertence ao usuário." });
            }

            const updatedStage = await storage.updateFunnelStage(stageId, stageData);
            if (!updatedStage) return res.status(404).json({ message: "Etapa não encontrada." });
            res.json(updatedStage);
        } catch (error) {
            next(error);
        }
    });
    app.delete('/api/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const stageId = parseInt(req.params.stageId, 10);
            // Additional check: ensure stage belongs to a funnel of the user
             const currentStage = await db.query.funnelStages.findFirst({
                where: eq(funnelStages.id, stageId),
                with: { funnel: true }
            });
            if (!currentStage || currentStage.funnel.userId !== req.user!.id) {
                 return res.status(404).json({ message: "Etapa não encontrada ou não pertence ao usuário." });
            }

            const success = await storage.deleteFunnelStage(stageId);
            if (!success) return res.status(404).json({ message: "Etapa não encontrada." });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });


    // --- Rotas de Alertas ---
    app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { unread } = req.query;
            const alertsList = await storage.getAlerts(req.user!.id, unread === 'true');
            res.json(alertsList);
        } catch (error) {
            next(error);
        }
    });
    app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const alertId = parseInt(req.params.id, 10);
            const success = await storage.markAlertAsRead(alertId, req.user!.id);
            if (!success) return res.status(404).json({ message: "Alerta não encontrado ou não pertence ao usuário." });
            res.json({ message: "Alerta marcado como lido." });
        } catch (error) {
            next(error);
        }
    });
     app.post('/api/alerts/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const success = await storage.markAllAlertsAsRead(req.user!.id);
            if (!success) return res.status(500).json({ message: "Falha ao marcar todos os alertas como lidos." }); // Ou 200 com contagem 0
            res.json({ message: "Todos os alertas foram marcados como lidos." });
        } catch (error) {
            next(error);
        }
    });


    // --- NOVAS ROTAS PARA WHATSAPP CONNECTION ---
    app.post('/api/whatsapp/connection/connect', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        const whatsappService = getWhatsappServiceInstance(userId);
        // connectToWhatsApp é async e gerencia eventos internamente.
        // O status inicial ou QR code será atualizado no `activeConnections` map.
        whatsappService.connectToWhatsApp()
          .then(initialStatus => {
            // Retorna o status mais recente após a tentativa de conexão
            // Pode ser 'connecting', 'qr_code_needed', ou até 'connected' se a sessão for restaurada rapidamente.
            const currentStatus = WhatsappConnectionService.getStatus(userId);
            res.json(currentStatus || { status: 'error', message: 'Falha ao obter status após tentativa de conexão.', userId });
          })
          .catch(error => {
            console.error(`[User ${userId}] Erro explícito ao chamar connectToWhatsApp:`, error);
            const currentStatus = WhatsappConnectionService.getStatus(userId);
             res.status(500).json(currentStatus || { 
                status: 'error', 
                message: `Erro ao iniciar conexão com WhatsApp: ${(error as Error).message}`, 
                userId 
            });
          });
      } catch (error) {
        // Este catch é para erros síncronos na configuração da rota,
        // erros assíncronos de connectToWhatsApp são tratados no .catch() acima.
        console.error(`[User ${req.user?.id}] Erro síncrono na rota /connect:`, error);
        next(error);
      }
    });

    app.get('/api/whatsapp/connection/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const statusDetails = WhatsappConnectionService.getStatus(userId);
      if (statusDetails) {
        res.json(statusDetails);
      } else {
        // Se não houver status, significa que o usuário nunca tentou conectar ou a instância não foi criada.
        // Retornar um status padrão desconectado.
        res.json({
          userId,
          status: 'disconnected',
          qrCode: null,
          connectedPhoneNumber: undefined,
          lastError: undefined,
        } as WhatsappConnectionStatus);
      }
    });

    app.post('/api/whatsapp/connection/disconnect', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        const whatsappService = getWhatsappServiceInstance(userId); // Garante que temos a instância correta
        await whatsappService.disconnectWhatsApp();
        const currentStatus = WhatsappConnectionService.getStatus(userId);
        res.json(currentStatus || { status: 'disconnected', message: 'Desconectado com sucesso.', userId });
      } catch (error) {
        next(error);
      }
    });
    // --- FIM DAS NOVAS ROTAS PARA WHATSAPP CONNECTION ---


    // Servir arquivos estáticos de uploads
    app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));


    // Middlewares de tratamento de erro devem ser os últimos
    app.use(handleZodError);
    app.use(handleError);

    return app;
  }
}
