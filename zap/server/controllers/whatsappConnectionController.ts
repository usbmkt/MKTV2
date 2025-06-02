// zap/server/controllers/whatsappConnectionController.ts
import { Request, Response, NextFunction } from 'express';
import { 
    getOrCreateWhatsappConnection, 
    connectToWhatsApp as connectBaileysToWhatsAppService,
    disconnectWhatsApp as disconnectBaileysFromWhatsAppService 
} from '../services/WhatsappConnectionService';
import { zapDb } from '../db'; // Importar zapDb para buscar dados adicionais se necessário
import { whatsappConnections } from '../../shared/zap_schema';
import { eq } from 'drizzle-orm';

const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapConnectionStatusController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapConnCtrl /connection/status] GET para User: ${mktv2UserId}`);
    try {
        const instance = await getOrCreateWhatsappConnection(mktv2UserId);
        const dbConn = await zapDb.query.whatsappConnections.findFirst({ 
            where: eq(whatsappConnections.mktv2UserId, mktv2UserId)
        });
        
        res.json({
            status: instance.status,
            qrCode: instance.qrCode,
            connectedPhoneNumber: dbConn?.connectedPhoneNumber || instance.sock?.user?.id?.split('@')[0].split(':')[0],
            lastError: dbConn?.lastError,
            mktv2UserId
        });
    } catch (error) {
        console.error(`[ZapConnCtrl /connection/status] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};

export const connectZapController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapConnCtrl /connection/connect] POST para User: ${mktv2UserId}`);
    try {
        const instance = await connectBaileysToWhatsAppService(mktv2UserId, true); // true para forçar nova tentativa
        res.json({ 
            status: instance.status, 
            qrCode: instance.qrCode, 
            mktv2UserId 
        });
    } catch (error) {
        console.error(`[ZapConnCtrl /connection/connect] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};

export const disconnectZapController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapConnCtrl /connection/disconnect] POST para User: ${mktv2UserId}`);
    try {
        const instance = await disconnectBaileysFromWhatsAppService(mktv2UserId);
        res.json({ status: instance.status, mktv2UserId });
    } catch (error) {
        console.error(`[ZapConnCtrl /connection/disconnect] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
}; 
