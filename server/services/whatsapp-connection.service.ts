// server/services/whatsapp-connection.service.ts (CORRIGIDO E COMPLETO)
import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WAMessage, type SocketConfig, jidNormalizedUser, proto } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import { storage } from '../storage.js';
import { logger } from '../logger.js';
import { io } from '../index.js';
import { WhatsappFlowEngine } from './whatsapp-flow.engine.js';

type WhatsAppStatus = { status: 'disconnected' | 'connecting' | 'connected' | 'qr_code'; qrCodeData?: string; error?: string; connectedPhoneNumber?: string; };

export class WhatsappConnectionService {
    private static instances = new Map<number, WhatsappConnectionService>();
    private static statuses = new Map<number, WhatsAppStatus>();
    private sock: any;
    public userId: number;
    private flowEngine: WhatsappFlowEngine;

    constructor(userId: number) {
        this.userId = userId;
        this.flowEngine = new WhatsappFlowEngine();
        if (WhatsappConnectionService.instances.has(userId)) {
            return WhatsappConnectionService.instances.get(userId)!;
        }
        WhatsappConnectionService.instances.set(this, this);
        this.updateStatus({ status: 'disconnected' });
    }

    private updateStatus(newStatus: Partial<WhatsAppStatus>) {
        const currentStatus = WhatsappConnectionService.statuses.get(this.userId) || { status: 'disconnected' };
        const updatedStatus = { ...currentStatus, ...newStatus } as WhatsAppStatus;
        WhatsappConnectionService.statuses.set(this.userId, updatedStatus);
        io.to(`user_${this.userId}`).emit('whatsapp_status', updatedStatus);
        logger.info({ userId: this.userId, status: updatedStatus.status }, 'WhatsApp status updated');
    }

    public static getStatus(userId: number): WhatsAppStatus { return WhatsappConnectionService.statuses.get(userId) || { status: 'disconnected' }; }

    async connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState(`server/sessions/baileys_${this.userId}`);
        this.sock = makeWASocket({ auth: state, printQRInTerminal: false, logger: logger as any });
        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                qrcode.toDataURL(qr, (err: Error | null | undefined, url: string) => {
                    if (err) { this.updateStatus({ status: 'disconnected', error: 'Falha ao gerar QR Code.' }); return; }
                    this.updateStatus({ status: 'qr_code', qrCodeData: url });
                });
            }
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                this.updateStatus({ status: 'disconnected', error: 'Conexão perdida.' });
                if (shouldReconnect) this.connectToWhatsApp();
            } else if (connection === 'open') {
                this.updateStatus({ status: 'connected', connectedPhoneNumber: jidNormalizedUser(this.sock.user?.id) });
            }
        });
        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[] }) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && msg.message) {
                const contactNumber = msg.key.remoteJid;
                const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (contactNumber) {
                    const savedMessage = await storage.createMessage({ userId: this.userId, contactNumber, message: messageText, direction: 'incoming' });
                    io.to(`user_${this.userId}`).emit('new_message', savedMessage);
                    await this.flowEngine.processMessage(this.userId, contactNumber, messageText);
                }
            }
        });
    }

    async sendMessage(to: string, message: any): Promise<proto.WebMessageInfo | undefined> {
        if (this.sock && WhatsappConnectionService.getStatus(this.userId).status === 'connected') {
            return await this.sock.sendMessage(to, message);
        } else {
            throw new Error('WhatsApp não está conectado.');
        }
    }

    // ✅ NOVO: Método estático para ser chamado de outros serviços
    static async sendMessageForUser(userId: number, to: string, message: any): Promise<proto.WebMessageInfo | undefined> {
        const instance = this.instances.get(userId);
        if (!instance) throw new Error(`Nenhuma instância de WhatsApp encontrada para o usuário ${userId}`);
        return instance.sendMessage(to, message);
    }
    
    async disconnectWhatsApp() { if (this.sock) await this.sock.logout(); this.updateStatus({ status: 'disconnected' }); }
}
