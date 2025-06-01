// server/services/whatsapp-connection.service.ts
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    type WAConnectionState,
    type ConnectionState,
    type BaileysEventEmitter,
    type WAMessageKey,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs-extra';
import { Boom } from '@hapi/boom';
// Caminho corrigido para shared/schema (subindo dois níveis: services -> server -> shared)
import { users, whatsappConnections as whatsappConnectionsTable, type InsertWhatsappConnection, type WhatsappConnection } from '../../shared/schema';
// Caminho corrigido para storage (subindo um nível: services -> server)
import { storage } from '../storage';
// Caminho corrigido para db (subindo um nível: services -> server)
import { db as drizzleDB } from '../db';
import { eq } from 'drizzle-orm';

const SESSIONS_DIR = path.resolve(process.cwd(), 'whatsapp_sessions');
fs.ensureDirSync(SESSIONS_DIR);

interface WhatsappClient {
    socket: ReturnType<typeof makeWASocket> | null;
    eventEmitter: BaileysEventEmitter | null;
    userId: number;
    status: WAConnectionState;
    qrCode?: string;
    logger: pino.Logger;
}

const clients = new Map<number, WhatsappClient>();
const mainLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function getAuthState(userId: number): Promise<{ state: any; saveCreds: () => Promise<void> }> {
    const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);
    await fs.ensureDir(sessionDir);
    return useMultiFileAuthState(sessionDir);
}

async function createWhatsappClient(userId: number): Promise<WhatsappClient> {
    const clientLogger = mainLogger.child({ module: 'baileys', userId });
    const { state, saveCreds } = await getAuthState(userId);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    clientLogger.info(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    const socket = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, clientLogger),
        },
        logger: clientLogger,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: true,
        msgRetryCounterMap: {},
        shouldIgnoreJid: () => false,
    });

    const client: WhatsappClient = {
        socket,
        eventEmitter: socket.ev,
        userId,
        status: 'close',
        logger: clientLogger,
    };
    clients.set(userId, client);

    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;
        client.status = connection || client.status;
        client.qrCode = qr; // Sempre atualiza o QR code no cliente em memória

        let connectionStatusForDb: WhatsappConnection['connectionStatus'] = 'disconnected';
        let lastErrorForDb: string | null = null;

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            connectionStatusForDb = 'disconnected';
            lastErrorForDb = lastDisconnect?.error?.message || `Desconectado. Código: ${statusCode}`;
            client.logger.warn(`Conexão fechada. Razão: ${DisconnectReason[statusCode as number] || 'Desconhecido'}. Reconectando: ${statusCode !== DisconnectReason.loggedOut}`);
            
            if (statusCode === DisconnectReason.loggedOut) {
                client.logger.info('Usuário deslogado, limpando sessão.');
                await clearSession(userId);
                clients.delete(userId);
                // No DB, já está como 'disconnected', mas podemos limpar o QR e telefone
                await storage.updateWhatsappConnection(userId, {
                    connectionStatus: 'disconnected',
                    qrCodeData: null,
                    connectedPhoneNumber: null,
                    lastError: 'Usuário deslogado do WhatsApp.',
                    sessionPath: null, // Limpa o caminho da sessão
                });
                return; // Interrompe aqui para logout
            }
            // Para outras razões de 'close', tentará reconectar ou já está no processo
        } else if (connection === 'open') {
            connectionStatusForDb = 'connected';
            client.logger.info('Conexão aberta com sucesso!');
        } else if (qr) {
            connectionStatusForDb = 'qr_code_needed';
            client.logger.info('QR Code recebido, aguardando scan.');
        } else if (connection === 'connecting') {
            connectionStatusForDb = 'connecting';
            client.logger.info('Conectando ao WhatsApp...');
        }
        
        // Atualiza o banco de dados
        await storage.updateWhatsappConnection(userId, {
            connectionStatus: connectionStatusForDb,
            qrCodeData: qr || null, // Salva novo QR ou limpa o antigo se conexão abrir/fechar
            connectedPhoneNumber: connection === 'open' ? socket.authState.creds.me?.id.split(':')[0] : null,
            lastConnectedAt: connection === 'open' ? new Date() : undefined, // undefined não atualiza
            lastError: lastErrorForDb,
            sessionPath: path.join(SESSIONS_DIR, `user_${userId}`), // Atualiza o caminho da sessão
        });
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async (m) => {
        client.logger.info({ msg: "Nova mensagem recebida", data: m }, `Mensagem recebida: ${m.messages[0]?.key?.remoteJid}`);
        // TODO: Implementar lógica de encaminhamento para WhatsappWebhookHandler -> WhatsappFlowEngine
    });

    return client;
}

async function clearSession(userId: number) {
    const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);
    try {
        await fs.remove(sessionDir);
        mainLogger.info(`Sessão para userId ${userId} limpa do sistema de arquivos.`);
    } catch (error) {
        mainLogger.error({ err: error }, `Erro ao limpar sessão para userId ${userId}.`);
    }
}

export const WhatsappConnectionService = {
    getClient: (userId: number): WhatsappClient | undefined => clients.get(userId),

    connect: async (userId: number): Promise<WhatsappClient> => {
        let client = clients.get(userId);
        if (client?.socket && (client.status === 'open' || client.status === 'connecting')) {
            client.logger.info('Cliente já existe e está conectado ou conectando.');
            return client;
        }
        client?.logger.info('Criando novo cliente WhatsApp ou reconectando...');
        
        let connRecord = await storage.getWhatsappConnection(userId);
        const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);

        if (!connRecord) {
            connRecord = await storage.createWhatsappConnection({ userId, connectionStatus: 'connecting', sessionPath: sessionDir });
        } else {
             await storage.updateWhatsappConnection(userId, { 
                connectionStatus: 'connecting', 
                qrCodeData: null, // Limpa QR antigo ao tentar nova conexão
                sessionPath: sessionDir 
            });
        }
        return createWhatsappClient(userId);
    },

    disconnect: async (userId: number): Promise<void> => {
        const client = clients.get(userId);
        mainLogger.info({ userId }, `Solicitação de desconexão para userId ${userId}`);
        if (client?.socket) {
            client.logger.info('Desconectando cliente WhatsApp...');
            await client.socket.logout(); // Isso deve disparar o 'connection.update' com 'close' e loggedOut
        }
        // A lógica em 'connection.update' com DisconnectReason.loggedOut já deve limpar a sessão e o DB.
        // Adicionamos uma limpeza extra aqui para garantir.
        await clearSession(userId);
        await storage.updateWhatsappConnection(userId, {
            connectionStatus: 'disconnected',
            qrCodeData: null,
            connectedPhoneNumber: null,
            sessionPath: null,
            lastError: 'Desconectado pelo usuário.',
        });
        clients.delete(userId);
        mainLogger.info(`Cliente para userId ${userId} finalizou desconexão e sessão limpa.`);
    },

    getConnectionStatus: async (userId: number): Promise<Partial<WhatsappConnection>> => {
        const client = clients.get(userId);
        const dbStatus = await storage.getWhatsappConnection(userId);

        if (client?.socket) { // Se existe uma instância Baileys ativa
            return {
                userId,
                connectionStatus: client.status, // Pega o status mais recente do socket
                qrCodeData: client.qrCode, // Pega o QR mais recente do socket
                connectedPhoneNumber: client.socket.authState.creds.me?.id.split(':')[0]?.split('@')[0] || dbStatus?.connectedPhoneNumber,
                sessionPath: dbStatus?.sessionPath, // O caminho é mais estático
            };
        }
        // Se não há cliente ativo, retorna o que está no banco
        return dbStatus || { userId, connectionStatus: 'disconnected' };
    },

    sendMessage: async (userId: number, jid: string, messageContent: any): Promise<any> => {
        const client = clients.get(userId);
        if (!client?.socket || client.status !== 'open') {
            client?.logger.error({ jid }, 'Tentativa de enviar mensagem sem conexão ativa.');
            throw new Error('WhatsApp não conectado.');
        }
        try {
            client.logger.info({ jid, msgContentKeys: Object.keys(messageContent) }, `Enviando mensagem para ${jid}`);
            const sentMsg = await client.socket.sendMessage(jid, messageContent);
            client.logger.info({ msgId: sentMsg?.key?.id, jid }, `Mensagem enviada com ID: ${sentMsg?.key?.id}`);
            return sentMsg;
        } catch (error) {
            client.logger.error({ err: error, jid }, `Erro ao enviar mensagem para ${jid}.`);
            throw error;
        }
    },
    
    initializeExistingConnections: async () => {
        mainLogger.info('Inicializando conexões WhatsApp existentes que estavam conectadas...');
        const connectionsToRestore = await drizzleDB.select()
            .from(whatsappConnectionsTable)
            .where(eq(whatsappConnectionsTable.connectionStatus, 'connected')); // Ou outros status que indicam sessão válida

        for (const conn of connectionsToRestore) {
            mainLogger.info({ userId: conn.userId }, `Tentando restaurar conexão para usuário ${conn.userId}`);
            try {
                // Verifica se já existe uma sessão de arquivos válida antes de tentar conectar
                const sessionDir = path.join(SESSIONS_DIR, `user_${conn.userId}`);
                if (await fs.pathExists(path.join(sessionDir, 'creds.json'))) {
                    await WhatsappConnectionService.connect(conn.userId);
                } else {
                    mainLogger.warn({ userId: conn.userId }, `Arquivos de sessão não encontrados em ${sessionDir}. Conexão não será restaurada automaticamente.`);
                    await storage.updateWhatsappConnection(conn.userId, { connectionStatus: 'disconnected', qrCodeData: null, lastError: 'Sessão anterior inválida ou não encontrada.' });
                }
            } catch (error) {
                mainLogger.error({ err: error, userId: conn.userId }, `Falha ao restaurar conexão para usuário ${conn.userId}.`);
                await storage.updateWhatsappConnection(conn.userId, { connectionStatus: 'error', lastError: (error as Error).message });
            }
        }
    }
};

// Inicializar conexões existentes ao iniciar o servidor (opcional, mas bom para persistência)
// Adie a chamada para após a exportação completa do objeto.
// setTimeout(() => WhatsappConnectionService.initializeExistingConnections(), 5000); // Pequeno delay para garantir que tudo esteja pronto
