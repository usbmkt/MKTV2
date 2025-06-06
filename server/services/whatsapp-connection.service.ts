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
import QRCode from 'qrcode'; // Para converter QR em base64

const SESSIONS_DIR = path.join(process.cwd(), 'server', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const logger = pino({ level: 'debug' }).child({ class: 'WhatsappConnectionService' });

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
    logger.info({ userId: this.userId, newStatus: newStatus.status, hasQR: !!newStatus.qrCode }, 'Global connection status updated');
  }

  public async connectToWhatsApp(): Promise<void> {
    // Verifica se já existe uma conexão ativa
    const existingConnection = activeConnections.get(this.userId);
    if (existingConnection?.sock) {
        logger.warn({ userId: this.userId }, 'Tentativa de conectar com socket já existente.');
        return;
    }
    
    logger.info({ userId: this.userId }, 'Iniciando conexão com o WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null, lastError: undefined });

    try {
        // Garante que o diretório de sessão existe
        if (!fs.existsSync(this.userSessionDir)) {
            fs.mkdirSync(this.userSessionDir, { recursive: true });
            logger.debug({ userId: this.userId }, 'Diretório de sessão criado');
        }
        
        // Verifica se já existe sessão salva
        const authInfoPath = path.join(this.userSessionDir, 'auth_info_baileys');
        const hasExistingSession = fs.existsSync(authInfoPath);
        logger.debug({ userId: this.userId, hasExistingSession }, 'Verificando sessão existente');
        
        // Configura autenticação multi-device
        const { state, saveCreds } = await useMultiFileAuthState(authInfoPath);
        const { version } = await fetchLatestBaileysVersion();
        
        logger.debug({ userId: this.userId, version }, 'Versão do Baileys obtida');
        
        // Cria o socket do WhatsApp
        this.sock = makeWASocket({
          version,
          logger: pino({ level: 'warn' }), // Reduz logs do Baileys
          printQRInTerminal: true, // IMPORTANTE: habilita QR no terminal para debug
          auth: state,
          browser: Browsers.ubuntu('Chrome'),
          generateHighQualityLinkPreview: true,
          qrTimeout: 60000, // Reduz timeout para 60s
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 10000,
          retryRequestDelayMs: 250,
        });
        
        logger.debug({ userId: this.userId }, 'Socket criado com sucesso');
        
        // Atualiza a referência global
        activeConnections.set(this.userId, { 
            sock: this.sock, 
            statusDetails: activeConnections.get(this.userId)!.statusDetails 
        });

        // Event listeners
        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;
          
          logger.debug({ 
            userId: this.userId, 
            connection, 
            hasQr: !!qr, 
            qrLength: qr?.length 
          }, 'Connection update recebido');
          
          if (qr) {
            try {
              logger.info(`[User ${this.userId}] QR Code recebido. Tamanho: ${qr.length}`);
              
              // Converte QR para base64 data URL
              const qrDataURL = await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              
              logger.debug({ 
                userId: this.userId, 
                qrDataURLLength: qrDataURL.length 
              }, 'QR Code convertido para Data URL');
              
              this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qrDataURL });
              
            } catch (qrError: any) {
              logger.error({ 
                userId: this.userId, 
                error: qrError.message 
              }, 'Erro ao converter QR Code');
              
              // Fallback: usa o QR string diretamente
              this.updateGlobalStatus({ status: 'qr_code_needed', qrCode: qr });
            }
          }
          
          if (connection === 'close') {
            this.handleConnectionClose(lastDisconnect);
          } else if (connection === 'open') {
            this.handleConnectionOpen();
          } else if (connection === 'connecting') {
            logger.debug({ userId: this.userId }, 'Estado: connecting');
            this.updateGlobalStatus({ status: 'connecting' });
          }
        });

        // Listener para debugging
        this.sock.ev.on('messages.upsert', (m) => {
          logger.debug({ userId: this.userId, messageCount: m.messages.length }, 'Mensagens recebidas');
        });

    } catch (error: any) {
        logger.error({ 
            userId: this.userId, 
            error: error.message, 
            stack: error.stack 
        }, "Falha crítica ao inicializar o WhatsApp.");
        
        this.updateGlobalStatus({ 
            status: 'error', 
            lastError: `Falha na inicialização: ${error.message}` 
        });
        
        this.cleanup();
    }
  }

  private handleConnectionClose(lastDisconnect: any) {
    const boomError = lastDisconnect?.error as Boom | undefined;
    const statusCode = boomError?.output?.statusCode;
    
    logger.warn({ 
        userId: this.userId, 
        statusCode, 
        error: boomError?.message,
        disconnectReason: this.getDisconnectReasonName(statusCode)
    }, `Conexão fechada.`);
    
    if (statusCode === DisconnectReason.loggedOut) {
        logger.info(`[User ${this.userId}] Usuário deslogado. Limpando sessão.`);
        this.cleanSessionFiles();
        this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null });
        
    } else if (statusCode === DisconnectReason.connectionReplaced || 
               statusCode === DisconnectReason.multideviceMismatch) {
        logger.info(`[User ${this.userId}] Conexão substituída ou incompatível. Deslogando para forçar nova leitura.`);
        this.disconnectWhatsApp();
        
    } else if (statusCode === DisconnectReason.restartRequired) {
        logger.info(`[User ${this.userId}] Reinicialização necessária. Tentando reconectar...`);
        this.updateGlobalStatus({ status: 'connecting', qrCode: null });
        setTimeout(() => {
            this.connectToWhatsApp();
        }, 5000);
        return;
        
    } else if (statusCode === DisconnectReason.timedOut) {
        logger.info(`[User ${this.userId}] Timeout na conexão. Limpando sessão para nova tentativa.`);
        this.cleanSessionFiles();
        this.updateGlobalStatus({ status: 'disconnected', qrCode: null });
        
    } else {
        const errorMessage = boomError?.message || 'Conexão perdida';
        this.updateGlobalStatus({ status: 'error', lastError: errorMessage });
    }
    
    this.cleanup();
  }

  private getDisconnectReasonName(code: number | undefined): string {
    const reasons: Record<number, string> = {
      [DisconnectReason.badSession]: 'badSession',
      [DisconnectReason.connectionClosed]: 'connectionClosed',
      [DisconnectReason.connectionLost]: 'connectionLost',
      [DisconnectReason.connectionReplaced]: 'connectionReplaced',
      [DisconnectReason.loggedOut]: 'loggedOut',
      [DisconnectReason.multideviceMismatch]: 'multideviceMismatch',
      [DisconnectReason.restartRequired]: 'restartRequired',
      [DisconnectReason.timedOut]: 'timedOut',
    };
    return code ? (reasons[code] || `unknown(${code})`) : 'undefined';
  }

  private handleConnectionOpen() {
    const phone = this.sock?.user?.id?.split(':')[0];
    logger.info(`[User ${this.userId}] Conexão aberta com sucesso para: ${phone}`);
    this.updateGlobalStatus({ 
        status: 'connected', 
        qrCode: null, 
        connectedPhoneNumber: phone,
        lastError: undefined
    });
  }

  private cleanup() {
    this.sock = null;
    const currentStatus = activeConnections.get(this.userId)?.statusDetails;
    if (currentStatus) {
        activeConnections.set(this.userId, { sock: null, statusDetails: currentStatus });
    }
  }

  private cleanSessionFiles() {
    try {
        if (fs.existsSync(this.userSessionDir)) {
          fs.rmSync(this.userSessionDir, { recursive: true, force: true });
          logger.info(`[User ${this.userId}] Arquivos de sessão limpos com sucesso.`);
        }
    } catch (error: any) {
        logger.error({ 
            userId: this.userId, 
            error: error.message 
        }, "Erro ao limpar arquivos de sessão.");
    }
  }

  public async disconnectWhatsApp(): Promise<void> {
    const connection = activeConnections.get(this.userId);
    
    if (connection?.sock) {
      logger.info(`[User ${this.userId}] Solicitando logout do socket.`);
      try {
          await connection.sock.logout();
      } catch (error: any) {
          logger.error({ 
              userId: this.userId, 
              error: error.message 
          }, "Erro ao fazer logout do socket.");
          this.cleanSessionFiles();
          this.updateGlobalStatus({ status: 'disconnected', qrCode: null });
          this.cleanup();
      }
    } else {
      logger.info(`[User ${this.userId}] Desconectando sem socket ativo, apenas limpando arquivos.`);
      this.cleanSessionFiles();
      this.updateGlobalStatus({ status: 'disconnected', qrCode: null });
    }
  }

  public static getStatus(userId: number): WhatsappConnectionStatus {
    const status = activeConnections.get(userId)?.statusDetails || { 
        userId, 
        status: 'disconnected', 
        qrCode: null 
    };
    
    logger.debug({ 
      userId, 
      status: status.status, 
      hasQR: !!status.qrCode,
      qrLength: status.qrCode?.length 
    }, 'Status solicitado');
    
    return status;
  }
  
  public async sendMessage(jid: string, messagePayload: any) {
    const connection = activeConnections.get(this.userId);
    
    if (!connection?.sock || connection.statusDetails.status !== 'connected') {
        throw new Error('WhatsApp não conectado.');
    }
    
    try {
        return await connection.sock.sendMessage(jid, messagePayload);
    } catch (error: any) {
        logger.error({ 
            userId: this.userId, 
            jid, 
            error: error.message 
        }, "Erro ao enviar mensagem.");
        throw new Error(`Falha ao enviar mensagem: ${error.message}`);
    }
  }

  public isConnected(): boolean {
    const connection = activeConnections.get(this.userId);
    return connection?.statusDetails.status === 'connected' && connection.sock !== null;
  }

  public getAccountInfo() {
    const connection = activeConnections.get(this.userId);
    if (connection?.sock && this.isConnected()) {
        return {
            user: connection.sock.user,
            phoneNumber: connection.statusDetails.connectedPhoneNumber
        };
    }
    return null;
  }
}
