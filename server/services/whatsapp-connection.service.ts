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
const makeWASocket = baileys.default;

import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';

const SESSIONS_DIR = path.join(process.cwd(), 'server', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'info' }).child({ class: 'WhatsappConnectionService' });

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
    this.currentStatusDetails = { userId: this.userId, status: 'disconnected', qrCode: null };
    activeConnections.set(this.userId, { sock: null, statusDetails: this.currentStatusDetails });
  }

  private updateGlobalStatus(partialUpdate: Partial<WhatsappConnectionStatus>) {
    const existingEntry = activeConnections.get(this.userId) || { sock: this.sock, statusDetails: {} as any };
    this.currentStatusDetails = { ...existingEntry.statusDetails, ...partialUpdate, userId: this.userId };
    activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });
    logger.info({ userId: this.userId, newStatus: this.currentStatusDetails.status }, 'Global connection status updated');
  }

  public async connectToWhatsApp(): Promise<void> {
    if (this.sock) {
        logger.warn({ userId: this.userId }, 'Tentativa de conectar com socket já existente. Desconectando primeiro.');
        await this.disconnectWhatsApp(false);
    }
    
    logger.info({ userId: this.userId }, 'Iniciando conexão com o WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null, lastError: undefined });

    if (!fs.existsSync(this.userSessionDir)) {
      fs.mkdirSync(this.userSessionDir, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(path.join(this.userSessionDir, 'auth_info_baileys'));
    const { version } = await fetchLatestBaileysVersion();
    
    this.sock = makeWASocket({
      version,
      logger: logger.child({ subtype: 'baileys' }),
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      generateHighQualityLinkPreview: true,
      qrTimeout: 60000, // ✅ AUMENTADO TIMEOUT DO QR CODE
    });

    activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        logger.info(`[User ${this.userId}] QR Code recebido. Atualizando status.`);
        this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qr });
      }
      if (connection === 'close') {
        const boomError = lastDisconnect?.error as Boom | undefined;
        const statusCode = boomError?.output?.statusCode;
        logger.warn({ userId: this.userId, statusCode, error: boomError?.message }, `Conexão fechada.`);
        
        if (statusCode === DisconnectReason.loggedOut) {
          logger.warn(`[User ${this.userId}] Deslogado. Limpando sessão.`);
          this.cleanSessionFiles();
          this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null });
        } else {
          this.updateGlobalStatus({ status: 'error', lastError: boomError?.message || 'Conexão perdida' });
          // Não reconecta automaticamente aqui para evitar loops
        }
      } else if (connection === 'open') {
        const phone = this.sock?.user?.id?.split(':')[0];
        logger.info(`[User ${this.userId}] Conexão aberta com sucesso para o número: ${phone}`);
        this.updateGlobalStatus({ status: 'connected', qrCode: null, connectedPhoneNumber: phone });
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
    // Adicionar outros listeners como 'messages.upsert' aqui
  }

  private cleanSessionFiles() {
    if (fs.existsSync(this.userSessionDir)) {
      fs.rmSync(this.userSessionDir, { recursive: true, force: true });
    }
  }

  public async disconnectWhatsApp(manualLogout = true): Promise<void> {
    if (this.sock) {
        if(manualLogout) await this.sock.logout();
        else this.sock.end(undefined);
    }
    this.cleanSessionFiles();
    this.updateGlobalStatus({ status: 'disconnected', qrCode: null, lastError: undefined });
  }

  public static getStatus(userId: number) {
    return activeConnections.get(userId)?.statusDetails;
  }
  
  public async sendMessage(jid: string, messagePayload: any) {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock && connection.statusDetails.status === 'connected') {
        return await connection.sock.sendMessage(jid, messagePayload);
    }
    throw new Error('WhatsApp não conectado.');
  }
}
