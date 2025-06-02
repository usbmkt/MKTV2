// zap/server/routes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { 
    getZapConnectionStatusController, 
    connectZapController, 
    disconnectZapController 
} from './controllers/whatsappConnectionController';
import {
    getZapContactsController,
    getZapMessagesController,
    sendZapTextMessageController,
    sendZapMediaMessageController
} from './controllers/whatsappChatController';
import {
    getZapFlowsController,
    createZapFlowController,
    updateZapFlowMetadataController,
    updateZapFlowStatusController,
    deleteZapFlowController,
    getZapFlowEditorDataController,
    updateZapFlowEditorDataController
} from './controllers/whatsappFlowController';
import {
    getZapMessageTemplatesController,
    createZapMessageTemplateController,
    updateZapMessageTemplateController,
    deleteZapMessageTemplateController
} from './controllers/whatsappTemplateController';
import {
    getZapAnalyticsController
} from './controllers/whatsappAnalyticsController';

const router = Router();

// Middleware de Autenticação (Mock)
const authenticateZapUser = (req: Request, res: Response, next: NextFunction) => {
  // Em um sistema real, validar token/sessão e definir o ID do usuário.
  // Este ID é usado para isolar dados entre diferentes usuários do MKTV2.
  (req as any).zapMktv2UserId = 1; // Mock para desenvolvimento.
  next();
};
router.use(authenticateZapUser); // Aplicar a todas as rotas do Zap

// Middleware de Tratamento de Erro Zod
const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            message: "Erro de validação nos dados de entrada.",
            errors: err.flatten().fieldErrors,
        });
    }
    next(err); // Passa para o próximo handler de erro se não for ZodError
};


// --- Rotas de Conexão WhatsApp ---
router.get('/whatsapp/connection/status', getZapConnectionStatusController);
router.post('/whatsapp/connection/connect', connectZapController);
router.post('/whatsapp/connection/disconnect', disconnectZapController);

// --- Rotas de Conversas ---
router.get('/whatsapp/contacts', getZapContactsController);
router.get('/whatsapp/messages', getZapMessagesController);
router.post('/whatsapp/send-message', sendZapTextMessageController);
router.post('/whatsapp/send-media', sendZapMediaMessageController); // Ainda placeholder no controller

// --- Rotas de Fluxos ---
router.get('/whatsapp/flows', getZapFlowsController);
router.post('/whatsapp/flows', createZapFlowController);
router.put('/whatsapp/flows/:flowId', updateZapFlowMetadataController); // Para metadados
router.patch('/whatsapp/flows/:flowId/status', updateZapFlowStatusController); // Para ativar/desativar
router.delete('/whatsapp/flows/:flowId', deleteZapFlowController);
router.get('/whatsapp/flows/:flowId/editor-data', getZapFlowEditorDataController); // Para o editor visual
router.put('/whatsapp/flows/:flowId/editor-data', updateZapFlowEditorDataController); // Para salvar do editor

// --- Rotas para Templates ---
router.get('/whatsapp/templates', getZapMessageTemplatesController);
router.post('/whatsapp/templates', createZapMessageTemplateController);
router.put('/whatsapp/templates/:templateId', updateZapMessageTemplateController);
router.delete('/whatsapp/templates/:templateId', deleteZapMessageTemplateController);
// router.post('/whatsapp/templates/:templateId/submit-meta', submitTemplateToMetaController); // Futuro

// --- Rota de Analytics ---
router.get('/whatsapp/analytics', getZapAnalyticsController);

// --- Webhook Baileys (A lógica principal de recebimento está no WhatsappConnectionService) ---
router.post('/whatsapp/webhook/baileys', (req: Request, res: Response) => {
    console.log('[ZapAPI Webhook Baileys] Evento recebido (geralmente interno do Baileys Service):', JSON.stringify(req.body, null, 2));
    // A lógica de processamento de mensagem e disparo de fluxo está no handler 'messages.upsert'
    // dentro do WhatsappConnectionService.ts. Este endpoint pode ser usado para outros eventos
    // ou se você optar por um HTTP POST interno do Baileys Service para este endpoint.
    res.sendStatus(200); // Responder rapidamente ao Baileys
});

// Rota Raiz da API do Zap
router.get('/', (req, res) => {
    res.json({ message: 'API Raiz do Módulo Zap está funcionando!', version: '1.0' });
});

// Aplicar o handler de erro Zod no final das rotas da API Zap
router.use(handleZodError);

export default router;