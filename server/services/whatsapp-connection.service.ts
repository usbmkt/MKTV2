// server/services/whatsapp-connection.service.ts
// ✅ CORREÇÃO APLICADA AQUI
import baileys, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  Browsers,
  WAMessage,
  WASocket,
} from '@whiskeysockets/baileys';
const makeWASocket = baileys.default; // Extrai a função do objeto do módulo

import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';

// Define um diretório para armazenar arquivos de sessão, dentro de server/
const SESSIONS_DIR = path.join(process.cwd(), 'server', 'sessions');

// Garante que o diretório base de sessões exista
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Configuração do Logger
const PINO_LOGGER_LEVEL = process.env.WHATSAPP_LOG_LEVEL || 'silent';
const logger = pino({ level: PINO_LOGGER_LEVEL }).child({ class: 'WhatsappConnectionService' });

export interface WhatsappConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'disconnected_logged_out';
  qrCode: string | null;
  connectedPhoneNumber?: string;
  lastError?: string;
  userId: number;
}

// Armazenamento em memória para conexões ativas e seus status
const activeConnections = new Map<number, { sock: WASocket | null; statusDetails: WhatsappConnectionStatus }>();

export class WhatsappConnectionService {
  private userId: number;
  private userSessionDir: string;
  private currentStatusDetails: WhatsappConnectionStatus;
  private sock: WASocket | null = null;

  constructor(userId: number) {
    this.userId = userId;
    this.userSessionDir = path.join(SESSIONS_DIR, `user_${this.userId}`);
    if (!fs.existsSync(this.userSessionDir)) {
      fs.mkdirSync(this.userSessionDir, { recursive: true });
    }

    this.currentStatusDetails = {
      userId: this.userId,
      status: 'disconnected',
      qrCode: null,
    };
    activeConnections.set(this.userId, { sock: null, statusDetails: this.currentStatusDetails });
  }

  private updateGlobalStatus(partialUpdate: Partial<WhatsappConnectionStatus>) {
    const existingEntry = activeConnections.get(this.userId) || { sock: this.sock, statusDetails: {} as WhatsappConnectionStatus };
    this.currentStatusDetails = {
        ...existingEntry.statusDetails,
        ...partialUpdate,
        userId: this.userId
    };
    activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });
    logger.info({ userId: this.userId, newStatus: this.currentStatusDetails.status }, 'Global connection status updated');
  }


  public async connectToWhatsApp(): Promise<WhatsappConnectionStatus> {
    logger.info({ userId: this.userId }, 'Tentando conectar ao WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null });

    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(this.userSessionDir, 'auth_info_baileys')
    );
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info( { userId: this.userId, version: version.join('.'), isLatest }, `Usando WA v${version.join('.')}, é a mais recente: ${isLatest}`);

    this.sock = makeWASocket({ // Esta chamada agora funcionará
      version,
      logger: logger.child({ subtype: 'baileys', userId: this.userId }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger.child({ subtype: 'baileys-keys', userId: this.userId })),
      },
      generateHighQualityLinkPreview: true,
      browser: Browsers.ubuntu('Desktop'),
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@newsletter'),
    });
    
    const currentEntry = activeConnections.get(this.userId);
    if (currentEntry) {
        activeConnections.set(this.userId, { ...currentEntry, sock: this.sock });
    } else {
        activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });
    }

    this.sock.ev.process(async (events) => {
      if (events['connection.update']) {
        const update = events['connection.update'];
        const { connection, lastDisconnect, qr } = update;
        logger.info({ userId: this.userId, connection, qr: !!qr, lastDisconnectError: lastDisconnect?.error }, 'Evento connection.update');

        if (qr) {
          this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qr });
        }

        if (connection === 'close') {
          const boomError = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomError?.output?.statusCode;
          
          logger.warn({ userId: this.userId, statusCode, error: boomError?.message }, 'Conexão fechada.');

          if (statusCode === DisconnectReason.loggedOut) {
            logger.info({ userId: this.userId }, 'Deslogado pelo WhatsApp. Limpando arquivos de sessão.');
            this.cleanSessionFiles();
            this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null, connectedPhoneNumber: undefined });
          } else {
            logger.error({ userId: this.userId, error: lastDisconnect?.error }, 'Conexão fechada devido a um erro.');
            this.updateGlobalStatus({ status: 'error', lastError: boomError?.message || 'Erro desconhecido', qrCode: null });
          }
          this.sock = null;
          const entry = activeConnections.get(this.userId);
          if(entry) activeConnections.set(this.userId, {...entry, sock: null});
        } else if (connection === 'open') {
          const connectedPhoneNumber = this.sock?.user?.id?.split(':')[0];
          this.updateGlobalStatus({ status: 'connected', qrCode: null, connectedPhoneNumber });
          logger.info({ userId: this.userId, jid: this.sock?.user?.id, phone: connectedPhoneNumber }, 'Conexão aberta com sucesso.');
        }
      }

      if (events['creds.update']) {
        await saveCreds();
        logger.info({ userId: this.userId }, 'Credenciais atualizadas e salvas.');
      }
      
      if (events['messages.upsert']) {
        const { messages, type } = events['messages.upsert'];
        if (type === 'notify') {
          logger.info({ userId: this.userId, count: messages.length }, 'Novas mensagens recebidas.');
          messages.forEach(msg => {
             logger.debug({ userId: this.userId, msg }, 'Detalhes da mensagem recebida');
          });
        }
      }
    });
    
    return this.currentStatusDetails;
  }

  public static getStatus(userId: number): WhatsappConnectionStatus | undefined {
    const connection = activeConnections.get(userId);
    return connection?.statusDetails;
  }
  
  public static getSocket(userId: number): WASocket | null | undefined {
    return activeConnections.get(userId)?.sock;
  }

  private cleanSessionFiles() {
    logger.warn({ userId: this.userId, sessionDir: this.userSessionDir }, 'Limpando arquivos de sessão.');
    if (fs.existsSync(this.userSessionDir)) {
      try {
        fs.rmSync(this.userSessionDir, { recursive: true, force: true });
        logger.info({ userId: this.userId }, 'Arquivos de sessão removidos com sucesso.');
        fs.mkdirSync(this.userSessionDir, { recursive: true });
      } catch (error) {
        logger.error({ userId: this.userId, error }, 'Erro ao limpar arquivos de sessão.');
      }
    }
  }

  public async disconnectWhatsApp(): Promise<void> {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock) {
      logger.info({ userId: this.userId }, 'Desconectando a sessão WhatsApp...');
      try {
        await connection.sock.logout();
        logger.info({ userId: this.userId }, 'Comando de logout enviado.');
      } catch (error) {
        logger.error({ userId: this.userId, error }, 'Erro ao tentar deslogar.');
      }
    } else {
      logger.warn({ userId: this.userId }, 'Nenhuma conexão ativa para desconectar. Limpando arquivos de sessão por precaução.');
      this.cleanSessionFiles();
      this.updateGlobalStatus({ status: 'disconnected', qrCode: null, connectedPhoneNumber: undefined });
    }
  }

  public async sendMessage(jid: string, messagePayload: any): Promise<WAMessage | undefined> {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock && connection.statusDetails.status === 'connected') {
      logger.info({ userId: this.userId, jid, payloadKeys: Object.keys(messagePayload) }, 'Enviando mensagem...');
      try {
        const sentMsg = await connection.sock.sendMessage(jid, messagePayload);
        logger.info({ userId: this.userId, msgId: sentMsg?.key.id }, 'Mensagem enviada com sucesso.');
        return sentMsg;
      } catch (error) {
        logger.error({ userId: this.userId, error }, 'Falha ao enviar mensagem.');
        throw error;
      }
    } else {
      const errorMsg = 'Não é possível enviar mensagem, WhatsApp não conectado ou socket indisponível.';
      logger.warn({ userId: this.userId, status: connection?.statusDetails.status }, errorMsg);
      throw new Error(errorMsg);
    }
  }
}
