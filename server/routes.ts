// server/routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { JWT_SECRET, GEMINI_API_KEY } from './config';
import { usersTable, insertUserSchema, insertCampaignSchema, insertCreativeSchema, insertBudgetSchema, insertCopySchema, insertLandingPageSchema, insertFlowSchema, FlowData } from '../shared/schema'; // Adicionado insertFlowSchema e FlowData
import { z, ZodError } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MCPHandler } from './mcp_handler';

const mcpHandler = new MCPHandler(storage);

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    username: string;
  };
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (process.env.FORCE_AUTH_BYPASS === 'true') {
    console.warn('[AUTH_BYPASS] Autenticação FORÇADAMENTE IGNORADA via FORCE_AUTH_BYPASS=true');
    const mockUser = await storage.getUser('admin@usbmkt.com'); // Usar um usuário mock ou o admin
    if (mockUser) {
        req.user = {id: mockUser.id, email: mockUser.email, username: mockUser.username! };
    } else {
        // Se o admin não existir, crie um mock simples
        req.user = { id: 1, email: 'bypass@example.com', username: 'Bypass User' };
    }
    return next();
  }

  if (token == null) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET!, async (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    
    try {
      const user = await storage.getUserById(decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário do token não encontrado' });
      }
      req.user = { id: user.id, email: user.email, username: user.username! };
      next();
    } catch (error) {
      console.error("Erro ao buscar usuário do token:", error);
      return res.status(500).json({ error: 'Erro interno ao verificar usuário do token' });
    }
  });
};

// Configuração do Multer para uploads
const createUploadMiddleware = (destination: string, fieldName: string = 'file') => {
    const storageConfig = multer.diskStorage({
        destination: async (req, file, cb) => {
            const uploadPath = path.join(__dirname, '..', 'uploads', destination);
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    return multer({
        storage: storageConfig,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        fileFilter: (req, file, cb) => {
            const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|txt|ogg|mp3|wav/;
            const mimetype = allowedTypes.test(file.mimetype);
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            if (mimetype && extname) {
                return cb(null, true);
            }
            cb(new Error('Tipo de arquivo não suportado: ' + file.mimetype + ' ou ' + path.extname(file.originalname)));
        }
    }).single(fieldName);
};

const creativesUpload = createUploadMiddleware('creatives-assets');
const lpAssetUpload = createUploadMiddleware('lp-assets'); // Para GrapesJS Studio
const mcpAttachmentUpload = createUploadMiddleware('mcp-attachments');


const router = Router();

// Middleware para loggar todas as requisições
router.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const userAgent = req.get('User-Agent') || 'N/A';
    const userIp = req.ip || req.socket.remoteAddress || 'N/A';
    let logMessage = `${new Date().toLocaleTimeString()} [api-server] ${req.method} ${req.originalUrl} ${res.statusCode} in ${duration}ms`;
    if (res.locals.errorMessage) {
      logMessage += ` :: ${JSON.stringify(res.locals.errorMessage)}`;
    }
    // Evitar log excessivo para health checks ou assets públicos em produção
    if (process.env.NODE_ENV !== 'production' || (!req.originalUrl.startsWith('/assets/') && req.originalUrl !== '/api/health')) {
        console.log(logMessage);
    }
  });
  next();
});


// Zod Error Handler
const handleZodError = (err: ZodError, req: Request, res: Response, next: NextFunction) => {
  const errors = err.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
  res.status(400).json({ error: "Erro de validação", details: errors });
};

// --- Auth Routes ---
router.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const user = await storage.createUser(userData);
    if (!user) return res.status(500).json({ error: 'Falha ao criar usuário' });
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(409).json({ error: "Este e-mail já está em uso." });
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.username')) {
        return res.status(409).json({ error: "Este nome de usuário já está em uso." });
    }
    next(error);
  }
});

router.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const user = await storage.validatePassword(email, password);
    if (!user) {
      res.locals.errorMessage = {error: "Credenciais inválidas."}; // Para log customizado
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    next(error);
  }
});

router.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
});

// --- Health Check ---
router.get('/api/health', (req, res) => res.status(200).send('OK'));

// --- Dashboard Route ---
router.get('/api/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const data = await storage.getDashboardData(req.user.id);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// --- Campaigns Routes ---
router.post('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaignData = insertCampaignSchema.parse(req.body);
    const campaign = await storage.createCampaign(req.user.id, campaignData);
    res.status(201).json(campaign);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});

router.get('/api/campaigns', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaigns = await storage.getCampaigns(req.user.id);
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

router.get('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const campaign = await storage.getCampaignById(req.user.id, id);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

router.put('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const campaignData = insertCampaignSchema.partial().parse(req.body);
    const campaign = await storage.updateCampaign(req.user.id, id, campaignData);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou não autorizada' });
    res.json(campaign);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});

router.delete('/api/campaigns/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID da campanha inválido" });
    const result = await storage.deleteCampaign(req.user.id, id);
    if (!result.success) return res.status(404).json({ error: 'Campanha não encontrada ou não autorizada' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


// --- Creatives Routes ---
router.post('/api/creatives', authenticateToken, creativesUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const creativePayload = { ...req.body };
        if (req.file) {
            creativePayload.fileUrl = `/uploads/creatives-assets/${req.file.filename}`;
        }
        // Converter campaignId para número se existir e não for nulo/vazio
        if (creativePayload.campaignId && creativePayload.campaignId !== 'null' && creativePayload.campaignId !== '') {
            creativePayload.campaignId = parseInt(creativePayload.campaignId, 10);
             if (isNaN(creativePayload.campaignId)) {
                throw new Error("ID da Campanha inválido fornecido para o criativo.");
            }
        } else {
            creativePayload.campaignId = null; // Definir como null se não fornecido ou 'null'
        }

        const parsedData = insertCreativeSchema.parse(creativePayload);
        const creative = await storage.createCreative(req.user.id, parsedData);
        res.status(201).json(creative);
    } catch (error) {
        if (req.file) { // Se o upload do arquivo ocorreu mas a validação falhou, remover o arquivo
            await fs.unlink(req.file.path).catch(err => console.error("Erro ao remover arquivo após falha:", err));
        }
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
// ... (outras rotas de criativos GET, PUT, DELETE devem ser implementadas similarmente)

// --- Flows Routes ---
const partialFlowSchema = insertFlowSchema.partial().extend({
  elements: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }).optional().nullable(),
});

router.post('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowData = insertFlowSchema.omit({ userId: true, id: true, createdAt: true, updatedAt: true }).parse(req.body);
    const flow = await storage.createFlow(req.user.id, { ...flowData, userId: req.user.id });
    res.status(201).json(flow);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});

router.get('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    const campaignIdQuery = req.query.campaignId as string | undefined;

    if (flowIdQuery) {
      const id = parseInt(flowIdQuery, 10);
      if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });
      const flow = await storage.getFlowById(req.user.id, id);
      if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });
      return res.json(flow);
    } else {
      const flows = await storage.getFlows(req.user.id, campaignIdQuery);
      return res.json(flows);
    }
  } catch (error) {
    next(error);
  }
});

router.put('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    if (!flowIdQuery) return res.status(400).json({ error: "ID do fluxo é obrigatório na query string" });
    
    const id = parseInt(flowIdQuery, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });
    
    const flowData = partialFlowSchema.parse(req.body);
    const updatedFlow = await storage.updateFlow(req.user.id, id, flowData);
    
    if (!updatedFlow) return res.status(404).json({ error: 'Fluxo não encontrado ou não autorizado' });
    res.json(updatedFlow);
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error, req, res, next);
    next(error);
  }
});

router.delete('/api/flows', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const flowIdQuery = req.query.id as string | undefined;
    if (!flowIdQuery) return res.status(400).json({ error: "ID do fluxo é obrigatório na query string" });

    const id = parseInt(flowIdQuery, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID do fluxo inválido" });

    const result = await storage.deleteFlow(req.user.id, id);
    if (!result.success) return res.status(404).json({ error: result.message || 'Fluxo não encontrado ou não autorizado' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


// --- WhatsApp Related Routes ---
// Placeholder para reload de fluxo
router.post('/api/whatsapp/reload-flow', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Lógica para o bot recarregar o(s) fluxo(s) ativo(s)
        // Ex: chamar um método no whatsapp-connection.service.ts
        console.log(`[WhatsApp Flow] Usuário ${req.user.id} solicitou recarga de fluxo.`);
        // await whatsappService.reloadActiveFlowsForUser(req.user.id); // Exemplo
        res.json({ message: "Solicitação de recarga de fluxo recebida. O bot tentará aplicar as mudanças." });
    } catch (error) {
        console.error("Erro ao recarregar fluxo do WhatsApp:", error);
        next(error);
    }
});

// ... (outras rotas de WhatsApp como /connect, /status, /send-message, /messages, /contacts precisam de implementação completa)
// ... Exemplo de como seria uma rota para enviar mensagem, que precisaria do whatsapp.service.ts implementado
// router.post('/api/whatsapp/send-message', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
//   try {
//     const { to, message } = req.body;
//     if (!to || !message) return res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios.' });
//     // const success = await whatsappService.sendMessage(req.user.id, to, message);
//     // if (success) {
//     //   res.json({ message: 'Mensagem enviada com sucesso.' });
//     // } else {
//     //   res.status(500).json({ error: 'Falha ao enviar mensagem. Verifique a conexão do WhatsApp.' });
//     // }
//      res.status(503).json({ error: 'Funcionalidade de envio de mensagem ainda não implementada.' });
//   } catch (error) {
//     next(error);
//   }
// });


// --- Landing Page Routes (Exemplos, precisam ser completadas e validadas) ---
router.post('/api/landingpages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const pageData = insertLandingPageSchema.omit({userId: true, id: true, createdAt: true, updatedAt: true, publishedAt: true, publicUrl: true}).parse(req.body);
        const newPage = await storage.createLandingPage(req.user.id, pageData);
        res.status(201).json(newPage);
    } catch(error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});
// ... (GET, PUT, DELETE para landing pages)
router.get('/api/landingpages/slug/:slug', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = await storage.getLandingPageBySlug(req.params.slug);
        if (!page || page.status !== 'published') {
            return res.status(404).json({ error: 'Página não encontrada ou não publicada.' });
        }
        res.json({ title: page.name, description: page.description, grapesJsData: page.grapesJsData }); // Ajuste conforme necessário
    } catch (error) {
        next(error);
    }
});

// --- Rota para upload de assets do GrapesJS Studio ---
router.post('/api/assets/lp-upload', authenticateToken, lpAssetUpload, (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    // O GrapesJS Studio espera uma resposta com um array de URLs ou objetos com 'src'
    const fileUrl = `/uploads/lp-assets/${req.file.filename}`;
    res.json([fileUrl]); // Ou [{ src: fileUrl }] dependendo do que o Studio espera
});
// Implementar /api/assets/lp-delete se necessário


// --- Copy Routes (Exemplos) ---
router.post('/api/copies', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const copyData = insertCopySchema.omit({userId: true, id: true, createdAt:true}).parse(req.body);
        const newCopy = await storage.createCopy(req.user.id, copyData);
        res.status(201).json(newCopy);
    } catch(error) {
        if (error instanceof ZodError) return handleZodError(error, req, res, next);
        next(error);
    }
});

router.post('/api/copies/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { prompt, type, platform, tone, keywords, targetAudience, campaignObjective, language, numSuggestions = 3 } = req.body;
        if (!prompt && (!campaignObjective || !targetAudience)) {
            return res.status(400).json({ error: "Prompt ou detalhes da campanha (objetivo, público) são necessários." });
        }

        if (!GEMINI_API_KEY) {
            return res.status(503).json({ error: "Serviço de IA indisponível: API Key não configurada." });
        }
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const generationConfig = {
          temperature: 0.8,
          topK: 32,
          topP: 0.9,
          maxOutputTokens: 1024,
        };

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const actualPrompt = prompt || 
          `Gere ${numSuggestions} sugestões de copy para ${type || 'um anúncio'} na plataforma ${platform || 'geral'}.
           Tom: ${tone || 'neutro'}. Palavras-chave: ${keywords || 'não especificadas'}.
           Público-alvo: ${targetAudience}. Objetivo da campanha: ${campaignObjective}.
           Idioma: ${language || 'Português (Brasil)'}.
           Formato de saída esperado: JSON com uma chave "suggestions" contendo um array de strings. Cada string é uma sugestão de copy.`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{text: actualPrompt }] }],
            generationConfig,
            safetySettings
        });
        
        const responseText = result.response.text();
        try {
            // Tenta parsear se a IA retornar JSON diretamente
            const parsedResponse = JSON.parse(responseText);
            if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
                 res.json({ suggestions: parsedResponse.suggestions.slice(0, numSuggestions) });
            } else {
                // Se não for o JSON esperado, mas for um JSON, encapsula
                 res.json({ suggestions: [responseText] }); // Ou processa de outra forma
            }
        } catch (e) {
            // Se não for JSON, trata como texto e divide por quebras de linha se necessário
            const suggestions = responseText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, numSuggestions);
            res.json({ suggestions });
        }

    } catch (error: any) {
        console.error("Erro na geração de copy com Gemini:", error);
        if (error.isGoogleGenerativeAIError) { // Checa se é um erro específico do SDK do Gemini
            res.status(500).json({ error: "Erro ao comunicar com o serviço de IA.", details: error.message });
        } else {
            next(error);
        }
    }
});


// --- Chat MCP Routes ---
router.post('/api/mcp/converse', authenticateToken, mcpAttachmentUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { message, sessionId: currentSessionId, context } = req.body;
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/uploads/mcp-attachments/${req.file.filename}`;
        }
        const response = await mcpHandler.handleConversation(req.user, message, attachmentUrl, currentSessionId, context);
        res.json(response);
    } catch (error) {
      if (req.file) { 
            await fs.unlink(req.file.path).catch(err => console.error("Erro ao remover anexo MCP após falha:", err));
      }
      next(error);
    }
});

// CRUD para sessões de chat
router.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { title } = req.body;
        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: "Título da sessão é obrigatório." });
        }
        const session = await storage.createChatSession(req.user.id, title.trim());
        res.status(201).json(session);
    } catch (error) {
        next(error);
    }
});

router.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessions = await storage.getChatSessions(req.user.id);
        res.json(sessions);
    } catch (error) {
        next(error);
    }
});

router.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        const session = await storage.getChatSessionById(req.user.id, sessionId);
        if (!session) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.json(session.messages || []);
    } catch (error) {
        next(error);
    }
});
router.put('/api/chat/sessions/:sessionId/title', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        const { title } = req.body;
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: "Novo título é obrigatório." });
        }
        const updatedSession = await storage.updateChatSessionTitle(req.user.id, sessionId, title.trim());
        if (!updatedSession) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.json(updatedSession);
    } catch (error) {
        next(error);
    }
});

router.delete('/api/chat/sessions/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = parseInt(req.params.sessionId, 10);
        if (isNaN(sessionId)) return res.status(400).json({ error: "ID da sessão inválido." });
        const result = await storage.deleteChatSession(req.user.id, sessionId);
        if (!result.success) return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Error handling middleware (deve ser o último)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[GLOBAL_ERROR_HANDLER] ${new Date().toISOString()} Path: ${req.path}`);
  console.error(err);

  if (err instanceof ZodError) { // Já tratado pelo handleZodError, mas pode ser pego aqui se não for na rota.
    return handleZodError(err, req, res, _next);
  }
  
  if (err instanceof multer.MulterError) {
    res.locals.errorMessage = { error: 'Erro de upload de arquivo', details: err.message, code: err.code };
    return res.status(400).json(res.locals.errorMessage);
  }

  if ('isGoogleGenerativeAIError' in err && err.isGoogleGenerativeAIError) {
     res.locals.errorMessage = { error: 'Erro no serviço de IA (Google Gemini)', details: err.message };
     return res.status(502).json(res.locals.errorMessage); // Bad Gateway
  }
  
  res.locals.errorMessage = { error: 'Erro interno do servidor', details: err.message };
  return res.status(500).json(res.locals.errorMessage);
});


export default router;
