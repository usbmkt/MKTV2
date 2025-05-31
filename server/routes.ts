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
  insertCopySchema, // Usar o schema atualizado
  insertAlertSchema,
  insertBudgetSchema,
  insertLandingPageSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertFunnelSchema,
  insertFunnelStageSchema,
  User,
  // Não precisamos importar Copy aqui, pois o tipo InsertCopy já é usado
} from "../shared/schema";
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config';
// import { handleMCPConversation } from './mcp_handler'; // Se for usar MCP

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
  user?: User; // User type from shared/schema
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... (seu middleware de autenticação) ... */ if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin', email: 'admin@usbmkt.com', password: 'hashed_password', createdAt: new Date(), updatedAt: new Date() }; return next(); } const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (!token) return res.status(401).json({ error: 'Token não fornecido.' }); try { const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; }; const user = await storage.getUser(decoded.userId); if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' }); req.user = user; next(); } catch (error) { if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' }); if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' }); console.error("[AUTH_MIDDLEWARE] Erro token:", error); return res.status(500).json({ error: 'Erro interno ao verificar token.' }); }};
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (seu handler de erro Zod) ... */ if (err instanceof ZodError) { return res.status(400).json({ error: "Erro de validação", details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))}); } next(err); };
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => { /* ... (seu handler de erro geral) ... */ console.error(`[HANDLE_ERROR] ${req.method} ${req.originalUrl}:`, err.message, err.stack ? err.stack.substring(0, 300) : ''); if (err instanceof multer.MulterError) return res.status(400).json({ error: `Erro no upload: ${err.message}`}); if (err.message?.includes('Tipo de arquivo inválido')) return res.status(400).json({ error: err.message }); if (err.constructor?.name === 'GoogleGenerativeAIFetchError') return res.status((err as any).status || 500).json({ error: `Erro na IA: ${(err as any).message}` }); res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno do servidor.' });};

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "SUA_CHAVE_API_GEMINI_AQUI" && GEMINI_API_KEY.length > 10) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("[GEMINI_MAIN] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("[GEMINI_MAIN] Falha ao inicializar o SDK do Gemini:", error);
    genAI = null;
  }
} else {
  console.warn("[GEMINI_MAIN] Chave da API do Gemini (GEMINI_API_KEY) não configurada ou inválida.");
}

export async function registerRoutes(app: Express): Promise<HttpServer> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MKTV5', version: '1.0.0' }));

  // --- Rotas de Autenticação, Campanhas, Criativos, etc. (manter as suas) ---
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  // ... (outras rotas de campanha)
  app.get('/api/creatives', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  app.post('/api/creatives', authenticateToken, creativesUpload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { /* ... */ });
  // ... (outras rotas de criativos)


  // --- Rota de Geração de Copy (Mantida para IA simples, se ainda usada) ---
  // Se esta rota não for mais usada para a nova página de Copy, pode ser removida ou adaptada.
  app.post('/api/copies/generate-simple', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ... (sua lógica anterior para geração simples de copy, se houver)
    // Esta rota agora é diferente da que o frontend avançado chamará
    res.status(501).json({ error: "Endpoint de geração simples não implementado ou obsoleto." });
  });

  // --- Rota de Geração de Copy AVANÇADA (CHAMADA PELO FRONTEND) ---
  app.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // O frontend já está fazendo a chamada direta para a API Gemini.
      // Este endpoint de backend seria o local ideal para mover essa lógica.
      // Por agora, se o frontend faz a chamada direta, este endpoint pode não ser usado para a GERAÇÃO em si.
      // Mas ele será usado para SALVAR a copy gerada.
      // Se você quiser que o backend faça a chamada Gemini, a lógica do frontend (construção do prompt, chamada fetch)
      // seria movida para cá.

      // Para este exemplo, vamos assumir que o frontend já gerou a copy e está enviando para salvar.
      // O payload enviado pelo frontend para SALVAR uma copy gerada seria diferente do payload para GERAR.
      // A rota POST /api/copies abaixo é para criar/salvar uma copy.

      // Se este endpoint fosse para GERAR a copy no backend:
      // const { product, audience, objective, tone, copyPurposeKey, details } = req.body;
      // if (!genAI) return res.status(503).json({ error: "Serviço de IA indisponível." });
      // ... (lógica de construção do prompt e chamada ao Gemini aqui) ...
      // const geminiResponse = await model.generateContent(...);
      // res.json(JSON.parse(geminiResponse.response.text()));

      res.status(501).json({ error: "A geração de copy avançada deve ser feita no frontend (protótipo) ou adaptada neste endpoint para produção." });

    } catch (error) {
      console.error('[COPIES_GENERATE_ADVANCED_BACKEND] Erro:', error);
      next(error);
    }
  });
  
  // --- ROTAS CRUD para COPIES (ATUALIZADAS) ---
  app.get('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const campaignIdQuery = req.query.campaignId as string | undefined;
      // Adicionar mais filtros se necessário (ex: phase, purpose, search)
      const campaignId = campaignIdQuery === 'null' || campaignIdQuery === '' || campaignIdQuery === undefined 
        ? undefined 
        : (campaignIdQuery ? parseInt(campaignIdQuery) : undefined);
      
      // Validação simples do campaignId se presente
      if (campaignIdQuery && campaignIdQuery !== 'null' && campaignIdQuery !== '' && (campaignId === undefined || isNaN(campaignId))) {
        return res.status(400).json({ error: 'ID da campanha inválido para filtro.' });
      }
      
      const userCopies = await storage.getCopies(req.user!.id, campaignId);
      res.json(userCopies);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = {
        ...req.body,
        userId: req.user!.id, // Adicionar userId do usuário autenticado
        // campaignId é opcional e será tratado pelo Zod schema
      };
      
      // Validar usando o insertCopySchema atualizado
      const validatedData = insertCopySchema.parse(dataToValidate);
      
      // Os campos JSONB (details, baseInfo, fullGeneratedResponse) devem ser objetos JS.
      // Se o frontend enviar strings JSON, precisaria de JSON.parse aqui.
      // Mas o frontend já deve estar enviando como objetos.

      const newCopy = await storage.createCopy(validatedData);
      res.status(201).json(newCopy);
    } catch (error) {
      // O handleZodError já tratará erros de validação Zod
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

  // Adicionar rota PUT para atualizar copies (se necessário no futuro)
  app.put('/api/copies/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'ID da copy inválido.' });

        const dataToValidate = {
            ...req.body,
            // userId não é parte do payload de update, é usado para verificar permissão
        };
        // Usar .partial() para permitir atualização de campos específicos
        const validatedData = insertCopySchema.partial().parse(dataToValidate);
        
        const updatedCopy = await storage.updateCopy(id, validatedData, req.user!.id);
        if (!updatedCopy) {
            return res.status(404).json({ error: 'Copy não encontrada ou não pertence ao usuário.' });
        }
        res.json(updatedCopy);
    } catch (error) {
        next(error);
    }
  });


  // --- Outras rotas (alerts, budgets, landingpages, etc.) ---
  app.get('/api/alerts', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  app.put('/api/alerts/:id/read', authenticateToken, async (req: AuthenticatedRequest, res, next) => { /* ... */ });
  // ... (manter suas outras rotas como estão)


  app.use(`/${UPLOADS_ROOT_DIR}`, express.static(path.join(process.cwd(), UPLOADS_ROOT_DIR)));
  app.use(handleZodError); // Deve vir antes do handleError geral para ZodError
  app.use(handleError);   // Handler de erro geral

  const httpServer = createServer(app);
  return httpServer;
}
