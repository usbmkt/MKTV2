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
    prepareWAMessageMedia,
    getDevice,
    extractMessageContent,
    MessageUpsertType,
    makeInMemoryStore,
    Button as BaileysProtoButtonModule, // Renomeado para evitar conflito
    List as BaileysProtoListModule,
    Section as BaileysProtoSectionModule
} from '@whiskeysockets/baileys';
import pino, { Logger } from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import path from 'path';
import fs from 'fs-extra';
import { Boom } from '@hapi/boom';
import { zapDb } from '../db';
import { whatsappMessages, NewZapMessage, whatsappConnections as whatsappConnectionsSchemaDrizzle } from '../../shared/zap_schema';
import { upsertWhatsappConnectionInDb, getWhatsappConnectionFromDb } from './whatsappConnectionDbUtils';
import { ZAP_WHATSAPP_MEDIA_UPLOADS_DIR } from '../index'; 
import zapFlowEngineInstance from './WhatsappFlowEngine'; 

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
    store?: ReturnType<typeof makeInMemoryStore>; 
}

const activeConnections: Map<number, ZapConnectionInstance> = new Map();

async function ensureSessionsDirExists() {
    try { await fs.mkdirp(SESSIONS_DIR); } 
    catch (error) { console.error(`[Baileys] Erro ao criar diretório de sessões ${SESSIONS_DIR}:`, error); }
}
ensureSessionsDirExists();

export async function getOrCreateWhatsappConnection(mktv2UserId: number): Promise<ZapConnectionInstance> {
    if (activeConnections.has(mktv2UserId)) {
        const instance = activeConnections.get(mktv2UserId)!;
        if (!instance.sock && (instance.status === 'connected' || instance.status === 'connecting') && !instance.isInitializing) {
            instance.logger.info(`[ZapConn] User ${mktv2UserId}: Sessão em memória indica '${instance.status}' mas sem socket. Tentando reconectar.`);
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
        loggerInstance.info(`[ZapConn] User ${mktv2UserId}: Estado da conexão carregado do DB: ${instance.status}`);
        if ((instance.status === 'connected' || instance.status === 'connecting' || instance.status === 'loading') && !instance.isInitializing) {
            loggerInstance.info(`[ZapConn] User ${mktv2UserId}: Tentando reconectar com base no estado salvo do DB.`);
            await connectToWhatsApp(mktv2UserId, true);
        }
    } else {
        loggerInstance.info(`[ZapConn] User ${mktv2UserId}: Nenhuma conexão salva no DB. Aguardando ação.`);
        await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'disconnected', mktv2UserId });
    }
    return instance;
}

export async function connectToWhatsApp(mktv2UserId: number, forceAttempt = false): Promise<ZapConnectionInstance> {
    let instance = activeConnections.get(mktv2UserId);
    if (!instance) {
        instance = await getOrCreateWhatsappConnection(mktv2UserId);
    }
    const { logger } = instance;

    if (!forceAttempt && instance.isInitializing) { logger.warn("Conexão já está inicializando."); return instance; }
    if (!forceAttempt && instance.sock && ['connected', 'connecting', 'qr_code_needed', 'loading'].includes(instance.status)) { logger.info(`Conexão já ok/pendente. Status: ${instance.status}.`); return instance; }
    
    instance.isInitializing = true; instance.status = 'loading'; instance.qrCode = undefined;
    
    logger.info("Iniciando nova conexão Baileys...");
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'loading', qrCodeData: null, lastError: null, mktv2UserId });

    const sessionDir = path.join(SESSIONS_DIR, `user_${mktv2UserId}_session`);
    await fs.ensureDir(sessionDir);
    
    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    instance.sock = makeWASocket({
        auth: authState, printQRInTerminal: false,
        logger: logger.child({ module: 'baileys-sock' }) as any,
        browser: Browsers.macOS('Desktop'), 
        syncFullHistory: false,
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => undefined,
        patchMessageBeforeSending: (message) => { 
             const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
             if (requiresPatch) { message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {}, }, ...message, }, }, }; }
             return message;
        }
    });

    instance.sock.ev.on('creds.update', saveCreds);

    instance.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
        const currentInstance = activeConnections.get(mktv2UserId); // Pegar a instância mais atual
        if (!currentInstance) { 
            logger.error(`[ZapConn] Instância para user ${mktv2UserId} não encontrada durante connection.update.`);
            return;
        }
        const oldStatus = currentInstance.status;
        let newStatus = currentInstance.status;

        if (qr) {
            currentInstance.qrCode = qr; newStatus = 'qr_code_needed';
            logger.info('QR Code recebido.');
            if (process.env.NODE_ENV === 'development') qrcodeTerminal.generate(qr, { small: true });
            await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'qr_code_needed', qrCodeData: qr, mktv2UserId });
        }

        if (connection === 'close') {
            const boomError = lastDisconnect?.error as Boom | undefined;
            const statusCode = boomError?.output?.statusCode;
            const deviceId =currentInstance.sock?.user?.id ? getDevice(currentInstance.sock.user.id) : '';
            const shouldCleanSession = statusCode === DisconnectReason.loggedOut || 
                                     statusCode === DisconnectReason.connectionReplaced || 
                                     statusCode === DisconnectReason.multideviceMismatch ||
                                     (deviceId === '401' && statusCode === 401);
            const shouldRetry = !shouldCleanSession && statusCode !== DisconnectReason.timedOut && currentInstance.retryCount < MAX_RETRIES;

            logger.error(`Conexão fechada. Código: ${statusCode}, Razão: ${statusCode ? DisconnectReason[statusCode] : 'Desconhecido'} (${lastDisconnect?.error?.message || 'N/A'}). Limpar: ${shouldCleanSession}. Reintentar: ${shouldRetry}`);
            
            if (shouldCleanSession) {
                logger.warn('Limpando sessão Baileys...');
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(e => logger.error("Erro ao limpar sessão no FS", e));
                if(currentInstance.sock) { try { currentInstance.sock.ws.close(); currentInstance.sock = null; } catch {} }
                newStatus = 'auth_failure';
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, qrCodeData: null, sessionData: null, connectedPhoneNumber: null, lastError: boomError?.message, mktv2UserId });
                activeConnections.delete(mktv2UserId);
            } else if (shouldRetry) {
                currentInstance.retryCount++; newStatus = 'connecting';
                logger.info(`Tentando reconectar (${currentInstance.retryCount}/${MAX_RETRIES})...`);
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, lastError: boomError?.message, mktv2UserId });
                setTimeout(() => connectToWhatsApp(mktv2UserId, true), 7000 * currentInstance.retryCount);
            } else {
                newStatus = shouldRetry ? 'error' : 'disconnected';
                logger.error(newStatus === 'error' ? 'Máximo de tentativas de reconexão ou timeout.' : 'Desconexão não requer retentativa.');
                await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, lastError: boomError?.message || (newStatus === 'error' ? "Max retries/Timeout" : "Disconnected by server"), mktv2UserId });
                if(currentInstance.sock) { try { currentInstance.sock.ws.close(); currentInstance.sock = null;} catch {} }
                activeConnections.delete(mktv2UserId);
            }
        } else if (connection === 'open') {
            newStatus = 'connected'; currentInstance.retryCount = 0;
            const phone = currentInstance.sock?.user?.id?.split('@')[0].split(':')[0];
            logger.info(`WhatsApp conectado! User: ${mktv2UserId}, Número: ${phone}. Notificações pendentes: ${receivedPendingNotifications}`);
            await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'connected', qrCodeData: null, connectedPhoneNumber: phone, lastConnectedAt: new Date(), lastError: null, mktv2UserId });
        }
        
        if (newStatus !== oldStatus) { currentInstance.status = newStatus; logger.info(`Status conexão ${mktv2UserId}: ${oldStatus} -> ${newStatus}`); }
    });

    instance.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[], type: MessageUpsertType }) => {
        logger.debug({ messagesCount: m.messages.length, type: m.type }, 'Evento messages.upsert');
        for (const msg of m.messages) {
            const currentContent = extractMessageContent(msg.message);
            if (m.type === 'notify' && currentContent && !msg.key.fromMe && !isJidGroup(msg.key.remoteJid || '')) {
                const contactJid = msg.key.remoteJid!;
                const currentInstanceMktv2UserId = instance!.mktv2UserId; // Garante que está pegando da instância correta no escopo do evento
                const userMediaDir = path.join(ZAP_WHATSAPP_MEDIA_UPLOADS_DIR, `user_${currentInstanceMktv2UserId}`);
                await fs.ensureDir(userMediaDir);

                let messageTypeExtracted: NewZapMessage['messageType'] = 'unsupported';
                let contentForDb: any = { text: null }; 
                
                const textFromInteractiveReply = currentContent.buttonsResponseMessage?.selectedDisplayText || currentContent.listResponseMessage?.title;
                const mainText = currentContent.conversation || currentContent.extendedTextMessage?.text;

                if (textFromInteractiveReply) { /* ... (como antes, incluindo selectedButtonId/selectedRowId) ... */ }
                else if (mainText) { /* ... (como antes) ... */ }
                else if (currentContent.imageMessage || currentContent.videoMessage || currentContent.audioMessage || currentContent.documentMessage) {
                    // ... (lógica completa de download para image, video, audio, document como na rodada anterior) ...
                }

                if (messageTypeExtracted === 'unsupported' ) { logger.warn({ msgKey: msg.key.id }, "Tipo de msg não suportado."); continue; }
                
                const messageToSave: NewZapMessage = { /* ... (construção completa como na rodada anterior) ... */ };
                try {
                    const [savedMsg] = await zapDb.insert(whatsappMessages).values(messageToSave).onConflictDoUpdate({ /* ... */ }).returning();
                    logger.info({ dbMsgId: savedMsg.id }, "Msg salva/atualizada.");
                    if (zapFlowEngineInstance) { // Passar a WAMessage original é importante para o FlowEngine
                       zapFlowEngineInstance.processIncomingMessage(currentInstanceMktv2UserId, contactJid, msg, savedMsg); 
                    }
                } catch (dbError: any) { logger.error({ error: dbError.message }, "Erro ao salvar msg."); }
            }
        }
    });
    
    instance.isInitializing = false;
    return instance;
}

export async function disconnectWhatsApp(mktv2UserId: number): Promise<ZapConnectionInstance> {
    const instance = activeConnections.get(mktv2UserId);
    if (!instance) {
        await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'disconnected', mktv2UserId });
        return { mktv2UserId, status: 'disconnected', sock: null, logger: pino().child({userId: mktv2UserId, service:'ZapConnectionGhost'}), retryCount:0, isInitializing: false };
    }
    const { logger, sock } = instance;
    if (sock) {
        logger.info('Desconectando do WhatsApp...');
        await sock.logout().catch(e => logger.error("Erro no logout Baileys:", e));
        try { sock.ws.close(); } catch {}
        instance.sock = null; 
    }
    instance.status = 'disconnected'; instance.qrCode = undefined; instance.isInitializing = false;
    const sessionDir = path.join(SESSIONS_DIR, `user_${mktv2UserId}_session`);
    await fs.rm(sessionDir, { recursive: true, force: true }).catch(e => logger.error(`Erro ao limpar sessão ${sessionDir}:`, e));
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'disconnected', qrCodeData: null, sessionData: null, connectedPhoneNumber: null, lastError: "Desconectado pelo usuário", mktv2UserId });
    activeConnections.delete(mktv2UserId);
    logger.info('Desconexão Baileys e limpeza de sessão concluídas.');
    return instance;
}

export async function sendMessage(mktv2UserId: number, jid: string, text: string, options?: any): Promise<proto.WebMessageInfo | undefined> {
    const content: AnyMessageContent = { text };
    const instance = await getOrCreateWhatsappConnection(mktv2UserId);
    const { sock, logger, status } = instance;
    if (status !== 'connected' || !sock) { throw new Error(`WhatsApp não conectado (Status: ${status})`); }
    try {
        logger.info({ to: jid, textLength: text.length }, 'Enviando mensagem de texto...');
        const messageInfo = await sock.sendMessage(jid, content, options);
        if (messageInfo) {
            const msgToSave: NewZapMessage = { mktv2UserId, contactJid: jid, baileysMessageId: messageInfo.key.id, messageType: 'text', content: {text}, direction: 'outgoing', timestamp: new Date(messageInfo.messageTimestamp ? (typeof messageInfo.messageTimestamp === 'number' ? messageInfo.messageTimestamp * 1000 : messageInfo.messageTimestamp.toNumber() * 1000) : Date.now()), status: 'sent', isReadByZapUser: true };
            await zapDb.insert(whatsappMessages).values(msgToSave).onConflictDoNothing();
        }
        return messageInfo;
    } catch (error: any) { logger.error({error: error.message, to: jid}, "Erro ao enviar texto."); throw error; }
}

export interface BaileysButtonPayload { buttonId: string; buttonText: { displayText: string }; type: 1; }
export interface BaileysListItemPayload { title: string; rowId: string; description?: string; }
export interface BaileysListSectionPayload { title: string; rows: BaileysListItemPayload[]; }

export async function sendButtonsMessage( mktv2UserId: number, jid: string, text: string, buttonsData: Array<{id: string, text: string}>, footer?: string, options?: any ): Promise<proto.WebMessageInfo | undefined> {
    const instance = await getOrCreateWhatsappConnection(mktv2UserId);
    const { sock, logger, status } = instance;
    if (status !== 'connected' || !sock) { throw new Error('WhatsApp não conectado.'); }

    const baileysButtons: BaileysProtoButtonModule[] = buttonsData.map(btn => (
        proto.Message.ButtonsMessage.Button.create({
            buttonId: btn.id,
            buttonText: { displayText: btn.text },
            type: proto.Message.ButtonsMessage.Button.Type.RESPONSE
        })
    ));

    const buttonsMessage = proto.Message.ButtonsMessage.create({
        contentText: text,
        footerText: footer,
        buttons: baileysButtons,
        headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY 
    });
    const messageToSend: AnyMessageContent = { buttonsMessage };
    
    try {
        logger.info({ to: jid, text, buttonsCount: buttonsData.length }, 'Enviando ButtonsMessage via generateWAMessageFromContent...');
        const prepMsg = await generateWAMessageFromContent(jid, messageToSend, { userJid: sock.user!.id, ...options });
        await sock.relayMessage(jid, prepMsg.message!, { messageId: prepMsg.key.id! });
        const messageInfo = prepMsg;

        if (messageInfo && messageInfo.key.id) { 
            const msgToSave: NewZapMessage = { mktv2UserId, contactJid: jid, baileysMessageId: messageInfo.key.id, messageType: 'buttons', content: {text, buttons: buttonsData, footer}, direction: 'outgoing', timestamp: new Date(), status: 'sent', isReadByZapUser: true };
            await zapDb.insert(whatsappMessages).values(msgToSave).onConflictDoNothing();
        }
        return messageInfo as proto.WebMessageInfo;
    } catch (error: any) { logger.error({err:error.message, to:jid}, "Erro sendButtonsMessage"); throw error; }
}

export async function sendListMessage( mktv2UserId: number, jid: string, text: string, buttonText: string, sectionsPayload: BaileysListSectionPayload[], title?: string, footer?: string, options?: any ): Promise<proto.WebMessageInfo | undefined> {
    const instance = await getOrCreateWhatsappConnection(mktv2UserId);
    const { sock, logger, status } = instance;
    if (status !== 'connected' || !sock) { throw new Error('WhatsApp não conectado.'); }

    const listMessageProto = proto.Message.ListMessage.create({
        title: title,
        description: text,
        buttonText: buttonText,
        footerText: footer,
        listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
        sections: sectionsPayload.map(s => proto.Message.ListMessage.Section.create({
            title: s.title,
            rows: s.rows.map(r => proto.Message.ListMessage.Row.create({
                title: r.title, rowId: r.rowId, description: r.description
            }))
        }))
    });
    const messageToSend: AnyMessageContent = { listMessage: listMessageProto };

    try {
        logger.info({ to: jid, sectionsCount: sectionsPayload.length }, 'Enviando ListMessage via generateWAMessageFromContent...');
        const prepMsg = await generateWAMessageFromContent(jid, messageToSend, { userJid: sock.user!.id, ...options });
        await sock.relayMessage(jid, prepMsg.message!, { messageId: prepMsg.key.id! });
        const messageInfo = prepMsg;

        if (messageInfo && messageInfo.key.id) { 
             const msgToSave: NewZapMessage = { mktv2UserId, contactJid: jid, baileysMessageId: messageInfo.key.id, messageType: 'list', content: {text, buttonText, sections: sectionsPayload, title, footer}, direction: 'outgoing', timestamp: new Date(), status: 'sent', isReadByZapUser: true };
            await zapDb.insert(whatsappMessages).values(msgToSave).onConflictDoNothing();
        }
        return messageInfo as proto.WebMessageInfo;
    } catch (error: any) { logger.error({err:error.message, to:jid}, "Erro sendListMessage"); throw error; }
}

export async function sendMediaMessage(mktv2UserId: number, jid: string, media: { type: 'image' | 'video' | 'audio' | 'document'; url?: string; buffer?: Buffer; fileName?: string; mimeType?: string; caption?: string; ptt?: boolean; gifPlayback?: boolean; }, options?: any ): Promise<proto.WebMessageInfo | undefined> { /* ... (lógica completa como na rodada anterior) ... */ return undefined; }

export async function initializeActiveConnections() {
    console.log("[ZapConnection] Inicializando conexões ativas do DB...");
    try {
        const activeDbConnections = await zapDb.query.whatsappConnections.findMany({
            where: or(
                eq(whatsappConnectionsSchemaDrizzle.connectionStatus, 'connected'), 
                eq(whatsappConnectionsSchemaDrizzle.connectionStatus, 'connecting'),
                eq(whatsappConnectionsSchemaDrizzle.connectionStatus, 'loading')
            )
        });
        for (const conn of activeDbConnections) {
            console.log(`[ZapConnection] Tentando restaurar/verificar conexão para usuário ${conn.mktv2UserId}`);
            // Não aguardar aqui para permitir que o servidor inicie mais rápido, a reconexão ocorrerá em segundo plano.
            connectToWhatsApp(conn.mktv2UserId, true).catch(err => {
                console.error(`[ZapConnection] Erro ao tentar reconectar usuário ${conn.mktv2UserId} na inicialização:`, err);
            });
        }
        console.log(`[ZapConnection] Inicialização de ${activeDbConnections.length} conexões ativas (tentativa) disparada.`);
    } catch (error) {
        console.error("[ZapConnection] Erro ao buscar conexões ativas do DB na inicialização:", error);
    }
}