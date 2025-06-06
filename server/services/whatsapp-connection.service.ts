// server/services/whatsapp-connection.service.ts
import baileys, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  Browsers,
  WAMessage,
  WASocket,
} from '@whiskeysockets/baileys';
const makeWASocket = baileys.default; // ✅ CORREÇÃO CRÍTICA APLICADA AQUI

import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';

const SESSIONS_DIR = path.join(process.cwd(), 'server', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ✅ CORREÇÃO: Aumentando o log para depuração
const PINO_LOGGER_LEVEL = process.env.WHATSAPP_LOG_LEVEL || 'info'; 
const logger = pino({ level: PINO_LOGGER_LEVEL }).child({ class: 'WhatsappConnectionService' });

export interface WhatsappConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'disconnected_logged_out';
  qrCode: string | null;
  connectedPhoneNumber?: string;
  lastError?: string;
  userId: number;
}

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
    this.currentStatusDetails = { userId: this.userId, status: 'disconnected', qrCode: null };
    activeConnections.set(this.userId, { sock: null, statusDetails: this.currentStatusDetails });
  }

  private updateGlobalStatus(partialUpdate: Partial<WhatsappConnectionStatus>) {
    const existingEntry = activeConnections.get(this.userId) || { sock: this.sock, statusDetails: {} as WhatsappConnectionStatus };
    this.currentStatusDetails = { ...existingEntry.statusDetails, ...partialUpdate, userId: this.userId };
    activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });
    logger.info({ userId: this.userId, newStatus: this.currentStatusDetails.status }, 'Global connection status updated');
  }

  public async connectToWhatsApp(): Promise<WhatsappConnectionStatus> {
    logger.info({ userId: this.userId }, 'Tentando conectar ao WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null });

    const { state, saveCreds } = await useMultiFileAuthState(path.join(this.userSessionDir, 'auth_info_baileys'));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ userId: this.userId, version: version.join('.'), isLatest }, `Usando WA v${version.join('.')}, é a mais recente: ${isLatest}`);

    this.sock = makeWASocket({
      version,
      logger: logger.child({ subtype: 'baileys', userId: this.userId }),
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger.child({ subtype: 'baileys-keys', userId: this.userId })) },
      generateHighQualityLinkPreview: true,
      browser: Browsers.ubuntu('Desktop'),
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@newsletter'),
    });
    
    const currentEntry = activeConnections.get(this.userId);
    activeConnections.set(this.userId, { ...(currentEntry || {}), sock: this.sock, statusDetails: this.currentStatusDetails });

    this.sock.ev.process(async (events) => {
      if (events['connection.update']) {
        const { connection, lastDisconnect, qr } = events['connection.update'];
        logger.info({ userId: this.userId, connection, qr: !!qr, lastDisconnectError: lastDisconnect?.error }, 'Evento connection.update');

        if (qr) {
          logger.info('[CONN] QR code recebido e sendo processado.');
          this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qr });
        }

        if (connection === 'close') {
          const boomError = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomError?.output?.statusCode;
          logger.warn({ userId: this.userId, statusCode, error: boomError?.message }, 'Conexão fechada.');
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) {
              this.updateGlobalStatus({ status: 'connecting', lastError: boomError?.message, qrCode: null });
              // A própria biblioteca tentará reconectar. Se falhar, o status de erro persistirá.
          } else {
              this.cleanSessionFiles();
              this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null, connectedPhoneNumber: undefined });
          }
        } else if (connection === 'open') {
          const connectedPhoneNumber = this.sock?.user?.id?.split(':')[0];
          this.updateGlobalStatus({ status: 'connected', qrCode: null, connectedPhoneNumber });
          logger.info({ userId: this.userId, jid: this.sock?.user?.id }, 'Conexão aberta com sucesso.');
        }
      }
      if (events['creds.update']) { await saveCreds(); }
      if (events['messages.upsert']) { /* Lógica de recebimento de mensagens */ }
    });
    
    return this.currentStatusDetails;
  }

  public static getStatus(userId: number): WhatsappConnectionStatus | undefined {
    return activeConnections.get(userId)?.statusDetails;
  }
  
  public static getSocket(userId: number): WASocket | null | undefined {
    return activeConnections.get(userId)?.sock;
  }

  private cleanSessionFiles() {
    logger.warn({ userId: this.userId, sessionDir: this.userSessionDir }, 'Limpando arquivos de sessão.');
    if (fs.existsSync(this.userSessionDir)) {
      try {
        fs.rmSync(this.userSessionDir, { recursive: true, force: true });
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
      try { await connection.sock.logout(); } catch (error) { logger.error({ userId: this.userId, error }, 'Erro ao tentar deslogar.'); }
    } else {
      this.cleanSessionFiles();
      this.updateGlobalStatus({ status: 'disconnected', qrCode: null, connectedPhoneNumber: undefined });
    }
  }

  public async sendMessage(jid: string, messagePayload: any): Promise<WAMessage | undefined> {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock && connection.statusDetails.status === 'connected') {
      try {
        const sentMsg = await connection.sock.sendMessage(jid, messagePayload);
        return sentMsg;
      } catch (error) {
        logger.error({ userId: this.userId, error }, 'Falha ao enviar mensagem.');
        throw error;
      }
    } else {
      const errorMsg = 'WhatsApp não conectado.';
      logger.warn({ userId: this.userId, status: connection?.statusDetails.status }, errorMsg);
      throw new Error(errorMsg);
    }
  }
}
