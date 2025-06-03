// zap/server/routes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Importando todos os controllers
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

const authenticateZapUser = (req: Request, res: Response, next: NextFunction) => {
  (req as any).zapMktv2UserId = 1; 
  next();
};
router.use(authenticateZapUser);

const handleZodError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
        console.warn("[ZodValidationError]", err.flatten().fieldErrors);
        return res.status(400).json({
            message: "Erro de validação nos dados de entrada.",
            errors: err.flatten().fieldErrors,
        });
    }
    next(err); 
};

// === ROTAS DA API DO ZAP ===
router.get('/whatsapp/connection/status', getZapConnectionStatusController);
router.post('/whatsapp/connection/connect', connectZapController);
router.post('/whatsapp/connection/disconnect', disconnectZapController);

router.get('/whatsapp/contacts', getZapContactsController);
router.get('/whatsapp/messages', getZapMessagesController);
router.post('/whatsapp/send-message', sendZapTextMessageController);
router.post('/whatsapp/send-media', sendZapMediaMessageController);

router.get('/whatsapp/flows', getZapFlowsController);
router.post('/whatsapp/flows', createZapFlowController);
router.get('/whatsapp/flows/:flowId/editor-data', getZapFlowEditorDataController);
router.put('/whatsapp/flows/:flowId/editor-data', updateZapFlowEditorDataController);
router.put('/whatsapp/flows/:flowId', updateZapFlowMetadataController);
router.patch('/whatsapp/flows/:flowId/status', updateZapFlowStatusController);
router.delete('/whatsapp/flows/:flowId', deleteZapFlowController);

router.get('/whatsapp/templates', getZapMessageTemplatesController);
router.post('/whatsapp/templates', createZapMessageTemplateController);
router.put('/whatsapp/templates/:templateId', updateZapMessageTemplateController);
router.delete('/whatsapp/templates/:templateId', deleteZapMessageTemplateController);

router.get('/whatsapp/analytics', getZapAnalyticsController);

router.post('/whatsapp/webhook/baileys', (req: Request, res: Response) => {
    console.log('[ZapAPI Webhook Baileys] Evento recebido:', JSON.stringify(req.body, null, 2));
    res.sendStatus(200); 
});

router.get('/', (req, res) => {
    res.json({ message: 'API Raiz do Módulo Zap está funcionando!', version: '1.0.0', timestamp: new Date().toISOString() });
});

router.use(handleZodError);

export default router;