// server/services/whatsapp-connection.service.ts
import मेकน้อยSockets, {
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
import {ථ้ารDB, users, whatsappConnections as whatsappConnectionsTable, NewWhatsappConnection, WhatsappConnection } from '../../shared/schema'; // Ajuste o caminho se precisar
import { storage } from './storage'; // Seu storage existente
import { db as drizzleDB } from './db'; // Instância do Drizzle
import { eq } from 'drizzle-orm';

// Define o diretório de sessões
const SESSIONS_DIR = path.resolve(process.cwd(), 'whatsapp_sessions');
fs.ensureDirSync(SESSIONS_DIR); // Garante que o diretório exista

interface WhatsappClient {
    socket: ReturnType<typeof मेकน้อยSockets> | null;
    eventEmitter: BaileysEventEmitter | null;
    userId: number;
    status: WAConnectionState;
    qrCode?: string;
    logger: pino.Logger;
}

// Um mapa para gerenciar múltiplas instâncias de clientes, uma por userId
const clients = new Map<number, WhatsappClient>();

// Logger principal (pode ser configurado para diferentes níveis)
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

    const socket = मेकน้อยSockets({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, clientLogger),
        },
        logger: clientLogger,
        printQRInTerminal: false, // Gerenciaremos o QR code para a API
        browser: Browsers.macOS('Desktop'), // Simula um navegador
        syncFullHistory: true, // Sincronizar histórico completo pode ser pesado
        msgRetryCounterMap: {},
        shouldIgnoreJid: (jid) => false, // Pode ser usado para ignorar certos JIDs
        // getMessage: async (key: WAMessageKey) => undefined, // Implementar se precisar de store de mensagens
    });

    const client: WhatsappClient = {
        socket,
        eventEmitter: socket.ev,
        userId,
        status: 'close', // Estado inicial
        logger: clientLogger,
    };
    clients.set(userId, client);

    // Lidar com atualizações de conexão
    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;
        client.status = connection || client.status;
        client.qrCode = qr;

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            client.logger.warn(`Conexão fechada. Razão: ${DisconnectReason[statusCode as number] || 'Desconhecido'}. Reconectando: ${statusCode !== DisconnectReason.loggedOut}`);
            
            await storage.updateWhatsappConnection(userId, {
                connectionStatus: 'disconnected',
                qrCodeData: null,
                lastError: lastDisconnect?.error?.message || `Desconectado. Código: ${statusCode}`,
            });

            if (statusCode !== DisconnectReason.loggedOut) {
                // Tentar reconectar automaticamente, a menos que o usuário tenha feito logout
                // A própria Baileys pode tentar reconectar, mas podemos adicionar lógica aqui se necessário
            } else {
                client.logger.info('Usuário deslogado, limpando sessão.');
                await clearSession(userId); // Limpar arquivos de sessão
                clients.delete(userId);
            }
        } else if (connection === 'open') {
            client.logger.info('Conexão aberta com sucesso!');
            await storage.updateWhatsappConnection(userId, {
                connectionStatus: 'connected',
                qrCodeData: null,
                connectedPhoneNumber: socket.authState.creds.me?.id.split(':')[0], // Pega o número do JID
                lastConnectedAt: new Date(),
                lastError: null,
            });
        }

        if (qr) {
            client.logger.info('QR Code recebido, aguardando scan.');
            await storage.updateWhatsappConnection(userId, {
                connectionStatus: 'qr_code_needed',
                qrCodeData: qr,
            });
        }
    });

    // Salvar credenciais
    socket.ev.on('creds.update', saveCreds);

    // Lidar com mensagens recebidas
    socket.ev.on('messages.upsert', async (m) => {
        // TODO: Encaminhar para WhatsappWebhookHandler -> WhatsappFlowEngine
        client.logger.info(`Mensagem recebida: ${JSON.stringify(m)}`);
        // Aqui você chamaria seu webhook interno ou emitiria um evento
    });

    return client;
}

async function clearSession(userId: number) {
    const sessionDir = path.join(SESSIONS_DIR, `user_${userId}`);
    try {
        await fs.remove(sessionDir); // Deleta a pasta da sessão
        mainLogger.info(`Sessão para userId ${userId} limpa do sistema de arquivos.`);
    } catch (error) {
        mainLogger.error(`Erro ao limpar sessão para userId ${userId}:`, error);
    }
}

export const WhatsappConnectionService = {
    getClient: (userId: number): WhatsappClient | undefined => {
        return clients.get(userId);
    },

    connect: async (userId: number): Promise<WhatsappClient> => {
        let client = clients.get(userId);
        if (client?.socket && (client.status === 'open' || client.status === 'connecting')) {
            client.logger.info('Cliente já existe e está conectado ou conectando.');
            return client;
        }

        client?.logger.info('Criando novo cliente WhatsApp ou reconectando...');
        // Garante que exista um registro no banco para este usuário
        let connRecord = await storage.getWhatsappConnection(userId);
        if (!connRecord) {
            connRecord = await storage.createWhatsappConnection({ userId, connectionStatus: 'disconnected' });
        } else if (connRecord.connectionStatus !== 'disconnected' && connRecord.connectionStatus !== 'qr_code_needed') {
            await storage.updateWhatsappConnection(userId, { connectionStatus: 'connecting' });
        }
        
        return createWhatsappClient(userId);
    },

    disconnect: async (userId: number): Promise<void> => {
        const client = clients.get(userId);
        if (client?.socket) {
            client.logger.info('Desconectando cliente WhatsApp...');
            await client.socket.logout(); // Faz logout e deve disparar o 'close' com DisconnectReason.loggedOut
            // O evento 'connection.update' com loggedOut deve limpar a sessão.
            // Se precisar de limpeza forçada adicional, pode ser feita aqui.
        }
        await storage.updateWhatsappConnection(userId, {
            connectionStatus: 'disconnected',
            qrCodeData: null,
            connectedPhoneNumber: null,
        });
        clients.delete(userId);
        await clearSession(userId); // Garante que os arquivos de sessão sejam removidos
        mainLogger.info(`Cliente para userId ${userId} desconectado e sessão limpa.`);
    },

    getConnectionStatus: async (userId: number): Promise<Partial<WhatsappConnection>> => {
        const client = clients.get(userId);
        const dbStatus = await storage.getWhatsappConnection(userId);

        if (client?.socket) {
            return {
                connectionStatus: client.status,
                qrCodeData: client.qrCode,
                connectedPhoneNumber: client.socket.authState.creds.me?.id.split(':')[0] || dbStatus?.connectedPhoneNumber,
            };
        }
        // Se não houver cliente ativo, retorna o status do banco
        return dbStatus || { userId, connectionStatus: 'disconnected' };
    },

    sendMessage: async (userId: number, jid: string, messageContent: any): Promise<any> => {
        const client = clients.get(userId);
        if (!client?.socket || client.status !== 'open') {
            client?.logger.error('Tentativa de enviar mensagem sem conexão ativa.');
            throw new Error('WhatsApp não conectado.');
        }
        try {
            client.logger.info(`Enviando mensagem para ${jid}`);
            const sentMsg = await client.socket.sendMessage(jid, messageContent);
            client.logger.info(`Mensagem enviada com ID: ${sentMsg?.key?.id}`);
            return sentMsg;
        } catch (error) {
            client.logger.error(`Erro ao enviar mensagem para ${jid}:`, error);
            throw error;
        }
    },

    // Inicializar conexões existentes ao iniciar o servidor (opcional)
    initializeExistingConnections: async () => {
        mainLogger.info('Inicializando conexões WhatsApp existentes...');
        // TODO: Buscar no banco conexões que deveriam estar ativas e tentar reconectar.
        // Por simplicidade, vamos deixar que o usuário inicie a conexão via API por enquanto.
    }
};

// (Opcional) Inicializar conexões ao iniciar o servidor
// WhatsappConnectionService.initializeExistingConnections();
