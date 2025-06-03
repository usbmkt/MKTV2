// zap/server/controllers/whatsappFlowController.ts
import { Request, Response, NextFunction } from 'express';
import { zapDb } from '../db';
import { 
    whatsappFlows, 
    insertWhatsappFlowSchema as zodInsertWhatsappFlowSchema, // Renomeado para Zod
    selectWhatsappFlowSchema, // Schema Zod para select
    NewWhatsappFlow, // Tipo Drizzle para inserção
    WhatsappFlow // Tipo Drizzle para seleção
} from '../../shared/zap_schema';
import { eq, and, desc } from 'drizzle-orm';
import { ZodError } from 'zod';
import { FlowElementData } from '../../client/src/features/types/whatsapp_flow_types';

const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapFlowsController = async (req: Request, res: Response, next: NextFunction) => {
  const mktv2UserId = getMktv2UserId(req);
  console.log(`[ZapFlowCtrl /flows] GET para User: ${mktv2UserId}`);
  try {
    const userFlows = await zapDb.select()
        .from(whatsappFlows)
        .where(eq(whatsappFlows.mktv2UserId, mktv2UserId))
        .orderBy(desc(whatsappFlows.updatedAt));
    
    const flowsWithAnalytics = userFlows.map(f => ({
        ...f,
        analytics: { // Mock analytics
            totalUsers: Math.floor(Math.random() * 100),
            completionRate: Math.floor(Math.random() * 100),
            avgTime: `${Math.floor(Math.random()*5)}m${Math.floor(Math.random()*60)}s`
        }
    }));
    res.json(flowsWithAnalytics);
  } catch (error) {
    console.error(`[ZapFlowCtrl /flows] Erro para User ${mktv2UserId}:`, error);
    next(error);
  }
};

export const createZapFlowController = async (req: Request, res: Response, next: NextFunction) => {
  const mktv2UserId = getMktv2UserId(req);
  try {
    const parsedBody = zodInsertWhatsappFlowSchema.pick({ 
        name: true, description: true, triggerType: true, triggerConfig: true 
    }).parse(req.body);
    console.log(`[ZapFlowCtrl /flows] POST para User: ${mktv2UserId}`, parsedBody);
    
    const initialElements: FlowElementData = { // Elementos iniciais com nó de gatilho
        nodes: [{ id: 'startNode_initial', type: 'triggerNode', data: { label: 'Início do Fluxo', triggerType: parsedBody.triggerType, config: parsedBody.triggerConfig }, position: { x: 150, y: 50 }, deletable: false }],
        edges: [],
        viewport: { x:0, y:0, zoom:1 }
    };

    const [newFlow] = await zapDb.insert(whatsappFlows)
        .values({ 
            ...parsedBody, 
            mktv2UserId, 
            status: 'draft',
            elements: initialElements 
        })
        .returning();
    res.status(201).json(newFlow);
  } catch (error) {
    console.error(`[ZapFlowCtrl /flows] Erro ao criar fluxo para User ${mktv2UserId}:`, error);
    next(error);
  }
};

export const updateZapFlowMetadataController = async (req: Request, res: Response, next: NextFunction) => {
  const mktv2UserId = getMktv2UserId(req);
  const flowId = parseInt(req.params.flowId);
  if (isNaN(flowId)) return res.status(400).json({ message: 'ID do fluxo inválido.' });
  
  try {
    const parsedBody = zodInsertWhatsappFlowSchema.pick({ 
        name: true, description: true, triggerType: true, triggerConfig: true 
    }).partial().parse(req.body); // Partial para permitir atualização de campos específicos
    console.log(`[ZapFlowCtrl /flows/${flowId}] PUT (metadata) para User: ${mktv2UserId}`, parsedBody);

    if (Object.keys(parsedBody).length === 0) {
        return res.status(400).json({ message: "Nenhum dado fornecido para atualização."});
    }

    const [updatedFlow] = await zapDb.update(whatsappFlows)
        .set({ ...parsedBody, updatedAt: new Date() })
        .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.mktv2UserId, mktv2UserId)))
        .returning();
    if (!updatedFlow) return res.status(404).json({ message: 'Fluxo não encontrado ou não pertence ao usuário.' });
    res.json(updatedFlow);
  } catch (error) {
     console.error(`[ZapFlowCtrl /flows/${flowId}] Erro ao atualizar metadados para User ${mktv2UserId}:`, error);
    next(error);
  }
};

export const updateZapFlowStatusController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const flowId = parseInt(req.params.flowId);
    if (isNaN(flowId)) return res.status(400).json({ message: 'ID do fluxo inválido.' });
    try {
        const { status } = z.object({ status: selectWhatsappFlowSchema.shape.status }).parse(req.body);
        console.log(`[ZapFlowCtrl /flows/${flowId}/status] PATCH para User: ${mktv2UserId}`, { status });

        const [updatedFlow] = await zapDb.update(whatsappFlows)
            .set({ status, updatedAt: new Date() })
            .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.mktv2UserId, mktv2UserId)))
            .returning();
        if (!updatedFlow) return res.status(404).json({ message: 'Fluxo não encontrado.' });
        res.json(updatedFlow);
    } catch (error) {
        next(error);
    }
};

export const deleteZapFlowController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const flowId = parseInt(req.params.flowId);
    if (isNaN(flowId)) return res.status(400).json({ message: 'ID do fluxo inválido.' });
    console.log(`[ZapFlowCtrl /flows/${flowId}] DELETE para User: ${mktv2UserId}`);
    try {
        // TODO: Considerar o que acontece com whatsappFlowUserStates se um fluxo for deletado.
        // Poderia setar activeFlowId para null (onDelete: 'set null' no schema já faz isso)
        const result = await zapDb.delete(whatsappFlows)
            .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.mktv2UserId, mktv2UserId)));
        if (result.rowCount === 0) return res.status(404).json({ message: 'Fluxo não encontrado.' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getZapFlowEditorDataController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const flowId = parseInt(req.params.flowId);
    if (isNaN(flowId)) return res.status(400).json({ message: 'ID do fluxo inválido.' });
    console.log(`[ZapFlowCtrl /flows/${flowId}/editor-data] GET para User: ${mktv2UserId}`);
    try {
        const flowData = await zapDb.query.whatsappFlows.findFirst({
            columns: { name: true, elements: true, id: true, triggerType: true, triggerConfig: true }, // Incluir mais metadados se necessário para o editor
            where: and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.mktv2UserId, mktv2UserId))
        });
        if (!flowData) return res.status(404).json({ message: 'Fluxo não encontrado.' });
        res.json(flowData); // Retorna o objeto completo do tipo WhatsappFlow (ou parcial conforme columns)
    } catch (error) {
        next(error);
    }
};

export const updateZapFlowEditorDataController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const flowId = parseInt(req.params.flowId);
    if (isNaN(flowId)) return res.status(400).json({ message: 'ID do fluxo inválido.' });
    try {
        // Validar o payload completo esperado pelo editor
        const validationSchema = zodInsertWhatsappFlowSchema.pick({elements: true, name: true}).partial();
        const parsedBody = validationSchema.parse(req.body);
        
        console.log(`[ZapFlowCtrl /flows/${flowId}/editor-data] PUT para User: ${mktv2UserId}`);

        const updateData: Partial<Pick<NewWhatsappFlow, 'elements' | 'name' | 'updatedAt'>> = { updatedAt: new Date() };
        if (parsedBody.elements) updateData.elements = parsedBody.elements;
        if (parsedBody.name) updateData.name = parsedBody.name;

        const [updatedFlow] = await zapDb.update(whatsappFlows)
            .set(updateData)
            .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.mktv2UserId, mktv2UserId)))
            .returning(); // Retornar o fluxo completo
        if (!updatedFlow) return res.status(404).json({ message: 'Fluxo não encontrado.' });
        res.json(updatedFlow); // Retornar o fluxo atualizado
    } catch (error) {
        next(error);
    }
};