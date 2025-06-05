// server/routes.ts
import type { Express, Request, Response, NextFunction, ErrorRequestHandler } from "express";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { storage } from "./storage"; 
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as schemaShared from "../shared/schema"; 
import { ZodError } from "zod";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JWT_SECRET, GEMINI_API_KEY } from './config'; 
import { WhatsappConnectionService } from './services/whatsapp-connection.service';

// --- Configuração Inicial (Multer, etc.) ---
const UPLOADS_ROOT_DIR = 'uploads';
const LP_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'lp-assets');
const CREATIVES_ASSETS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'creatives-assets');
const MCP_ATTACHMENTS_DIR = path.resolve(UPLOADS_ROOT_DIR, 'mcp-attachments');
[UPLOADS_ROOT_DIR, LP_ASSETS_DIR, CREATIVES_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const creativesUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 15 * 1024 * 1024 } });
const lpAssetUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, LP_ASSETS_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_').toLowerCase()) }), limits: { fileSize: 5 * 1024 * 1024 } });
const mcpAttachmentUpload = multer({ storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR), filename: (req, file, cb) => { const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname)); } }), limits: { fileSize: 5 * 1024 * 1024 } });

// --- Tipos e Middlewares ---
export interface AuthenticatedRequest extends Request { user?: schemaShared.User; }
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (process.env.FORCE_AUTH_BYPASS === 'true') { req.user = { id: 1, username: 'admin_bypass', email: 'admin_bypass@example.com', password: 'hashed_bypass_password', createdAt: new Date(), updatedAt: new Date() }; return next(); }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        if (typeof decoded.userId !== 'number') return res.status(403).json({ error: 'Formato de token inválido.' });
        const user = await storage.getUser(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Token expirado.' });
        if (error instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Token inválido.' });
        next(error);
    }
};

// --- Gerenciamento do Serviço WhatsApp e IA ---
const whatsappServiceInstances = new Map<number, WhatsappConnectionService>();
function getWhatsappServiceForUser(userId: number): WhatsappConnectionService {
    if (!whatsappServiceInstances.has(userId)) {
        whatsappServiceInstances.set(userId, new WhatsappConnectionService(userId));
    }
    return whatsappServiceInstances.get(userId)!;
}
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); } catch (error) { console.error("[GEMINI] Falha ao inicializar o SDK:", error); }}


// --- Função Principal de Registro de Rotas ---
async function doRegisterRoutes(app: Express): Promise<HttpServer> {
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    const publicRouter = express.Router();
    const apiRouter = express.Router();
    
    // --- Rotas Públicas ---
    publicRouter.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    publicRouter.post('/auth/register', async (req, res, next) => { /* ... (lógica de registro) ... */ });
    publicRouter.post('/auth/login', async (req, res, next) => { /* ... (lógica de login) ... */ });
    publicRouter.get('/auth/login', (req, res) => res.status(405).json({ error: 'Método não permitido. Utilize POST para fazer login.' }));
  
    // --- Middleware de Autenticação para rotas protegidas ---
    apiRouter.use(authenticateToken);
    
    // --- ROTAS PROTEGIDAS (API) ---

    // Dashboard
    apiRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => { try { res.json(await storage.getDashboardData(req.user!.id, '30d')); } catch (e) { next(e); } });

    // Rotas para Campanhas, Criativos, Orçamentos, etc. (como definido anteriormente)
    // ...
    
    // --- ROTAS PARA COPY E IA (NOVAS) ---
    apiRouter.post('/copies/generate', async (req: AuthenticatedRequest, res, next) => {
        try {
            if (!genAI) return res.status(503).json({ error: "Serviço de IA não configurado." });
            const { product, audience, objective, tone, copyPurposeKey, details, launchPhase } = req.body;
            if (!product || !audience || !copyPurposeKey || !details || !launchPhase) {
                return res.status(400).json({ error: "Informações insuficientes para gerar a copy." });
            }
            const currentPurposeConfig = schemaShared.allCopyPurposesConfig.find(p => p.key === copyPurposeKey);
            if (!currentPurposeConfig) return res.status(400).json({ error: "Finalidade da copy desconhecida." });

            let prompt = `... (SEU PROMPT DETALHADO PARA A IA VAI AQUI) ...`; // Construa seu prompt como na lógica do frontend
            
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash-latest",
                generationConfig: { responseMimeType: "application/json", responseSchema: schemaShared.aiResponseSchema as any }
            });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const generatedData = JSON.parse(responseText);
            res.json(generatedData);
        } catch (error) {
            next(error);
        }
    });

    apiRouter.get('/copies', async (req: AuthenticatedRequest, res, next) => {
        try {
            const { campaignId, phase, purpose, search } = req.query;
            const copies = await storage.getCopies(
                req.user!.id,
                campaignId ? Number(campaignId) : undefined,
                phase as string,
                purpose as string,
                search as string
            );
            res.json(copies);
        } catch (e) { next(e); }
    });
    
    apiRouter.post('/copies', async (req: AuthenticatedRequest, res, next) => {
        try {
            const validatedData = schemaShared.insertCopySchema.parse({ ...req.body, userId: req.user!.id });
            const newCopy = await storage.createCopy(validatedData);
            res.status(201).json(newCopy);
        } catch (e) { next(e); }
    });

    apiRouter.put('/copies/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            const id = parseInt(req.params.id);
            const { userId, ...updateData } = req.body;
            const validatedData = schemaShared.insertCopySchema.partial().parse(updateData);
            const updatedCopy = await storage.updateCopy(id, validatedData, req.user!.id);
            if (!updatedCopy) return res.status(404).json({ error: 'Copy não encontrada.' });
            res.json(updatedCopy);
        } catch (e) { next(e); }
    });

    apiRouter.delete('/copies/:id', async (req: AuthenticatedRequest, res, next) => {
        try {
            const id = parseInt(req.params.id);
            const success = await storage.deleteCopy(id, req.user!.id);
            if (!success) return res.status(404).json({ error: 'Copy não encontrada.' });
            res.status(200).json({ message: 'Copy excluída.' });
        } catch (e) { next(e); }
    });
    
    // --- FIM DAS ROTAS DE COPY ---
    
    // ... (restante das rotas: Flows, WhatsApp, etc.)

    // Registrar os routers
    app.use('/api', publicRouter);
    app.use('/api', apiRouter);

    // Middlewares de erro no final
    const handleZodError: ErrorRequestHandler = (err, req, res, next) => { /* ... */ };
    const handleError: ErrorRequestHandler = (err, req, res, next) => { /* ... */ };
    app.use(handleZodError);
    app.use(handleError);
    
    const httpServer = createServer(app);
    return httpServer;
}

export const RouterSetup = {
    registerRoutes: doRegisterRoutes
};
