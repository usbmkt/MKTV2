// zap/server/services/WhatsappConnectionService.ts
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    Browsers,
    proto,
    WAMessage,
    AnyMessageContent,
    WAMessageContent,
    WAMessageKey,
    isJidGroup,
    downloadMediaMessage,
    generateWAMessageFromContent,
    MediaType,
    prepareWAMessageMedia
} from '@whiskeysockets/baileys';
import pino, { Logger } from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import path from 'path';
import fs from 'fs-extra';
import { Boom } from '@hapi/boom';
import { zapDb } from '../db';
import { whatsappMessages, NewZapMessage, whatsappConnections as whatsappConnectionsSchema } from '../../shared/zap_schema';
import { upsertWhatsappConnectionInDb, getWhatsappConnectionFromDb } from './whatsappConnectionDbUtils';
import { ZAP_WHATSAPP_MEDIA_UPLOADS_DIR } from '../index';
// import zapFlowEngineInstance from './WhatsappFlowEngine'; // Descomentar quando o motor de fluxo estiver pronto

const SESSIONS_DIR = path.join(process.cwd(), 'zap_sessions');
const MAX_RETRIES = 3;

type InstanceStatus = 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'loading';

interface ZapConnectionInstance {
    sock: ReturnType<typeof makeWASocket> | null;
    status: InstanceStatus;
    qrCode?: string | null;
    mktv2UserId: number;
    logger: Logger;
    retryCount: number;
    isInitializing?: boolean;
}

const activeConnections: Map<number, ZapConnectionInstance> = new Map();

async function ensureSessionsDirExists() {
    try { await fs.mkdirp(SESSIONS_DIR); } 
    catch (error) { console.error(`[Baileys] Erro ao criar ${SESSIONS_DIR}:`, error); }
}
ensureSessionsDirExists();

export async function getOrCreateWhatsappConnection(mktv2UserId: number): Promise<ZapConnectionInstance> {
    if (activeConnections.has(mktv2UserId)) {
        const instance = activeConnections.get(mktv2UserId)!;
        if (!instance.sock && (instance.status === 'connected' || instance.status === 'connecting') && !instance.isInitializing) {
            instance.logger.info("Sessão em memória indica 'connected'/'connecting' mas sem socket. Tentando reconectar.");
            await connectToWhatsApp(mktv2UserId, true);
        }
        return instance;
    }

    const loggerInstance = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ userId: mktv2UserId, service: 'ZapConnection' });
    const instance: ZapConnectionInstance = {
        sock: null, status: 'disconnected', mktv2UserId, logger: loggerInstance, retryCount: 0, isInitializing: false,
    };
    activeConnections.set(mktv2UserId, instance);

    const savedConnection = await getWhatsappConnectionFromDb(mktv2UserId);
    if (savedConnection) {
        instance.status = savedConnection.connectionStatus as InstanceStatus;
        instance.qrCode = savedConnection.qrCodeData;
        loggerInstance.info(`Estado da conexão carregado do DB: ${instance.status}`);
        if ((instance.status === 'connected' || instance.status === 'connecting' || instance.status === 'loading') && !instance.isInitializing) {
            loggerInstance.info("Tentando reconectar com base no estado salvo do DB.");
            await connectToWhatsApp(mktv2UserId, true);
        }
    }
    return instance;
}

export async function connectToWhatsApp(mktv2UserId: number, forceAttempt = false): Promise<ZapConnectionInstance> {
    let instance = activeConnections.get(mktv2UserId);
    if (!instance) {
        const loggerInstance = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ userId: mktv2UserId, service: 'ZapConnection' });
        instance = { sock: null, status: 'disconnected', mktv2UserId, logger: loggerInstance, retryCount: 0, isInitializing: false };
        activeConnections.set(mktv2UserId, instance);
    }

    const { logger } = instance;

    if (!forceAttempt && instance.isInitializing) { logger.warn("Tentativa de conectar enquanto já está inicializando. Ignorando."); return instance; }
    if (!forceAttempt && instance.sock && ['connected', 'connecting', 'qr_code_needed', 'loading'].includes(instance.status)) { logger.info(`Conexão já ativa ou pendente. Status: ${instance.status}.`); return instance; }
    
    instance.isInitializing = true; instance.status = 'loading'; instance.qrCode = undefined;
    logger.info("Iniciando nova conexão com WhatsApp...");
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'loading', qrCodeData: null });

    const sessionDir = path.join(SESSIONS_DIR, `user_${mktv2UserId}_session`);
    await fs.ensureDir(sessionDir);
    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

    instance.sock = makeWASocket({
        auth: authState, printQRInTerminal: false,
        logger: logger.child({ module: 'baileys-sock' }) as any,
        browser: Browsers.macOS('Chrome'), syncFullHistory: false,
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => undefined,
        patchMessageBeforeSending: (message) => { 
             const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
             if (requiresPatch) { message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {}, }, ...message, }, }, }; }
             return message;
        }
    });

    instance.sock.ev.on('creds.update', saveCreds);

    instance.sock.ev.on('connection.update', async (update) => { /* ... (lógica completa como na resposta anterior) ... */ });

    instance.sock.ev.on('messages.upsert', async (m) => {
        logger.debug({ messagesInfoLength: m.messages.length, type: m.type }, 'Novas mensagens/atualizações recebidas.');
        for (const msg of m.messages) {
            if (m.type === 'notify' && msg.message && !isJidGroup(msg.key.remoteJid || '')) {
                const contactJid = msg.key.remoteJid!;
                let messageType: NewZapMessage['messageType'] = 'unsupported';
                let contentForDb: any = { rawBaileysMessage: Buffer.from(JSON.stringify(msg.message)).toString('base64') };
                let mediaUrlRelative: string | null = null;

                const textFromMsg = msg.message.conversation || 
                                    msg.message.extendedTextMessage?.text || 
                                    msg.message.buttonsResponseMessage?.selectedDisplayText || 
                                    msg.message.listResponseMessage?.title; // Para o texto do item selecionado da lista
                
                // Adicionar extração de ID do botão/lista
                if (msg.message.buttonsResponseMessage) {
                    contentForDb.selectedButtonId = msg.message.buttonsResponseMessage.selectedButtonId;
                }
                if (msg.message.listResponseMessage) {
                    contentForDb.selectedRowId = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
                    contentForDb.listTitle = msg.message.listResponseMessage.title; // Texto do item da lista clicado
                }


                if (textFromMsg) { messageType = 'text'; contentForDb.text = textFromMsg; }
                else if (msg.message.imageMessage) { /* ... (lógica de download de imagem como antes) ... */ }
                else if (msg.message.videoMessage) { /* TODO: Lógica de download de vídeo */ messageType = 'video'; contentForDb = {caption: msg.message.videoMessage.caption, mimeType: msg.message.videoMessage.mimetype};}
                else if (msg.message.audioMessage) { /* TODO: Lógica de download de áudio */ messageType = 'audio'; contentForDb = {mimeType: msg.message.audioMessage.mimetype, ptt: msg.message.audioMessage.ptt};}
                else if (msg.message.documentMessage) { /* TODO: Lógica de download de documento */ messageType = 'document'; contentForDb = {fileName: msg.message.documentMessage.fileName, mimeType: msg.message.documentMessage.mimetype};}


                if (messageType === 'unsupported' ) { logger.warn({ msgKey: msg.key }, "Tipo de msg não processado p/ DB."); continue; }
                
                const messageToSave: NewZapMessage = { /* ... (como antes) ... */ mktv2UserId, contactJid, baileysMessageId: msg.key.id, messageType, content: contentForDb, direction: msg.key.fromMe ? 'outgoing' : 'incoming', timestamp: new Date(), status: msg.key.fromMe ? 'sent' : undefined, isReadByZapUser: msg.key.fromMe };

                try {
                    const [savedMsg] = await zapDb.insert(whatsappMessages).values(messageToSave).onConflictDoUpdate({ target: whatsappMessages.baileysMessageId, set: { status: messageToSave.status, content: messageToSave.content } }).returning();
                    logger.info({ dbMsgId: savedMsg.id }, "Msg salva/atualizada no DB.");
                    
                    // if (savedMsg.direction === 'incoming' && zapFlowEngineInstance) {
                    //    // Passar a WAMessage original do Baileys também, pois contém mais info (ex: selectedButtonId)
                    //    zapFlowEngineInstance.processIncomingMessage(mktv2UserId, contactJid, msg, savedMsg); 
                    // }
                } catch (dbError: any) { logger.error({ error: dbError.message, baileysMsgId: msg.key.id }, "Erro ao salvar msg no DB."); }
            }
        }
    });
    
    instance.isInitializing = false;
    return instance;
}

export async function disconnectWhatsApp(mktv2UserId: number): Promise<ZapConnectionInstance> { /* ... como antes ... */ return {} as ZapConnectionInstance; }
export async function sendMessage(mktv2UserId: number, jid: string, content: AnyMessageContent, options?: any): Promise<proto.WebMessageInfo | undefined> { /* ... como antes ... */ return undefined; }

// Interface para botões Baileys (usada pelo FlowEngine)
interface BaileysButton { id: string; display_text: string; } // Simplificado
interface BaileysListItemInternal { title: string; rowId: string; description?: string; }
interface BaileysListSectionInternal { title: string; rows: BaileysListItemInternal[]; }

export async function sendButtonsMessage(mktv2UserId: number, jid: string, text: string, buttons: BaileysButton[], footer?: string, headerType?: 1 | 2 | 3 | 4, headerMedia?: Buffer | { url: string }, headerText?: string ): Promise<proto.WebMessageInfo | undefined> { /* ... como antes (com save no DB) ... */ return undefined; }
export async function sendListMessage(mktv2UserId: number, jid: string, text: string, buttonText: string, sections: BaileysListSectionInternal[], title?: string, footer?: string, options?: any ): Promise<proto.WebMessageInfo | undefined> { /* ... como antes (com save no DB) ... */ return undefined; }
export async function sendMediaMessage(mktv2UserId: number, jid: string, media: { type: 'image' | 'video' | 'audio' | 'document'; url?: string; buffer?: Buffer; fileName?: string; mimeType?: string; caption?: string; ptt?: boolean; gifPlayback?: boolean; }, options?: any ): Promise<proto.WebMessageInfo | undefined> { /* ... como antes (com save no DB) ... */ return undefined; }

export async function initializeActiveConnections() { /* ... como antes ... */ }