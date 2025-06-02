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
    isJidGroup, // Helper para verificar se é grupo
    downloadMediaMessage, // Para baixar mídias
    getDevice // para forçar reconexão em caso de multi-device error
} from '@whiskeysockets/baileys';
import pino, { Logger } from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import path from 'path';
import fs from 'fs-extra';
import { Boom } from '@hapi/boom';
import { zapDb } from '../db';
import { whatsappMessages, NewZapMessage, insertWhatsappMessageSchema } from '../../shared/zap_schema';
import { upsertWhatsappConnectionInDb, getWhatsappConnectionFromDb } from './whatsappConnectionDbUtils';
// import zapFlowEngineInstance from './WhatsappFlowEngine'; // Importar quando o FlowEngine estiver pronto

const SESSIONS_DIR = path.join(process.cwd(), 'zap_sessions'); // process.cwd() refere-se à raiz do projeto MKTV2
const MAX_RETRIES = 3;

type InstanceStatus = 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'loading';

interface ZapConnectionInstance {
    sock: ReturnType<typeof makeWASocket> | null;
    status: InstanceStatus;
    qrCode?: string | null; // Permitir null do DB
    mktv2UserId: number;
    logger: Logger;
    retryCount: number;
    isInitializing?: boolean; // Flag para evitar múltiplas inicializações simultâneas
}

const activeConnections: Map<number, ZapConnectionInstance> = new Map();

async function ensureSessionsDirExists() {
    try {
        await fs.mkdirp(SESSIONS_DIR);
    } catch (error) {
        console.error(`[Baileys] Erro ao criar diretório de sessões ${SESSIONS_DIR}:`, error);
    }
}
ensureSessionsDirExists();

export async function getOrCreateWhatsappConnection(mktv2UserId: number): Promise<ZapConnectionInstance> {
    if (activeConnections.has(mktv2UserId)) {
        const instance = activeConnections.get(mktv2UserId)!;
        if (!instance.sock && instance.status === 'connected' && !instance.isInitializing) {
            instance.logger.info("Sessão encontrada como 'connected' mas sem socket ativo. Tentando reconectar.");
            await connectToWhatsApp(mktv2UserId, true);
        }
        return instance;
    }

    const loggerInstance = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ userId: mktv2UserId, service: 'ZapConnection' });
    const instance: ZapConnectionInstance = {
        sock: null,
        status: 'disconnected',
        mktv2UserId,
        logger: loggerInstance,
        retryCount: 0,
        isInitializing: false,
    };
    activeConnections.set(mktv2UserId, instance);

    const savedConnection = await getWhatsappConnectionFromDb(mktv2UserId);
    if (savedConnection) {
        instance.status = savedConnection.connectionStatus as InstanceStatus;
        instance.qrCode = savedConnection.qrCodeData;
        instance.logger.info(`Estado da conexão carregado do DB: ${instance.status}`);
        if ((instance.status === 'connected' || instance.status === 'connecting') && !instance.isInitializing) {
            instance.logger.info("Tentando reconectar com base no estado salvo do DB.");
            await connectToWhatsApp(mktv2UserId, true); // forceAttempt true
        }
    }
    return instance;
}

export async function connectToWhatsApp(mktv2UserId: number, forceAttempt = false): Promise<ZapConnectionInstance> {
    let instance = activeConnections.get(mktv2UserId);
    if (!instance) {
      // Se não existe, getOrCreateWhatsappConnection deveria ter criado. Log de erro para segurança.
      console.error(`[ZapConnectionService] Instância não encontrada para usuário ${mktv2UserId} em connectToWhatsApp. Isso não deveria acontecer.`);
      // Criar agora para evitar falha total
      const loggerInstance = pino({ level: process.env.ZAP_LOG_LEVEL || 'info', transport: { target: 'pino-pretty'} }).child({ userId: mktv2UserId, service: 'ZapConnection' });
      instance = { sock: null, status: 'disconnected', mktv2UserId, logger: loggerInstance, retryCount: 0, isInitializing: false };
      activeConnections.set(mktv2UserId, instance);
    }

    const { logger } = instance;

    if (!forceAttempt && instance.isInitializing) {
        logger.warn("Tentativa de conectar enquanto já está inicializando. Ignorando.");
        return instance;
    }
    if (!forceAttempt && instance.sock && (instance.status === 'connected' || instance.status === 'connecting' || instance.status === 'qr_code_needed')) {
        logger.info(`Conexão já ok ou pendente. Status: ${instance.status}. QR: ${!!instance.qrCode}`);
        return instance;
    }
    
    instance.isInitializing = true;
    instance.status = 'loading';
    instance.qrCode = undefined;
    // Não resetar retryCount aqui, pois pode ser uma reconexão

    logger.info("Iniciando conexão com WhatsApp...");
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'loading', qrCodeData: null });

    const sessionDir = path.join(SESSIONS_DIR, `user_${mktv2UserId}_session`);
    await fs.ensureDir(sessionDir);
    
    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

    instance.sock = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        logger: logger.child({ module: 'baileys-sock' }) as any,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false,
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => undefined,
        patchMessageBeforeSending: (message) => { // Adicionado para garantir IDs de mensagem
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
    });

    instance.sock.ev.on('creds.update', saveCreds);

    instance.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
        const oldStatus = instance!.status; // Captura o status ANTES de qualquer mudança
        let newStatus = instance!.status; // Começa com o status atual

        if (qr) {
            instance!.qrCode = qr;
            newStatus = 'qr_code_needed';
            logger.info('QR Code recebido. Escaneie ou atualize o frontend.');
            if (process.env.NODE_ENV === 'development') qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const boomError = lastDisconnect?.error as Boom | undefined;
            const statusCode = boomError?.output?.statusCode;
            const deviceId = getDevice(lastDisconnect?.message || "");
            const shouldReconnect = 
                statusCode !== DisconnectReason.loggedOut && 
                statusCode !== DisconnectReason.connectionReplaced &&
                statusCode !== DisconnectReason.multideviceMismatch && // Erro de multi-dispositivo, limpar sessão
                (deviceId !== '401' || statusCode !== 401); // Erro 401 específico de dispositivo

            logger.error(`Conexão fechada. Razão: ${statusCode ? DisconnectReason[statusCode] : 'Desconhecido'} (${lastDisconnect?.error?.message || 'N/A'}). Reconectar: ${shouldReconnect}`);
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.multideviceMismatch || (deviceId === '401' && statusCode === 401) ) {
                logger.warn('Usuário deslogado, conexão substituída ou erro multi-device. Limpando sessão.');
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(e => logger.error("Erro ao limpar sessão no FS", e));
                activeConnections.delete(mktv2UserId);
                newStatus = 'auth_failure';
            } else if (shouldReconnect && instance!.retryCount < MAX_RETRIES) {
                instance!.retryCount++;
                newStatus = 'connecting';
                logger.info(`Tentando reconectar (${instance!.retryCount}/${MAX_RETRIES})...`);
                setTimeout(() => connectToWhatsApp(mktv2UserId, true), 5000 * instance!.retryCount);
            } else if (shouldReconnect) {
                newStatus = 'error';
                logger.error('Máximo de tentativas de reconexão atingido.');
            } else {
                 newStatus = 'disconnected'; // Se não deve reconectar e não é auth_failure
            }
            await upsertWhatsappConnectionInDb(mktv2UserId, { status: newStatus, lastError: boomError?.message, qrCodeData: null });
        } else if (connection === 'open') {
            newStatus = 'connected';
            instance!.retryCount = 0;
            const phone = instance!.sock?.user?.id?.split(':')[0].split(':')[0];
            logger.info(`WhatsApp conectado! Número: ${phone}. Recebeu ${receivedPendingNotifications ? '' : 'NÃO '}notificações pendentes.`);
            await upsertWhatsappConnectionInDb(mktv2UserId, { 
                status: 'connected', 
                qrCodeData: null, 
                connectedPhoneNumber: phone, 
                lastConnectedAt: new Date(),
                lastError: null
            });
        }
        
        if (newStatus !== oldStatus) {
            instance!.status = newStatus;
            logger.info(`Status da conexão para ${mktv2UserId} mudou de ${oldStatus} para ${newStatus}`);
        }
    });

    instance.sock.ev.on('messages.upsert', async (m) => {
        logger.debug({ messagesInfo: m }, 'Novas mensagens/atualizações recebidas.');
        for (const msg of m.messages) {
            if (m.type === 'notify' && msg.message && !isJidGroup(msg.key.remoteJid || '')) {
                const contactJid = msg.key.remoteJid!;
                
                let messageType: NewZapMessage['messageType'] = 'unsupported';
                let contentForDb: any = { rawBaileysMessage: msg.message }; // Salvar o objeto Baileys como fallback

                if (msg.message.conversation) {
                    messageType = 'text';
                    contentForDb = { text: msg.message.conversation };
                } else if (msg.message.extendedTextMessage?.text) {
                    messageType = 'text';
                    contentForDb = { text: msg.message.extendedTextMessage.text };
                } else if (msg.message.imageMessage) {
                    messageType = 'image';
                    contentForDb = { caption: msg.message.imageMessage.caption, mimeType: msg.message.imageMessage.mimetype, url: null /* TODO */ };
                    // Lógica para baixar e salvar mídia:
                    // try {
                    //   const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: instance?.logger, reuploadRequest: instance?.sock?.updateMediaMessage });
                    //   // TODO: Salvar 'buffer' em um storage (S3, local) e obter a URL
                    //   // contentForDb.url = "url_da_midia_salva";
                    // } catch (e) { logger.error("Falha ao baixar imagem", e); }
                } // Adicionar mais tipos (video, audio, document)

                if (messageType === 'unsupported' ) {
                    logger.warn({ msgKey: msg.key, msgContent: msg.message }, "Tipo de mensagem não processado para DB.");
                    continue;
                }
                
                const messageToSave: NewZapMessage = {
                    mktv2UserId,
                    contactJid,
                    baileysMessageId: msg.key.id,
                    messageType,
                    content: contentForDb,
                    direction: msg.key.fromMe ? 'outgoing' : 'incoming',
                    timestamp: new Date( (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp?.toNumber() || Date.now()) * 1000 ),
                    status: msg.key.fromMe ? (msg.status?.toString() as NewZapMessage['status'] || 'sent') : undefined,
                    isReadByZapUser: msg.key.fromMe ? true : false,
                    // TODO: Tratar quotedMessage
                };

                try {
                    logger.info({ baileysMsgId: msg.key.id, type: messageType }, "Salvando mensagem no DB...");
                    await zapDb.insert(whatsappMessages).values(messageToSave).onConflictDoUpdate({
                        target: whatsappMessages.baileysMessageId,
                        set: { status: messageToSave.status } // Atualizar status se a msg já existir
                    });
                    logger.info("Mensagem salva/atualizada no DB.");
                    // if (messageToSave.direction === 'incoming' && zapFlowEngineInstance) {
                    //    zapFlowEngineInstance.processIncomingMessage(mktv2UserId, contactJid, contentForDb, msg);
                    // }
                } catch (dbError) {
                    logger.error({ error: dbError, baileysMsgId: msg.key.id }, "Erro ao salvar mensagem no DB.");
                }
            } else if (m.type === 'append') { // Histórico de mensagens, não processar como novas
                 logger.debug("Mensagens de histórico recebidas (append), ignorando para nova inserção/fluxo.");
            }
        }
    });
    
    instance.isInitializing = false;
    return instance;
}

export async function disconnectWhatsApp(mktv2UserId: number): Promise<ZapConnectionInstance> {
    // ... (código como na resposta anterior, mas usando upsertWhatsappConnectionInDb) ...
    const instance = activeConnections.get(mktv2UserId);
    if (!instance) {
        await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'disconnected' });
        return { mktv2UserId, status: 'disconnected', sock: null, logger: pino().child({userId: mktv2UserId}), retryCount:0 };
    }
    // ... (restante da lógica de desconexão) ...
    await upsertWhatsappConnectionInDb(mktv2UserId, { status: 'disconnected', qrCodeData: null, sessionData: null, connectedPhoneNumber: null });
    activeConnections.delete(mktv2UserId);
    return instance;
}

export async function sendMessage(
    mktv2UserId: number,
    jid: string,
    content: AnyMessageContent,
    options?: any
): Promise<proto.WebMessageInfo | undefined> {
    const instance = await getOrCreateWhatsappConnection(mktv2UserId); // Garante que a instância exista e tenta conectar se necessário
    const { sock, logger, status } = instance;

    if (status !== 'connected' || !sock) {
        logger.error(`Não é possível enviar mensagem. Status da conexão: ${status}`);
        await upsertWhatsappConnectionInDb(mktv2UserId, {status: instance.status, lastError: `Tentativa de envio enquanto ${status}`});
        throw new Error(`WhatsApp não conectado para o usuário ${mktv2UserId}. Status: ${status}. Tente reconectar.`);
    }

    try {
        logger.info({ to: jid, content: Object.keys(content) }, 'Enviando mensagem via Baileys...');
        const messageInfo = await sock.sendMessage(jid, content, options);
        logger.info({ messageId: messageInfo?.key.id }, 'Mensagem enviada com sucesso via Baileys.');
        
        if (messageInfo) {
            const messageTypeRaw = Object.keys(content)[0];
            let finalMessageType: NewZapMessage['messageType'] = 'unsupported';
            if (messageTypeRaw === 'text') finalMessageType = 'text';
            else if (messageTypeRaw === 'imageMessage') finalMessageType = 'image';
            // Adicionar mais mapeamentos

            const messageToSave: NewZapMessage = {
                mktv2UserId,
                contactJid: jid,
                baileysMessageId: messageInfo.key.id,
                messageType: finalMessageType,
                content: content,
                direction: 'outgoing',
                timestamp: new Date( (typeof messageInfo.messageTimestamp === 'number' ? messageInfo.messageTimestamp : messageInfo.messageTimestamp?.toNumber() || Date.now()) * 1000 ),
                status: 'sent', // Baileys pode enviar updates via 'messages.update'
                isReadByZapUser: true,
            };
             try {
                await zapDb.insert(whatsappMessages).values(messageToSave).onConflictDoNothing();
                logger.info("Mensagem de saída salva no DB.");
            } catch (dbError) {
                logger.error({ error: dbError, messageToSave }, "Erro ao salvar mensagem de SAÍDA no DB.");
            }
        }
        return messageInfo;
    } catch (error: any) {
        logger.error({ error: error.message, to: jid }, 'Erro ao enviar mensagem via Baileys.');
        await upsertWhatsappConnectionInDb(mktv2UserId, {status: instance.status, lastError: `Falha ao enviar msg: ${error.message}`});
        throw error;
    }
}

export async function initializeActiveConnections() {
    console.log("[ZapConnection] Inicializando conexões ativas do DB...");
    const activeDbConnections = await zapDb.query.whatsappConnections.findMany({
        where: or(
            eq(whatsappConnections.connectionStatus, 'connected'), 
            eq(whatsappConnections.connectionStatus, 'connecting'),
            eq(whatsappConnections.connectionStatus, 'loading') // Tentar reconectar se estava carregando
        )
    });
    for (const conn of activeDbConnections) {
        console.log(`[ZapConnection] Tentando restaurar/verificar conexão para usuário ${conn.mktv2UserId}`);
        await connectToWhatsApp(conn.mktv2UserId, true); // forceAttempt true
    }
    console.log(`[ZapConnection] Inicialização de ${activeDbConnections.length} conexões ativas (tentativa) concluída.`);
}