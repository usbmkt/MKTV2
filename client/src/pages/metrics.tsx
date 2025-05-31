import express, { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

import { storage, IStorage, DatabaseStorage } from './storage';
import {
  insertUserSchema,
  User,
  insertCampaignSchema,
  Campaign,
  insertCreativeSchema,
  Creative,
  insertCopySchema,
  Copy,
  insertBudgetSchema,
  Budget,
  insertLandingPageSchema,
  LandingPage,
  insertFunnelSchema,
  Funnel,
  insertFunnelStageSchema,
  FunnelStage,
  SelectMetric,
  insertMetricSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  ChatSession,
  ChatMessage,
  chatSenderEnum
} from '../../shared/schema';
import { JWT_SECRET, GEMINI_API_KEY, GRAPESJS_STUDIO_LICENSE_KEY, UPLOADS_BASE_URL_PATH } from './config';
import { handleMcpAction } from './mcp_handler';


const FORCE_AUTH_BYPASS = process.env.FORCE_AUTH_BYPASS === 'true';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads'); // Relativo à pasta 'dist' após o build
const CREATIVES_ASSETS_DIR = path.join(UPLOADS_DIR, 'creatives-assets');
const LP_ASSETS_DIR = path.join(UPLOADS_DIR, 'lp-assets');
const MCP_ATTACHMENTS_DIR = path.join(UPLOADS_DIR, 'mcp-attachments');

// Garantir que os diretórios de upload existam
[UPLOADS_DIR, CREATIVES_ASSETS_DIR, LP_ASSETS_DIR, MCP_ATTACHMENTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});


const genAI = new GoogleGenerativeAI(GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ou gemini-pro

const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


const router = Router();

// Middleware de autenticação
const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  if (FORCE_AUTH_BYPASS && process.env.NODE_ENV === 'development') {
    // Em desenvolvimento e com bypass ativado, simula um usuário admin
    const mockUser = await storage.getUserByEmail('admin@usbmkt.com');
    if (mockUser) {
        req.user = mockUser;
    } else {
        // Se o admin mock não existir, cria um usuário mock simples para não quebrar
        req.user = { id: 1, email: 'dev@example.com', username: 'Dev User' } as User;
    }
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // Unauthorized

  jwt.verify(token, JWT_SECRET as string, async (err: any, decoded: any) => {
    if (err) return res.sendStatus(403); // Forbidden
    try {
      const user = await storage.getUser(decoded.userId);
      if (!user) return res.sendStatus(403); // User not found
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });
};

// Multer setup for creatives
const creativesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CREATIVES_ASSETS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const creativesUpload = multer({
  storage: creativesStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não suportado. Use imagens (jpeg, png, gif) ou vídeos (mp4, mov, avi).'));
  }
});

// Multer setup for Landing Page assets (GrapesJS)
const lpAssetStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, LP_ASSETS_DIR),
    filename: (req, file, cb) => {
        // Manter o nome original do arquivo para GrapesJS ou gerar um nome único
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'lp-asset-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const lpAssetUpload = multer({
    storage: lpAssetStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por asset
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Tipo de arquivo não suportado para assets de Landing Page.'));
    }
});

// Multer setup for MCP attachments
const mcpAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MCP_ATTACHMENTS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'mcp-attachment-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const mcpAttachmentUpload = multer({
  storage: mcpAttachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  // Adicionar fileFilter se necessário
});


// Middleware de tratamento de erro Zod
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Erro de validação",
      errors: err.flatten().fieldErrors,
    });
  }
  next(err);
};

// Middleware de tratamento de erro genérico
const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err); // Log do erro no servidor

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Erro no upload do arquivo: ${err.message}` });
  }

  if (err.message && err.message.includes('GoogleGenerativeAI')) {
    return res.status(503).json({ message: 'Erro ao comunicar com o serviço de IA. Tente novamente mais tarde.' });
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    message: err.message || "Ocorreu um erro inesperado no servidor.",
    // error: process.env.NODE_ENV === 'development' ? err : {} // Não expor stack trace em produção
  });
};


// Rotas

// Auth
router.post('/auth/register', async (req, res, next) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(409).json({ message: "Email já cadastrado." });
    }
    const user = await storage.createUser(userData);
    if (!user) return res.status(500).json({ message: "Erro ao criar usuário." });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET as string, { expiresIn: '7d' });
    res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios." });
    }
    const user = await storage.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }
    const isValid = await storage.validatePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET as string, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/me', authenticateToken, (req: Request, res: Response) => {
    const user = req.user as User;
    res.json({ user: { id: user.id, username: user.username, email: user.email } });
});


// Health check
router.get('/health', (req, res) => res.status(200).send('OK'));

// Dashboard
router.get('/dashboard', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as User;
        const dashboardData = await storage.getDashboardData(user.id!);
        res.json(dashboardData);
    } catch (error) {
        next(error);
    }
});


// Campaigns
router.post('/campaigns', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignData = insertCampaignSchema.parse({ ...req.body, userId: user.id });
    const campaign = await storage.createCampaign(campaignData);
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.get('/campaigns', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignsList = await storage.getCampaigns(user.id!);
    res.json(campaignsList);
  } catch (error) {
    next(error);
  }
});

router.get('/campaigns/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = parseInt(req.params.id);
    const campaign = await storage.getCampaignById(campaignId, user.id!);
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada." });
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

router.put('/campaigns/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = parseInt(req.params.id);
    // Validar apenas os campos enviados, não exigir userId no body
    const campaignData = insertCampaignSchema.partial().parse(req.body);
    const updatedCampaign = await storage.updateCampaign(campaignId, user.id!, campaignData);
    if (!updatedCampaign) return res.status(404).json({ message: "Campanha não encontrada para atualização." });
    res.json(updatedCampaign);
  } catch (error) {
    next(error);
  }
});

router.delete('/campaigns/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = parseInt(req.params.id);
    const result = await storage.deleteCampaign(campaignId, user.id!);
    if (!result.success) return res.status(404).json({ message: "Campanha não encontrada para exclusão." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/campaigns/:id/metrics-summary', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const campaignId = parseInt(req.params.id);
        const summary = await storage.getCampaignMetricsSummary(campaignId, user.id!);
        if (!summary) return res.status(404).json({ message: "Sumário de métricas não encontrado para esta campanha." });
        res.json(summary);
    } catch (error) {
        next(error);
    }
});

// Creatives
router.post('/creatives', authenticateToken, creativesUpload.single('file'), async (req, res, next) => {
  try {
    const user = req.user as User;
    const creativeData = insertCreativeSchema.parse({
      ...req.body,
      userId: user.id,
      campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : undefined,
      fileUrl: req.file ? `${UPLOADS_BASE_URL_PATH}/creatives-assets/${req.file.filename}` : req.body.fileUrl,
      thumbnailUrl: req.body.thumbnailUrl || (req.file && req.file.mimetype.startsWith('image/') ? `${UPLOADS_BASE_URL_PATH}/creatives-assets/${req.file.filename}` : undefined),
    });
    const creative = await storage.createCreative(creativeData);
    res.status(201).json(creative);
  } catch (error) {
    next(error);
  }
});

router.get('/creatives', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
    const creativesList = await storage.getCreatives(user.id!, campaignId);
    res.json(creativesList);
  } catch (error) {
    next(error);
  }
});

router.get('/creatives/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const creativeId = parseInt(req.params.id);
    const creative = await storage.getCreativeById(creativeId, user.id!);
    if (!creative) return res.status(404).json({ message: "Criativo não encontrado." });
    res.json(creative);
  } catch (error) {
    next(error);
  }
});

router.put('/creatives/:id', authenticateToken, creativesUpload.single('file'), async (req, res, next) => {
  try {
    const user = req.user as User;
    const creativeId = parseInt(req.params.id);
    const existingCreative = await storage.getCreativeById(creativeId, user.id!);
    if (!existingCreative) return res.status(404).json({ message: "Criativo não encontrado para atualização." });

    let fileUrl = existingCreative.fileUrl;
    if (req.file) {
      fileUrl = `${UPLOADS_BASE_URL_PATH}/creatives-assets/${req.file.filename}`;
      // Opcional: remover arquivo antigo se o nome mudou e não for usado em outro lugar
      // if (existingCreative.fileUrl && existingCreative.fileUrl !== fileUrl) {
      //   const oldFilePath = path.join(CREATIVES_ASSETS_DIR, path.basename(existingCreative.fileUrl));
      //   if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      // }
    }

    const creativeData = insertCreativeSchema.partial().parse({
        ...req.body,
        campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : undefined,
        fileUrl,
        thumbnailUrl: req.body.thumbnailUrl || (req.file && req.file.mimetype.startsWith('image/') ? fileUrl : existingCreative.thumbnailUrl),
    });

    const updatedCreative = await storage.updateCreative(creativeId, user.id!, creativeData);
    res.json(updatedCreative);
  } catch (error) {
    next(error);
  }
});

router.delete('/creatives/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const creativeId = parseInt(req.params.id);
    const creative = await storage.getCreativeById(creativeId, user.id!);
    if (!creative) return res.status(404).json({ message: "Criativo não encontrado." });

    // Opcional: remover arquivo do sistema de arquivos
    // if (creative.fileUrl) {
    //   const filePath = path.join(CREATIVES_ASSETS_DIR, path.basename(creative.fileUrl));
    //   if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // }

    const result = await storage.deleteCreative(creativeId, user.id!);
    if (!result.success) return res.status(404).json({ message: "Erro ao excluir criativo."})
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Metrics
router.post('/metrics', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const metricData = insertMetricSchema.parse({ ...req.body, userId: user.id });
        const metric = await storage.createMetric(metricData);
        res.status(201).json(metric);
    } catch (error) {
        next(error);
    }
});

router.get('/metrics/campaign/:campaignId', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const campaignId = parseInt(req.params.campaignId);
        // Verificar se a campanha pertence ao usuário já é feito em storage.getMetricsForCampaign
        const metricsList = await storage.getMetricsForCampaign(campaignId, user.id!);
        res.json(metricsList);
    } catch (error) {
        next(error);
    }
});

// NOVO ENDPOINT GERAL DE MÉTRICAS
router.get('/metrics', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        if (!user || typeof user.id !== 'number') {
            return res.status(401).json({ message: 'Usuário não autenticado ou ID ausente' });
        }
        const userMetrics = await storage.getUserMetrics(user.id);
        res.json(userMetrics);
    } catch (error) {
        next(error);
    }
});


// Copies
router.post('/copies', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const copyData = insertCopySchema.parse({
        ...req.body,
        userId: user.id,
        campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : undefined,
    });
    const copy = await storage.createCopy(copyData);
    res.status(201).json(copy);
  } catch (error) {
    next(error);
  }
});

router.get('/copies', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
    const copiesList = await storage.getCopies(user.id!, campaignId);
    res.json(copiesList);
  } catch (error) {
    next(error);
  }
});

router.post('/copies/generate', authenticateToken, async (req, res, next) => {
    try {
        const { productInfo, targetAudience, objective, tone, numSuggestions = 3 } = req.body;
        if (!productInfo || !targetAudience || !objective || !tone) {
            return res.status(400).json({ message: "Informações do produto, público-alvo, objetivo e tom são obrigatórios." });
        }

        const prompt = `
            Você é um especialista em copywriting para marketing digital.
            Gere ${numSuggestions} sugestões de copy para um anúncio com as seguintes características:

            Produto/Serviço: ${productInfo}
            Público-alvo: ${targetAudience}
            Objetivo da campanha: ${objective}
            Tom de voz: ${tone}

            Para cada sugestão, forneça:
            - Headline (curta e impactante, máximo 10 palavras)
            - Body (texto principal, máximo 50 palavras, destacando benefícios)
            - CTA (Call to Action claro e direto, máximo 5 palavras)

            Formato da Resposta (JSON Array):
            [
                { "headline": "...", "body": "...", "cta": "..." },
                { "headline": "...", "body": "...", "cta": "..." }
            ]
        `;

        const result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        });
        
        let text = '';
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            text += chunkText;
        }
        
        // Tentar limpar e parsear o JSON
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedCopies = JSON.parse(cleanedText);

        res.json(generatedCopies);

    } catch (error) {
        console.error("Erro na geração de cópias IA:", error);
        if (error instanceof SyntaxError) {
            return res.status(500).json({ message: "Erro ao parsear a resposta da IA. A resposta não foi um JSON válido."});
        }
        next(error);
    }
});


// Alerts
router.get('/alerts', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const readQuery = req.query.read;
        let read: boolean | undefined = undefined;
        if (readQuery === 'true') read = true;
        if (readQuery === 'false') read = false;

        const alertsList = await storage.getAlerts(user.id!, read);
        res.json(alertsList);
    } catch (error) {
        next(error);
    }
});

router.put('/alerts/:id/read', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const alertId = parseInt(req.params.id);
        const alert = await storage.markAlertAsRead(alertId, user.id!);
        if (!alert) return res.status(404).json({ message: "Alerta não encontrado." });
        res.json(alert);
    } catch (error) {
        next(error);
    }
});

router.put('/alerts/read-all', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const result = await storage.markAllAlertsAsRead(user.id!);
        res.json(result);
    } catch (error) {
        next(error);
    }
});


// Budgets
router.post('/budgets', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const budgetData = insertBudgetSchema.parse({
        ...req.body,
        userId: user.id,
        campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : undefined,
        // totalBudget e spentAmount são strings no schema, mas virão como números do JSON. Zod cuidará disso.
    });
    const budget = await storage.createBudget(budgetData);
    res.status(201).json(budget);
  } catch (error) {
    next(error);
  }
});

router.get('/budgets', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user as User;
    const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
    const budgetsList = await storage.getBudgets(user.id!, campaignId);
    res.json(budgetsList);
  } catch (error) {
    next(error);
  }
});


// Landing Pages
router.post('/landingpages', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const lpData = insertLandingPageSchema.parse({ ...req.body, userId: user.id });
        // Verificar se o slug já existe para este usuário ou globalmente (decidir regra de negócio)
        // Por ora, o schema do banco tem 'unique' no slug, então o DB vai barrar se for duplicado globalmente.
        const landingPage = await storage.createLandingPage(lpData);
        res.status(201).json(landingPage);
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'landing_pages_slug_unique') { // Código de erro do PostgreSQL para unique violation
            return res.status(409).json({ message: 'Este slug já está em uso. Por favor, escolha outro.' });
        }
        next(error);
    }
});

router.get('/landingpages', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const landingPagesList = await storage.getLandingPages(user.id!);
        res.json(landingPagesList);
    } catch (error) {
        next(error);
    }
});

router.get('/landingpages/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const lpId = parseInt(req.params.id);
        const landingPage = await storage.getLandingPageById(lpId, user.id!);
        if (!landingPage) return res.status(404).json({ message: "Landing Page não encontrada." });
        res.json(landingPage);
    } catch (error) {
        next(error);
    }
});

// Rota pública para LP, não requer autenticação
router.get('/landingpages/slug/:slug', async (req, res, next) => {
    try {
        const slug = req.params.slug;
        const landingPage = await storage.getLandingPageBySlug(slug);
        if (!landingPage || landingPage.status !== 'published') {
            return res.status(404).json({ message: "Landing Page não encontrada ou não publicada." });
        }
        res.json({
            id: landingPage.id,
            name: landingPage.name,
            grapesJsData: landingPage.grapesJsData, // Ou apenas o HTML/CSS compilado se preferir
            // Não expor studioProjectId ou userId aqui
        });
    } catch (error) {
        next(error);
    }
});


router.get('/landingpages/studio-project/:studioProjectId', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User; // Para verificar permissão, embora GrapesJS Studio possa ter sua própria lógica
        const { studioProjectId } = req.params;
        const lp = await storage.getLandingPageByStudioProjectId(studioProjectId);

        if (!lp || lp.userId !== user.id) { // Verifica se a LP pertence ao usuário autenticado
            return res.status(404).json({ message: 'Projeto da Landing Page não encontrado ou acesso negado.' });
        }
        // Retornar os dados no formato esperado pelo GrapesJS Studio SDK (geralmente o grapesJsData)
        res.json(lp.grapesJsData || {}); // Ou um formato específico que o SDK onProjectLoad espera
    } catch (error) {
        next(error);
    }
});


router.put('/landingpages/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const lpId = parseInt(req.params.id);
        const lpData = insertLandingPageSchema.partial().omit({ userId: true }).parse(req.body);

        if (lpData.slug) {
             const existingBySlug = await storage.getLandingPageBySlug(lpData.slug);
             if (existingBySlug && existingBySlug.id !== lpId) {
                 return res.status(409).json({ message: 'Este slug já está em uso por outra Landing Page.' });
             }
        }

        const updatedLp = await storage.updateLandingPage(lpId, user.id!, lpData);
        if (!updatedLp) return res.status(404).json({ message: "Landing Page não encontrada para atualização." });
        res.json(updatedLp);
    } catch (error) {
         if (error.code === '23505' && error.constraint === 'landing_pages_slug_unique') {
            return res.status(409).json({ message: 'Este slug já está em uso. Por favor, escolha outro.' });
        }
        next(error);
    }
});

router.delete('/landingpages/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const lpId = parseInt(req.params.id);
        const result = await storage.deleteLandingPage(lpId, user.id!);
        if (!result.success) return res.status(404).json({ message: "Landing Page não encontrada para exclusão." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});


// GrapesJS Studio Asset Manager Endpoints
router.post('/assets/lp-upload', authenticateToken, lpAssetUpload.array('files'), (req: Request, res: Response) => {
    // GrapesJS espera um array de objetos com `src` e outros metadados opcionais
    const user = req.user as User; // Para possível lógica de pastas por usuário no futuro
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const filesData = (req.files as Express.Multer.File[]).map(file => ({
        src: `${UPLOADS_BASE_URL_PATH}/lp-assets/${file.filename}`, // URL completa para o asset
        name: file.originalname,
        type: file.mimetype.startsWith('image/') ? 'image' : 'file', // GrapesJS usa 'image' para preview
        height: 100, // Placeholder, GrapesJS pode precisar disso
        width: 100,  // Placeholder
    }));
    res.json({ data: filesData }); // GrapesJS Studio espera o array dentro de uma chave "data"
});

// GrapesJS não tem um endpoint padrão de "delete" asset no backend.
// A remoção é geralmente feita no cliente e o estado do editor é salvo.
// Se precisar de remoção física de arquivos, implemente uma rota customizada.
router.post('/assets/lp-delete', authenticateToken, (req, res, next) => {
    try {
        const user = req.user as User;
        const { src } = req.body; // src do arquivo a ser deletado (URL completa)
        if (!src) {
            return res.status(400).json({ error: 'Caminho do arquivo (src) não fornecido.' });
        }

        const filename = path.basename(src);
        const filePath = path.join(LP_ASSETS_DIR, filename);

        // Verificação de segurança básica: garantir que o arquivo está no diretório esperado
        if (filePath.startsWith(LP_ASSETS_DIR) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.json({ success: true, message: `Asset ${filename} removido.` });
        } else {
            return res.status(404).json({ error: `Asset ${filename} não encontrado ou acesso negado.` });
        }
    } catch (error) {
        next(error);
    }
});


// Funnels
router.post('/funnels', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelData = insertFunnelSchema.parse({ ...req.body, userId: user.id });
        const funnel = await storage.createFunnel(funnelData);
        res.status(201).json(funnel);
    } catch (error) {
        next(error);
    }
});

router.get('/funnels', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelsList = await storage.getFunnels(user.id!);
        res.json(funnelsList);
    } catch (error) {
        next(error);
    }
});

router.get('/funnels/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelId = parseInt(req.params.id);
        const funnel = await storage.getFunnel(funnelId, user.id!);
        if (!funnel) return res.status(404).json({ message: "Funil não encontrado." });
        res.json(funnel);
    } catch (error) {
        next(error);
    }
});

router.put('/funnels/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelId = parseInt(req.params.id);
        const funnelData = insertFunnelSchema.partial().omit({ userId: true }).parse(req.body);
        const updatedFunnel = await storage.updateFunnel(funnelId, user.id!, funnelData);
        if (!updatedFunnel) return res.status(404).json({ message: "Funil não encontrado para atualização." });
        res.json(updatedFunnel);
    } catch (error) {
        next(error);
    }
});

router.delete('/funnels/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelId = parseInt(req.params.id);
        const result = await storage.deleteFunnel(funnelId, user.id!);
         if (!result.success) return res.status(404).json({ message: "Funil não encontrado para exclusão." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Funnel Stages
router.post('/funnels/:funnelId/stages', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelId = parseInt(req.params.funnelId);
        // Verificar se o funil pai pertence ao usuário
        const funnel = await storage.getFunnel(funnelId, user.id!);
        if (!funnel) return res.status(404).json({ message: "Funil pai não encontrado." });

        const stageData = insertFunnelStageSchema.parse({ ...req.body, funnelId });
        const stage = await storage.createFunnelStage(stageData);
        res.status(201).json(stage);
    } catch (error) {
        next(error);
    }
});

router.get('/funnels/:funnelId/stages', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const funnelId = parseInt(req.params.funnelId);
        const stages = await storage.getFunnelStages(funnelId, user.id!);
        res.json(stages);
    } catch (error) {
        next(error);
    }
});

router.put('/stages/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const stageId = parseInt(req.params.id);
        const stageData = insertFunnelStageSchema.partial().omit({ funnelId: true }).parse(req.body); // funnelId não deve ser alterado aqui

        const updatedStage = await storage.updateFunnelStage(stageId, user.id!, stageData);
        if (!updatedStage) return res.status(404).json({ message: "Estágio do funil não encontrado ou acesso negado." });
        res.json(updatedStage);
    } catch (error) {
        next(error);
    }
});

router.delete('/stages/:id', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const stageId = parseInt(req.params.id);
        const result = await storage.deleteFunnelStage(stageId, user.id!);
        if (!result.success) return res.status(404).json({ message: "Estágio do funil não encontrado ou acesso negado." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Chat & Agente MCP
router.post('/chat/sessions', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const sessionData = insertChatSessionSchema.parse({ ...req.body, userId: user.id! });
        const session = await storage.createChatSession(sessionData);
        res.status(201).json(session);
    } catch (error) {
        next(error);
    }
});

router.get('/chat/sessions', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const sessions = await storage.getChatSessions(user.id!);
        res.json(sessions);
    } catch (error) {
        next(error);
    }
});

router.get('/chat/sessions/:sessionId/messages', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const sessionId = parseInt(req.params.sessionId);
        const messages = await storage.getChatMessages(sessionId, user.id!); // storage.getChatMessages agora verifica userId
        res.json(messages);
    } catch (error) {
        next(error);
    }
});

router.put('/chat/sessions/:sessionId/title', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const sessionId = parseInt(req.params.sessionId);
        const { title } = req.body;
        if (typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ message: "O título não pode ser vazio." });
        }
        const updatedSession = await storage.updateChatSessionTitle(sessionId, user.id!, title);
        if (!updatedSession) return res.status(404).json({ message: "Sessão não encontrada ou acesso negado." });
        res.json(updatedSession);
    } catch (error) {
        next(error);
    }
});

router.delete('/chat/sessions/:sessionId', authenticateToken, async (req, res, next) => {
    try {
        const user = req.user as User;
        const sessionId = parseInt(req.params.sessionId);
        const result = await storage.deleteChatSession(sessionId, user.id!);
        if (!result.success) return res.status(404).json({ message: "Sessão não encontrada ou acesso negado." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});


router.post('/mcp/converse', authenticateToken, mcpAttachmentUpload.single('attachment'), async (req, res, next) => {
    try {
        const user = req.user as User;
        const { message, sessionId, clientTimestamp } = req.body;
        let currentSessionId = sessionId ? parseInt(sessionId) : null;
        let attachmentUrl: string | undefined = undefined;

        if (!message && !req.file) {
            return res.status(400).json({ message: "Mensagem ou anexo é obrigatório." });
        }

        if (req.file) {
            attachmentUrl = `${UPLOADS_BASE_URL_PATH}/mcp-attachments/${req.file.filename}`;
        }

        if (!currentSessionId) {
            const newSession = await storage.createChatSession({ userId: user.id!, title: message ? message.substring(0, 30) + "..." : "Nova Conversa com Anexo" });
            if (!newSession) return res.status(500).json({ message: "Erro ao criar nova sessão de chat." });
            currentSessionId = newSession.id;
        }

        // Salvar mensagem do usuário
        if (message || attachmentUrl) {
             await storage.createChatMessage({
                sessionId: currentSessionId,
                sender: chatSenderEnum.enumValues[0], // 'user'
                text: message || '', // Salva texto vazio se for só anexo
                attachmentUrl: attachmentUrl,
                timestamp: clientTimestamp ? new Date(clientTimestamp) : new Date(),
            });
        }


        // Lógica de IA e Ações (handleMcpAction)
        const mcpResponse = await handleMcpAction(
            message || (req.file ? `Recebi um arquivo: ${req.file.originalname}` : "Ação MCP"), // Texto para IA
            user,
            storage,
            currentSessionId,
            model, // Passa o modelo Gemini
            generationConfig,
            safetySettings,
            attachmentUrl // Passa a URL do anexo para a IA, se houver
        );

        // Salvar resposta da IA (MCP)
        await storage.createChatMessage({
            sessionId: currentSessionId,
            sender: chatSenderEnum.enumValues[1], // 'agent'
            text: mcpResponse.text,
            attachmentUrl: mcpResponse.attachmentUrl, // Se a IA gerar um anexo
            timestamp: new Date(),
            action: mcpResponse.action ? JSON.stringify(mcpResponse.action) : undefined,
        });

        res.json({
            reply: mcpResponse.text,
            action: mcpResponse.action,
            attachmentUrl: mcpResponse.attachmentUrl,
            sessionId: currentSessionId,
        });

    } catch (error) {
        next(error);
    }
});

router.post('/mcp/upload-attachment', authenticateToken, mcpAttachmentUpload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        }
        const attachmentUrl = `${UPLOADS_BASE_URL_PATH}/mcp-attachments/${req.file.filename}`;
        // Normalmente, esta rota seria chamada internamente ou o /mcp/converse lidaria com o upload.
        // Se for um endpoint dedicado para apenas fazer upload e retornar URL:
        res.status(201).json({ attachmentUrl, filename: req.file.filename });
    } catch (error) {
        next(error);
    }
});


// WhatsApp (Placeholders, necessita integração real)
router.get('/whatsapp/contacts', authenticateToken, async (req, res) => {
    // const user = req.user as User;
    // Mock data, substituir por integração real
    res.json([
        { id: '1', name: 'Cliente Alpha', number: '+5511999990001', lastMessage: 'Olá!', unread: 2, avatar: '/placeholder-avatar.png' },
        { id: '2', name: 'Lead Beta', number: '+5511999990002', lastMessage: 'Tenho uma dúvida.', unread: 0, avatar: '/placeholder-avatar.png' },
    ]);
});

router.get('/whatsapp/messages/:contactNumber', authenticateToken, async (req, res) => {
    // const user = req.user as User;
    // const { contactNumber } = req.params;
    // Mock data
    res.json([
        { id: 'msg1', direction: 'incoming', text: 'Olá! Gostaria de saber mais sobre o produto X.', timestamp: new Date().toISOString() },
        { id: 'msg2', direction: 'outgoing', text: 'Claro! O produto X é ótimo por causa de A, B e C.', timestamp: new Date().toISOString() },
    ]);
});

router.post('/whatsapp/send', authenticateToken, async (req, res) => {
    // const user = req.user as User;
    // const { number, message } = req.body;
    // Lógica de envio real aqui
    console.log(`Simulando envio para ${req.body.number}: ${req.body.message}`);
    res.json({ success: true, messageId: `fake-${Date.now()}` });
});


// Servir arquivos estáticos de uploads
// Esta rota deve vir ANTES dos middlewares de erro globais, mas DEPOIS de todas as rotas da API.
// router.use('/uploads', express.static(UPLOADS_DIR)); // Já definido em server/index.ts

// Adicionar os middlewares de tratamento de erro no final
router.use(handleZodError);
router.use(handleError);

export default router;
