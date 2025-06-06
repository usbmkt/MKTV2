// server/services/whatsapp-connection.service.ts
import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WAMessage, type SocketConfig } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import { storage } from '../storage.js';
import { logger } from '../logger.js';
import { io } from '../index.js';

type WhatsAppStatus = {
    status: 'disconnected' | 'connecting' | 'connected' | 'qr_code';
    qrCodeData?: string;
    error?: string;
};

export class WhatsappConnectionService {
    private static instances = new Map<number, WhatsappConnectionService>();
    private static statuses = new Map<number, WhatsAppStatus>();

    private sock: any;
    public userId: number;

    constructor(userId: number) {
        this.userId = userId;
        if (WhatsappConnectionService.instances.has(userId)) {
            return WhatsappConnectionService.instances.get(userId)!;
        }
        WhatsappConnectionService.instances.set(userId, this);
        this.updateStatus({ status: 'disconnected' });
    }

    private updateStatus(newStatus: Partial<WhatsAppStatus>) {
        const currentStatus = WhatsappConnectionService.statuses.get(this.userId) || { status: 'disconnected' };
        const updatedStatus = { ...currentStatus, ...newStatus };
        WhatsappConnectionService.statuses.set(this.userId, updatedStatus as WhatsAppStatus);
        io.to(`user_${this.userId}`).emit('whatsapp_status', updatedStatus);
        logger.info({ userId: this.userId, status: updatedStatus.status }, 'WhatsApp status updated');
    }

    public static getStatus(userId: number): WhatsAppStatus {
        return WhatsappConnectionService.statuses.get(userId) || { status: 'disconnected' };
    }

    async connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState(`server/sessions/baileys_${this.userId}`);
        
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger as any,
        });

        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrcode.toDataURL(qr, (err, url) => {
                    if (err) {
                        logger.error(err, 'Failed to generate QR code');
                        this.updateStatus({ status: 'disconnected', error: 'Falha ao gerar QR Code.' });
                        return;
                    }
                    this.updateStatus({ status: 'qr_code', qrCodeData: url });
                });
            }

            if (connection === 'connecting') {
                this.updateStatus({ status: 'connecting' });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.warn({ lastDisconnect, shouldReconnect }, 'Connection closed');
                this.updateStatus({ status: 'disconnected', error: 'Conexão perdida. Tentando reconectar...' });
                if (shouldReconnect) {
                    this.connectToWhatsApp();
                } else {
                    this.updateStatus({ status: 'disconnected', error: 'Desconectado permanentemente.' });
                }
            } else if (connection === 'open') {
                this.updateStatus({ status: 'connected' });
                logger.info({ userId: this.userId }, 'WhatsApp connected');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[] }) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && msg.message) {
                const contactNumber = msg.key.remoteJid;
                const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                
                if (contactNumber) {
                    const savedMessage = await storage.createMessage({
                        userId: this.userId,
                        contactNumber: contactNumber,
                        message: messageText,
                        direction: 'incoming',
                    });
                    io.to(`user_${this.userId}`).emit('new_message', savedMessage);
                    logger.info({ from: contactNumber, text: messageText }, 'Received a new message');
                    // TODO: Hook to Flow Engine here
                }
            }
        });
    }

    async sendMessage(to: string, message: any) {
        if (this.sock && WhatsappConnectionService.getStatus(this.userId).status === 'connected') {
            await this.sock.sendMessage(to, message);
        } else {
            throw new Error('WhatsApp not connected.');
        }
    }

    async disconnectWhatsApp() {
        if (this.sock) {
            await this.sock.logout();
        }
        this.updateStatus({ status: 'disconnected' });
    }
}
