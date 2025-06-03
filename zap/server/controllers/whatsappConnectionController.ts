// zap/server/controllers/whatsappConnectionController.ts
import { Request, Response, NextFunction } from 'express';
import { 
    getOrCreateWhatsappConnection, 
    connectToWhatsApp as connectBaileysToWhatsAppService,
    disconnectWhatsApp as disconnectBaileysFromWhatsAppService 
} from '../services/WhatsappConnectionService';
import { zapDb } from '../db';
import { whatsappConnections } from '../../shared/zap_schema'; // Schema do Zap
import { eq } from 'drizzle-orm';

// Helper para obter mktv2UserId do request (assumindo que o middleware de auth o define)
const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapConnectionStatusController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapConnCtrl /connection/status] GET para User: ${mktv2UserId}`);
    try {
        const instance = await getOrCreateWhatsappConnection(mktv2UserId);
        // Busca o status mais recente do DB, pois a instância em memória pode não ser a primeira a ser criada
        const dbConn = await zapDb.query.whatsappConnections.findFirst({ 
            where: eq(whatsappConnections.mktv2UserId, mktv2UserId)
        });
        
        let connectedPhoneNumber = instance.sock?.user?.id?.split('@')[0].split(':')[0];
        if (dbConn?.connectedPhoneNumber) {
            connectedPhoneNumber = dbConn.connectedPhoneNumber;
        }
        
        res.json({
            status: instance.status, // O status da instância em memória é o mais atualizado sobre a conexão real
            qrCode: instance.qrCode, // QR code da instância em memória
            connectedPhoneNumber: connectedPhoneNumber,
            lastError: dbConn?.lastError, // Último erro persistido
            mktv2UserId
        });
    } catch (error) {
        console.error(`[ZapConnCtrl /connection/status] Erro para User ${mktv2UserId}:`, error);
        next(error); // Encaminha para o handler de erro global
    }
};

export const connectZapController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    console.log(`[ZapConnCtrl /connection/connect] POST para User: ${mktv2UserId}`);
    try {
        // forceAttempt = true para garantir que uma nova tentativa de conexão seja feita
        const instance = await connectBaileysToWhatsAppService(mktv2UserId, true); 
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