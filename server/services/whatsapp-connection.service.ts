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
  private sock: WASocket | null = null;

  constructor(userId: number) {
    this.userId = userId;
    this.userSessionDir = path.join(SESSIONS_DIR, `user_${this.userId}`);
    if (!activeConnections.has(userId)) {
        activeConnections.set(userId, { sock: null, statusDetails: { userId: this.userId, status: 'disconnected', qrCode: null } });
    }
  }

  private updateGlobalStatus(partialUpdate: Partial<WhatsappConnectionStatus>) {
    const existingEntry = activeConnections.get(this.userId) || { sock: this.sock, statusDetails: {} as any };
    const newStatus = { ...existingEntry.statusDetails, ...partialUpdate, userId: this.userId };
    activeConnections.set(this.userId, { sock: this.sock, statusDetails: newStatus });
    logger.info({ userId: this.userId, newStatus: newStatus.status }, 'Global connection status updated');
  }

  public async connectToWhatsApp(): Promise<void> {
    if (activeConnections.get(this.userId)?.sock) {
        logger.warn({ userId: this.userId }, 'Tentativa de conectar com socket já existente.');
        return;
    }
    
    logger.info({ userId: this.userId }, 'Iniciando conexão com o WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null, lastError: undefined });

    // =================================================================
    // CORREÇÃO CRÍTICA: Adicionado bloco try...catch para evitar crash do servidor.
    // Qualquer erro na inicialização do Baileys será capturado aqui.
    // =================================================================
    try {
        if (!fs.existsSync(this.userSessionDir)) fs.mkdirSync(this.userSessionDir, { recursive: true });
        
        const { state, saveCreds } = await useMultiFileAuthState(path.join(this.userSessionDir, 'auth_info_baileys'));
        const { version } = await fetchLatestBaileysVersion();
        
        this.sock = makeWASocket({
          version,
          logger: logger.child({ subtype: 'baileys' }),
          printQRInTerminal: false,
          auth: state,
          browser: Browsers.ubuntu('Chrome'),
          generateHighQualityLinkPreview: true,
          qrTimeout: 90000,
        });
        
        activeConnections.set(this.userId, { sock: this.sock, statusDetails: activeConnections.get(this.userId)!.statusDetails });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr) {
            logger.info(`[User ${this.userId}] QR Code recebido.`);
            // A imagem do QR code é um data URI (base64), então está correto
            this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qr });
          }
          if (connection === 'close') {
            const boomError = lastDisconnect?.error as Boom | undefined;
            const statusCode = boomError?.output?.statusCode;
            logger.warn({ userId: this.userId, statusCode, error: boomError?.message }, `Conexão fechada.`);
            
            if (statusCode === DisconnectReason.loggedOut) {
              logger.info(`[User ${this.userId}] Usuário deslogado. Limpando sessão.`);
              this.cleanSessionFiles();
              this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null });
            } else if (statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.multideviceMismatch) {
                logger.info(`[User ${this.userId}] Conexão substituída ou incompatível. Deslogando para forçar nova leitura.`);
                this.disconnectWhatsApp(); // Força o logout e limpeza
            } else {
              // Para outros erros, apenas atualiza o status sem limpar a sessão, permitindo nova tentativa.
              this.updateGlobalStatus({ status: 'error', lastError: boomError?.message || 'Conexão perdida' });
            }
            this.sock = null;
            activeConnections.set(this.userId, { sock: null, statusDetails: activeConnections.get(this.userId)!.statusDetails });

          } else if (connection === 'open') {
            const phone = this.sock?.user?.id?.split(':')[0];
            logger.info(`[User ${this.userId}] Conexão aberta com sucesso para: ${phone}`);
            this.updateGlobalStatus({ status: 'connected', qrCode: null, connectedPhoneNumber: phone });
          }
        });
    } catch (error: any) {
        logger.error({ userId: this.userId, error: error.message, stack: error.stack }, "Falha crítica ao inicializar o WhatsApp.");
        this.updateGlobalStatus({ status: 'error', lastError: `Falha na inicialização: ${error.message}` });
        this.sock = null;
        activeConnections.set(this.userId, { sock: null, statusDetails: activeConnections.get(this.userId)!.statusDetails });
    }
  }

  private cleanSessionFiles() {
    try {
        if (fs.existsSync(this.userSessionDir)) {
          fs.rmSync(this.userSessionDir, { recursive: true, force: true });
          logger.info(`[User ${this.userId}] Arquivos de sessão limpos com sucesso.`);
        }
    } catch (error: any) {
        logger.error({ userId: this.userId, error: error.message }, "Erro ao limpar arquivos de sessão.");
    }
  }

  public async disconnectWhatsApp(): Promise<void> {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock) {
      logger.info(`[User ${this.userId}] Solicitando logout do socket.`);
      await connection.sock.logout();
      // A limpeza e atualização de status será tratada pelo evento 'connection.close' com DisconnectReason.loggedOut
    } else {
      logger.info(`[User ${this.userId}] Desconectando sem socket ativo, apenas limpando arquivos.`);
      this.cleanSessionFiles();
      this.updateGlobalStatus({ status: 'disconnected', qrCode: null });
    }
  }

  public static getStatus(userId: number) {
    // Retorna um status padrão se não houver nenhuma entrada para o usuário
    return activeConnections.get(userId)?.statusDetails || { userId, status: 'disconnected', qrCode: null };
  }
  
  public async sendMessage(jid: string, messagePayload: any) {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock && connection.statusDetails.status === 'connected') {
        return await connection.sock.sendMessage(jid, messagePayload);
    }
    throw new Error('WhatsApp não conectado.');
  }
}
