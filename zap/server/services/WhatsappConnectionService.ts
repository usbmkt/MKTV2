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
    generateWAMessageFromContent, // Para controle total do envio
    MediaType, // Para prepareWAMessageMedia
    prepareWAMessageMedia // Para upload de mídia local
} from '@whiskeysockets/baileys';
import pino, { Logger } from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import path from 'path';
import fs from 'fs-extra';
import { Boom } from '@hapi/boom';
import { zapDb } from '../db';
import { whatsappMessages, NewZapMessage, whatsappConnections as whatsappConnectionsSchema } from '../../shared/zap_schema'; // Schema correto
import { upsertWhatsappConnectionInDb, getWhatsappConnectionFromDb } from './whatsappConnectionDbUtils'; // Nossos helpers de DB
import { ZAP_WHATSAPP_MEDIA_UPLOADS_DIR } from '../index'; // Diretório de uploads
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
            await connectToWhatsApp(mktv2UserId, true); // true para forçar nova tentativa
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
    if (!instance) { // Deve ser criado por getOrCreateWhatsappConnection
        const loggerInstance = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ userId: mktv2UserId, service: 'ZapConnection' });
        instance = { sock: null, status: 'disconnected', mktv2UserId, logger: loggerInstance, retryCount: 0, isInitializing: false };
        activeConnections.set(mktv2UserId, instance);
    }

    const { logger } = instance;

    if (!forceAttempt && instance.isInitializing) {
        logger.warn("Tentativa de conectar enquanto já está inicializando. Ignorando."); return instance;
    }
    if (!forceAttempt && instance.sock && ['connected', 'connecting', 'qr_code_needed', 'loading'].includes(instance.status)) {
        logger.info(`Conexão já ativa ou pendente. Status: ${instance.status}.`); return instance;
    }
    
    instance.isInitializing = true;
    instance.status = 'loading';
    instance.qrCode = undefined;
    // instance.retryCount = (instance.status === 'auth_failure' || instance.status === 'error') ? 0 : instance.retryCount; // Resetar apenas em falhas que não sejam de retentativa

    logger.info("Iniciando nova conexão com WhatsApp...");
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'loading', qrCodeData: null });

    const sessionDir = path.join(SESSIONS_DIR, `user_${mktv2UserId}_session`);
    await fs.ensureDir(sessionDir);
    
    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

    instance.sock = makeWASocket({
        auth: authState, printQRInTerminal: false,
        logger: logger.child({ module: 'baileys-sock' }) as any,
        browser: Browsers.macOS('Chrome'), syncFullHistory: false, // Importante para performance
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => undefined, // Não usar store Baileys por enquanto
        patchMessageBeforeSending: (message) => { /* ... (patch como antes) ... */ return message; }
    });

    instance.sock.ev.on('creds.update', saveCreds);

    instance.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
        const oldStatus = instance!.status;
        let newStatus = instance!.status;

        if (qr) {
            instance!.qrCode = qr; newStatus = 'qr_code_needed';
            logger.info('QR Code recebido. Escaneie ou atualize o frontend.');
            if (process.env.NODE_ENV === 'development') qrcodeTerminal.generate(qr, { small: true });
            await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'qr_code_needed', qrCodeData: qr });
        }

        if (connection === 'close') {
            const boomError = lastDisconnect?.error as Boom | undefined;
            const statusCode = boomError?.output?.statusCode;
            const shouldCleanSession = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.multideviceMismatch;
            const shouldRetry = !shouldCleanSession && statusCode !== DisconnectReason.timedOut; // Exemplo, ajuste conforme necessidade

            logger.error(`Conexão fechada. Razão: ${statusCode ? DisconnectReason[statusCode] : 'Desconhecido'} (${lastDisconnect?.error?.message || 'N/A'}). Limpar Sessão: ${shouldCleanSession}. Tentar Reconectar: ${shouldRetry && instance!.retryCount < MAX_RETRIES}`);
            
            if (shouldCleanSession) {
                logger.warn('Limpando sessão devido a logout, substituição ou mismatch de dispositivo.');
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(e => logger.error("Erro ao limpar sessão no FS", e));
                activeConnections.delete(mktv2UserId); // Forçar recriação da instância
                newStatus = 'auth_failure';
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, qrCodeData: null, sessionData: null, connectedPhoneNumber: null, lastError: boomError?.message });
            } else if (shouldRetry && instance!.retryCount < MAX_RETRIES) {
                instance!.retryCount++; newStatus = 'connecting';
                logger.info(`Tentando reconectar (${instance!.retryCount}/${MAX_RETRIES})...`);
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, lastError: boomError?.message });
                setTimeout(() => connectToWhatsApp(mktv2UserId, true), 5000 * instance!.retryCount);
            } else {
                newStatus = shouldRetry ? 'error' : 'disconnected'; // Se atingiu max_retries ou não deve tentar
                logger.error(shouldRetry ? 'Máximo de tentativas de reconexão atingido.' : 'Desconexão não requer retentativa.');
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, lastError: boomError?.message || (shouldRetry ? "Max retries reached" : "Disconnected") });
            }
        } else if (connection === 'open') {
            newStatus = 'connected'; instance!.retryCount = 0;
            const phone = instance!.sock?.user?.id?.split('@')[0].split(':')[0];
            logger.info(`WhatsApp conectado! Número: ${phone}. Notificações pendentes: ${receivedPendingNotifications}`);
            await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'connected', qrCodeData: null, connectedPhoneNumber: phone, lastConnectedAt: new Date(), lastError: null });
        }
        
        if (newStatus !== oldStatus) { instance!.status = newStatus; logger.info(`Status conexão ${mktv2UserId}: ${oldStatus} -> ${newStatus}`); }
    });

    instance.sock.ev.on('messages.upsert', async (m) => {
        logger.debug({ messagesInfo: m.messages.length, type: m.type }, 'Novas mensagens/atualizações recebidas.');
        for (const msg of m.messages) {
            if (m.type === 'notify' && msg.message && !isJidGroup(msg.key.remoteJid || '')) {
                const contactJid = msg.key.remoteJid!;
                
                let messageType: NewZapMessage['messageType'] = 'unsupported';
                let contentForDb: any = { rawBaileysMessage: Buffer.from(JSON.stringify(msg.message)).toString('base64') }; // Salvar raw como fallback
                let mediaUrlRelative: string | null = null; // Caminho relativo para mídia salva

                const textFromMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.buttonsResponseMessage?.selectedDisplayText || msg.message.listResponseMessage?.title;

                if (textFromMsg) {
                    messageType = 'text'; contentForDb = { text: textFromMsg };
                } else if (msg.message.imageMessage) {
                    messageType = 'image';
                    const imageMsg = msg.message.imageMessage;
                    contentForDb = { caption: imageMsg.caption, mimeType: imageMsg.mimetype, url: null };
                    try {
                        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: logger.child({ module: 'download-media' }) as any, reuploadRequest: instance?.sock?.updateMediaMessage });
                        const ext = imageMsg.mimetype?.split('/')[1] || 'jpg';
                        const fileName = `${msg.key.id}.${ext}`;
                        const userMediaDir = path.join(ZAP_WHATSAPP_MEDIA_UPLOADS_DIR, `user_${mktv2UserId}`);
                        await fs.ensureDir(userMediaDir);
                        const filePath = path.join(userMediaDir, fileName);
                        await fs.writeFile(filePath, buffer);
                        mediaUrlRelative = `/media/whatsapp_media/user_${mktv2UserId}/${fileName}`;
                        contentForDb.url = mediaUrlRelative;
                        logger.info(`Imagem salva em: ${filePath}, URL: ${mediaUrlRelative}`);
                    } catch (e: any) { logger.error({ err: e.message, msgKey: msg.key.id }, "Falha ao baixar/salvar imagem."); contentForDb.error = e.message; }
                } // TODO: Adicionar handlers para videoMessage, audioMessage, documentMessage

                if (messageType === 'unsupported') { logger.warn({ msgKey: msg.key }, "Tipo de msg não processado p/ DB."); continue; }
                
                const messageToSave: NewZapMessage = {
                    mktv2UserId, contactJid, baileysMessageId: msg.key.id, messageType, content: contentForDb,
                    direction: msg.key.fromMe ? 'outgoing' : 'incoming',
                    timestamp: new Date((typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp?.toNumber() || Date.now()) * 1000),
                    status: msg.key.fromMe ? (msg.status?.toString() as NewZapMessage['status'] || 'sent') : undefined,
                    isReadByZapUser: msg.key.fromMe ? true : false,
                };

                try {
                    logger.info({ baileysMsgId: msg.key.id, type: messageType }, "Salvando msg no DB...");
                    const [savedMsg] = await zapDb.insert(whatsappMessages).values(messageToSave).onConflictDoUpdate({ target: whatsappMessages.baileysMessageId, set: { status: messageToSave.status, content: messageToSave.content /* Atualiza content caso mídia seja baixada depois */ } }).returning();
                    logger.info({ dbMsgId: savedMsg.id }, "Msg salva/atualizada no DB.");
                    
                    // if (savedMsg.direction === 'incoming' && zapFlowEngineInstance) {
                    //    zapFlowEngineInstance.processIncomingMessage(mktv2UserId, contactJid, savedMsg);
                    // }
                } catch (dbError: any) { logger.error({ error: dbError.message, baileysMsgId: msg.key.id }, "Erro ao salvar msg no DB."); }
            }
        }
    });
    
    instance.isInitializing = false;
    return instance;
}

export async function disconnectWhatsApp(mktv2UserId: number): Promise<ZapConnectionInstance> { /* ... como antes, usando upsertWhatsappConnectionInDb ... */ return {} as ZapConnectionInstance }

export async function sendMessage(mktv2UserId: number, jid: string, content: AnyMessageContent, options?: any): Promise<proto.WebMessageInfo | undefined> { /* ... como antes, usando upsert e salvando no DB ... */ return undefined; }
export async function sendButtonsMessage(/*...como antes...*/): Promise<proto.WebMessageInfo | undefined> { /* ... como antes ... */ return undefined; }
export async function sendMediaMessage(/*...como antes...*/): Promise<proto.WebMessageInfo | undefined> { /* ... como antes, com generateWAMessageFromContent ... */ return undefined; }

export async function initializeActiveConnections() { /* ... como antes ... */ }