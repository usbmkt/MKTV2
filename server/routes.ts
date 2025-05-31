// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage"; // Assume que storage.ts exporta uma instância da DatabaseStorage
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  insertUserSchema,
  insertCampaignSchema,
  insertCreativeSchema,
  insertWhatsappMessageSchema,
  insertCopySchema, // Importando o schema atualizado
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertFunnelSchema,
  insertFunnelStageSchema,
  User, // Tipo User do seu schema
  allCopyPurposesConfig,
  aiResponseSchema, // Assegure que está corretamente definido em shared/schema.ts
} from "../shared/schema";
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
        console.log(`[FS_SETUP] Diretório criado: ${dir}`);
    }
});

// Configurações do Multer (mantidas)
const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para criativos.')); }, });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo inválido para assets de landing page. Apenas imagens são permitidas.')); } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov|avi/; if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) return cb(null, true); cb(new Error('Tipo de arquivo não permitido para anexos do MCP.')); }, });


export interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.log('[AUTH_BYPASS] Autenticação bypassada. Usando usuário mock.');
    req.user = {
      id: 1,
      username: 'admin_bypass',
      email: 'admin_bypass@example.com',
      password: 'hashed_bypass_password',
      createdAt: new Date(),
      updatedAt: new Date(),
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
        console.error('[AUTH_MIDDLEWARE] Token decodificado não contém um userId numérico:', decoded);
        return res.status(403).json({ error: 'Formato de token inválido: userId ausente ou não numérico.' });
    }
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      console.warn(`[AUTH_MIDDLEWARE] Usuário com ID ${decoded.userId} não encontrado no banco (token pode ser de um usuário deletado).`);
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
    console.error("[AUTH_MIDDLEWARE] Erro inesperado na verificação do token:", error);
    return res.status(500).json({ error: 'Erro interno ao verificar token.' });
  }
};

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    console.warn(`[ZOD_ERROR] ${req.method} ${req.originalUrl}:`, JSON.stringify(err.errors, null, 2));
    return res.status(400).json({
      error: "Erro de validação nos dados enviados.",
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        expected: (e as any).expected,
        received: (e as any).received
      }))
    });
  }
  next(err);
};

const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[HANDLE_ERROR] Erro não tratado para ${req.method} ${req.originalUrl}:`, err.message);
  if (err.stack && process.env.NODE_ENV === 'development') { // Mostrar stack apenas em dev
    console.error(err.stack);
  }

  if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: `Campo de arquivo inesperado: ${err.field}. Verifique o nome do campo esperado.` });
  }
  if (err.message && (err.message.includes("Tipo de arquivo inválido") || err.code === "LIMIT_FILE_SIZE" || err.code === "ENOENT")) {
    return res.status(400).json({ error: err.message });
  }
  // @ts-ignore
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
    console.log("[GEMINI_ROUTES] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[GEMINI_ROUTES] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI_ROUTES] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou inválida.");
}

async function doRegisterRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5-API', version: '1.0.0' }));

  // --- ROTAS DE AUTENTICAÇÃO ---
  // (Mantidas como no seu código anterior, já parecem corretas)
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { try { const userData = insertUserSchema.parse(req.body); const existingUserByEmail = await storage.getUserByEmail(userData.email); if (existingUserByEmail) { return res.status(409).json({ error: 'Usuário com este email já existe.' }); } const existingUserByUsername = await storage.getUserByUsername(userData.username); if (existingUserByUsername) { return res.status(409).json({ error: 'Nome de usuário já está em uso.' }); } const user = await storage.createUser(userData); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); const user = await storage.getUserByEmail(email); if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' }); const isValidPassword = await storage.validatePassword(password, user.password); if (!isValidPassword) return res.status(401).json({ error: 'Credenciais inválidas.' }); const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN ||'7d' }); res.json({ user: { id: user.id, username: user.username, email: user.email }, token }); } catch (error) { next(error); }});

  // --- ROTAS DE COPIES ---
  // Rota de Geração de Copy (mantida)
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... seu código original ... */ try { if (!req.user || typeof req.user.id !== 'number') return res.status(401).json({ error: 'Usuário não autenticado.'}); const { product, audience, objective, tone, copyPurposeKey, details, launchPhase } = req.body; if (!genAI) return res.status(503).json({ error: "IA indisponível." }); if (!product || !audience || !copyPurposeKey || !details || !launchPhase ) return res.status(400).json({ error: "Dados insuficientes." }); const currentPurposeConfig = allCopyPurposesConfig.find(p => p.key === copyPurposeKey); if (!currentPurposeConfig) return res.status(400).json({ error: "Finalidade desconhecida." }); const launchPhaseLabel = launchPhase === 'pre_launch' ? 'Pré-Lançamento' : launchPhase === 'launch' ? 'Lançamento' : launchPhase === 'post_launch' ? 'Pós-Lançamento' : 'Fase Desconhecida'; let prompt = `Contexto da IA: ... (seu prompt original) ...`; const baseInfoForEnhancer = { product, audience, objective, tone }; if (currentPurposeConfig.promptEnhancer) prompt = currentPurposeConfig.promptEnhancer(prompt, details, baseInfoForEnhancer); const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", generationConfig: { responseMimeType: "application/json", responseSchema: aiResponseSchema, maxOutputTokens: 3000, temperature: 0.75 }, safetySettings: [ /* ... */ ] }); console.log(`[GEMINI_COPIES_GENERATE] Enviando prompt (início): ${prompt.substring(0, 300)}...`); const result = await model.generateContent(prompt); const responseText = result.response.text(); console.log(`[GEMINI_COPIES_GENERATE] Resposta da IA (início): ${responseText.substring(0, 200)}...`); let generatedData; try { generatedData = typeof responseText === 'string' ? JSON.parse(responseText) : responseText; } catch (parseError) { console.error("[GEMINI_COPIES_GENERATE] Erro parsear JSON:", parseError, "Resposta Bruta:", responseText); throw new Error("IA retornou JSON inválido."); } res.json(generatedData); } catch (error) { next(error); } });

  // GET /api/copies (mantida)
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... seu código original ... */ try { if (!req.user || typeof req.user.id !== 'number') return res.status(401).json({ error: 'Não autenticado.'}); const cIdQ = req.query.campaignId as string | undefined; const phase = req.query.phase as string | undefined; const pKey = req.query.purposeKey as string | undefined; const sTerm = req.query.search as string | undefined; let cId: number | null | undefined; if (cIdQ === 'null' || cIdQ === '') cId = null; else if (cIdQ) {const p = parseInt(cIdQ); if (isNaN(p)) return res.status(400).json({ error: 'ID Campanha inválido.' }); cId = p;} res.json(await storage.getCopies(req.user.id, cId, phase, pKey, sTerm)); } catch (error) { next(error); }});

  // POST /api/copies (COM LOGS ADICIONADOS)
  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      console.log('[POST /api/copies] Handler da rota iniciado.');
      console.log('[POST /api/copies] req.user (do middleware authenticateToken):', JSON.stringify(req.user, null, 2));
      console.log('[POST /api/copies] req.user.id:', req.user?.id);
      console.log('[POST /api/copies] req.body (corpo da requisição):', JSON.stringify(req.body, null, 2));

      if (!req.user || typeof req.user.id !== 'number') {
        console.error('[POST /api/copies] FALHA: Usuário não autenticado corretamente ou req.user.id não é um número.');
        return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
      }

      const dataToValidate = {
        ...req.body, // Todos os campos enviados pelo cliente
        userId: req.user.id, // Adiciona/sobrescreve userId com o do usuário autenticado
      };
      console.log('[POST /api/copies] dataToValidate (antes do Zod parse):', JSON.stringify(dataToValidate, null, 2));

      // Validação com Zod usando insertCopySchema (que agora inclui validação para userId)
      const validatedData = insertCopySchema.parse(dataToValidate);
      console.log('[POST /api/copies] validatedData (DEPOIS do Zod parse):', JSON.stringify(validatedData, null, 2));

      // Chama o método de storage para criar a copy no banco
      const newCopy = await storage.createCopy(validatedData);
      res.status(201).json(newCopy);

    } catch (error) {
      console.error('[POST /api/copies] Erro capturado no handler da rota:', error);
      next(error); // Passa o erro para os middlewares de tratamento de erro (handleZodError, handleError)
    }
  });

  // PUT /api/copies/:id (mantida e ajustada)
  app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... seu código original com ajustes para não permitir update de userId etc ... */ try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido'}); const { userId, id: bodyId, createdAt, lastUpdatedAt, ...updateDataFromClient } = req.body; const validatedData = insertCopySchema.partial().parse(updateDataFromClient); const updatedCopy = await storage.updateCopy(id, validatedData, req.user.id); if (!updatedCopy) return res.status(404).json({ error: 'Copy não encontrada ou falha na atualização.'}); res.json(updatedCopy); } catch (error) { next(error); }});
  // DELETE /api/copies/:id (mantida)
  app.delete('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... seu código original ... */ try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({error: 'ID inválido'}); const success = await storage.deleteCopy(id, req.user.id); if (!success) return res.status(404).json({ error: 'Copy não encontrada.'}); res.status(200).json({ message: 'Copy excluída.'});} catch (error) {next(error);}});

  // --- OUTRAS ROTAS (Dashboard, Campaigns, Creatives, Alerts, Budgets, LandingPages, Chat, Funnels) ---
  // MANTENHA SUAS OUTRAS ROTAS AQUI, certificando-se de que:
  // 1. Usam `authenticateToken`
  // 2. Acessam `req.user!.id` (ou `req.user.id` com checagem prévia) para obter o userId.
  // 3. Ao criar/atualizar entidades que pertencem a um usuário, passam o `userId` (de `req.user.id`)
  //    para o schema Zod ou diretamente para a função de storage.
  // Exemplo para /api/dashboard (já parecia correto no seu código)
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { if (!req.user?.id) return res.status(401).json({error: 'Não autenticado'}); res.json(await storage.getDashboardData(req.user.id, req.query.timeRange as string || '30d')); } catch (error) { next(error); }});
  // ... adicione o restante das suas rotas aqui, seguindo o padrão ...


  // Servir arquivos estáticos da pasta de uploads
  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));

  // Middlewares de tratamento de erro DEVEM SER OS ÚLTIMOS
  app.use(handleZodError);
  app.use(handleError);

  const httpServer = createServer(app);
  return httpServer;
}

export const RouterSetup = {
  registerRoutes: doRegisterRoutes
};
