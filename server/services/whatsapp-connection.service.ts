import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  Browsers,
  WAMessage,
  WASocket,
} from '@whiskeysockets/baileys';
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
// Em produção, considere um nível mais alto como 'warn' ou 'error'
// Para Baileys, 'debug' é muito verboso mas útil para desenvolvimento.
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
// A chave é o userId
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
    // Atualiza o mapa global com a instância inicial ou recupera uma existente
    // (simplificado aqui, uma gestão mais robusta de instâncias pode ser necessária)
    activeConnections.set(this.userId, { sock: null, statusDetails: this.currentStatusDetails });
  }

  private updateGlobalStatus(partialUpdate: Partial<WhatsappConnectionStatus>) {
    const existingEntry = activeConnections.get(this.userId) || { sock: this.sock, statusDetails: {} as WhatsappConnectionStatus };
    this.currentStatusDetails = {
        ...existingEntry.statusDetails,
        ...partialUpdate,
        userId: this.userId // garantir que userId esteja sempre presente
    };
    activeConnections.set(this.userId, { sock: this.sock, statusDetails: this.currentStatusDetails });
    logger.info({ userId: this.userId, newStatus: this.currentStatusDetails.status }, 'Global connection status updated');
  }


  public async connectToWhatsApp(): Promise<WhatsappConnectionStatus> {
    logger.info({ userId: this.userId }, 'Tentando conectar ao WhatsApp...');
    this.updateGlobalStatus({ status: 'connecting', qrCode: null });

    // Limpa arquivos de sessão antigos se for reconectar forçadamente ou após falha de autenticação
    // this.cleanSessionFilesIfNeeded(); // Adicionar lógica se necessário

    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(this.userSessionDir, 'auth_info_baileys')
    );
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info( { userId: this.userId, version: version.join('.'), isLatest }, `Usando WA v${version.join('.')}, é a mais recente: ${isLatest}`);

    this.sock = makeWASocket({
      version,
      logger: logger.child({ subtype: 'baileys', userId: this.userId }), // Logger específico para a instância Baileys
      printQRInTerminal: false, // O QR será tratado manualmente para exposição via API
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger.child({ subtype: 'baileys-keys', userId: this.userId })),
      },
      generateHighQualityLinkPreview: true,
      browser: Browsers.ubuntu('Desktop'), // Simula um navegador para melhor compatibilidade
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@newsletter'),
      // Outras opções podem ser adicionadas conforme necessário
    });
    
    // Atualiza o socket no mapa global
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
          console.log(`[User ${this.userId}] QR Code disponível no terminal (primeiros 30 chars): ${qr.substring(0, 30)}...`);
          // Para fins de debug, o QR completo pode ser logado:
          // logger.debug({ userId: this.userId, qrCode: qr }, 'QR Code completo recebido.');
        }

        if (connection === 'close') {
          const boomError = lastDisconnect?.error as Boom | undefined;
          const statusCode = boomError?.output?.statusCode;
          
          logger.warn({ userId: this.userId, statusCode, error: boomError?.message }, 'Conexão fechada.');

          if (statusCode === DisconnectReason.loggedOut) {
            logger.info({ userId: this.userId }, 'Deslogado pelo WhatsApp. Limpando arquivos de sessão.');
            this.cleanSessionFiles();
            this.updateGlobalStatus({ status: 'disconnected_logged_out', qrCode: null, connectedPhoneNumber: undefined });
          } else if (statusCode === DisconnectReason.connectionLost) {
             logger.warn({ userId: this.userId }, 'Conexão perdida com o servidor. Tentando reconectar em breve...');
             this.updateGlobalStatus({ status: 'connecting', qrCode: null }); // Status para indicar tentativa de reconexão
             // O Baileys geralmente tenta reconectar automaticamente; podemos adicionar lógica extra se necessário
          } else if (statusCode === DisconnectReason.restartRequired) {
            logger.warn({ userId: this.userId }, 'Reinício necessário. Tentando reconectar...');
            this.updateGlobalStatus({ status: 'connecting', qrCode: null });
            // Não é necessário chamar connectToWhatsApp() explicitamente aqui, Baileys pode tentar.
            // Se persistir, uma intervenção manual/lógica mais robusta pode ser necessária.
          } else if (statusCode === DisconnectReason.timedOut) {
            logger.warn({ userId: this.userId }, 'Timeout na conexão. Verifique a rede.');
            this.updateGlobalStatus({ status: 'error', lastError: 'Timeout na conexão', qrCode: null });
          } else if (statusCode === DisconnectReason.multideviceMismatch) {
            logger.error({ userId: this.userId }, 'Mismatch de múltiplos dispositivos. Deslogue e tente novamente.');
            this.cleanSessionFiles();
            this.updateGlobalStatus({ status: 'auth_failure', lastError: 'Mismatch de múltiplos dispositivos', qrCode: null });
          }
          else {
            logger.error({ userId: this.userId, error: lastDisconnect?.error }, 'Conexão fechada devido a um erro desconhecido ou não tratado.');
            this.updateGlobalStatus({ status: 'error', lastError: boomError?.message || 'Erro desconhecido', qrCode: null });
          }
          this.sock = null; // Limpa o socket interno da instância
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

      // Placeholder para Task 3.1.6: Recebimento de Mensagens
      if (events['messages.upsert']) {
        const { messages, type } = events['messages.upsert'];
        if (type === 'notify') { // Process only new messages
          logger.info({ userId: this.userId, count: messages.length }, 'Novas mensagens recebidas.');
          messages.forEach(msg => {
            // Aqui as mensagens seriam encaminhadas para o WhatsappWebhookHandler/WhatsappFlowEngine
            // Ex: this.handleIncomingMessage(msg);
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
        // Recria o diretório para sessões futuras
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
        await connection.sock.logout(); // Deve acionar 'connection.close' com DisconnectReason.loggedOut
        logger.info({ userId: this.userId }, 'Comando de logout enviado.');
      } catch (error) {
        logger.error({ userId: this.userId, error }, 'Erro ao tentar deslogar.');
      }
      // A limpeza da sessão e atualização de status deve ser tratada pelo evento 'connection.update'
    } else {
      logger.warn({ userId: this.userId }, 'Nenhuma conexão ativa para desconectar. Limpando arquivos de sessão por precaução.');
      this.cleanSessionFiles(); // Garante a limpeza se o socket já estiver nulo
      this.updateGlobalStatus({ status: 'disconnected', qrCode: null, connectedPhoneNumber: undefined });
    }
  }

  // Placeholder para Task 3.1.5: Envio de Mensagens
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

// Para usar este serviço:
// 1. Crie uma instância: const whatsappService = new WhatsappConnectionService(userId);
// 2. Conecte: await whatsappService.connectToWhatsApp();
// 3. Obtenha status: WhatsappConnectionService.getStatus(userId);
// 4. Envie mensagens: await whatsappService.sendMessage(jid, payload);
// 5. Desconecte: await whatsappService.disconnectWhatsApp();
