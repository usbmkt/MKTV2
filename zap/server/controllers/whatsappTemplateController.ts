// zap/server/controllers/whatsappTemplateController.ts
import { Request, Response, NextFunction } from 'express';
import { zapDb } from '../db';
import { whatsappMessageTemplates, insertWhatsappMessageTemplateSchema, NewWhatsappMessageTemplate } from '../../shared/zap_schema';
import { eq, and, desc } from 'drizzle-orm';
import { ZodError } from 'zod';

const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapMessageTemplatesController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapTemplateCtrl /templates] GET para User: ${mktv2UserId}`);
    try {
        const templates = await zapDb.select()
            .from(whatsappMessageTemplates)
            .where(eq(whatsappMessageTemplates.mktv2UserId, mktv2UserId))
            .orderBy(desc(whatsappMessageTemplates.updatedAt));
        res.json(templates);
    } catch (error) {
        console.error(`[ZapTemplateCtrl /templates] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};

export const createZapMessageTemplateController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    try {
        const parsedBody = insertWhatsappMessageTemplateSchema.omit({ 
            id: true, createdAt: true, updatedAt: true, mktv2UserId: true, metaTemplateId: true, statusMeta: true 
        }).parse(req.body);
        
        console.log(`[ZapTemplateCtrl /templates] POST para User: ${mktv2UserId}`, parsedBody);

        const newTemplateData: Omit<NewWhatsappMessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'metaTemplateId' | 'statusMeta'> & {mktv2UserId: number, statusMeta?: NewWhatsappMessageTemplate['statusMeta']} = {
            ...parsedBody,
            mktv2UserId,
            statusMeta: 'PENDING',
        };
        
        const [newTemplate] = await zapDb.insert(whatsappMessageTemplates)
            .values(newTemplateData)
            .returning();
        
        res.status(201).json(newTemplate);
    } catch (error) {
        console.error(`[ZapTemplateCtrl Create] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};

export const updateZapMessageTemplateController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: 'ID do template inválido.'});

    try {
        const parsedBody = insertWhatsappMessageTemplateSchema.omit({ 
            id: true, createdAt: true, updatedAt: true, mktv2UserId: true, metaTemplateId: true
            // StatusMeta pode ser atualizado por um processo separado de sync com a Meta
        }).partial().parse(req.body);

        console.log(`[ZapTemplateCtrl /templates/${templateId}] PUT para User: ${mktv2UserId}`, parsedBody);

        if (Object.keys(parsedBody).length === 0) {
            return res.status(400).json({ message: "Nenhum dado fornecido para atualização."});
        }

        const [updatedTemplate] = await zapDb.update(whatsappMessageTemplates)
            .set({ ...parsedBody, updatedAt: new Date() })
            .where(and(
                eq(whatsappMessageTemplates.id, templateId),
                eq(whatsappMessageTemplates.mktv2UserId, mktv2UserId)
            ))
            .returning();
        
        if (!updatedTemplate) return res.status(404).json({ message: 'Template não encontrado ou não pertence ao usuário.' });
        res.json(updatedTemplate);
    } catch (error) {
        console.error(`[ZapTemplateCtrl Update /templates/${templateId}] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};

export const deleteZapMessageTemplateController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ message: 'ID do template inválido.'});

    console.log(`[ZapTemplateCtrl /templates/${templateId}] DELETE para User: ${mktv2UserId}`);
    try {
        const result = await zapDb.delete(whatsappMessageTemplates)
            .where(and(
                eq(whatsappMessageTemplates.id, templateId),
                eq(whatsappMessageTemplates.mktv2UserId, mktv2UserId)
            ));
        
        if (result.rowCount === 0) return res.status(404).json({ message: 'Template não encontrado ou não pertence ao usuário.' });
        res.status(204).send();
    } catch (error) {
        console.error(`[ZapTemplateCtrl Delete /templates/${templateId}] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};