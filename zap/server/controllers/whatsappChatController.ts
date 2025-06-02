// zap/server/controllers/whatsappChatController.ts
import { Request, Response, NextFunction } from 'express';
import { zapDb } from '../db';
import { whatsappMessages, insertWhatsappMessageSchema as zodInsertWhatsappMessageSchema, ZapMessage, NewZapMessage } from '../../shared/zap_schema';
import { sql, eq, and, desc, max as maxAgg } from 'drizzle-orm';
import { sendMessage as sendBaileysMessageFromService } from '../services/WhatsappConnectionService';
import { ZodError } from 'zod';
import { AnyMessageContent } from '@whiskeysockets/baileys';

const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapContactsController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const searchTerm = (req.query.search as string || '').toLowerCase();
    console.log(`[ZapChatCtrl /contacts] GET para User: ${mktv2UserId}, Search: "${searchTerm}"`);

    try {
        const latestMessageSubquery = zapDb.$with('latest_contact_activity_ctrl_chat').as(
            zapDb.select({
                contactJid: whatsappMessages.contactJid,
                lastMessageTimestamp: maxAgg(whatsappMessages.timestamp).as('last_timestamp'),
                unreadCount: sql<number>`SUM(CASE WHEN ${whatsappMessages.direction} = 'incoming' AND ${whatsappMessages.isReadByZapUser} = false THEN 1 ELSE 0 END)`.as('unread_count')
            })
            .from(whatsappMessages)
            .where(eq(whatsappMessages.mktv2UserId, mktv2UserId))
            .groupBy(whatsappMessages.contactJid)
        );

        const contactsWithLastMessage = await zapDb.with(latestMessageSubquery)
            .select({
                contactJid: whatsappMessages.contactJid,
                name: whatsappMessages.contactJid, 
                profilePictureUrl: sql<string>`NULL`.as('profilePictureUrl'),
                lastMessageContent: whatsappMessages.content,
                lastMessageTimestamp: latestMessageSubquery.lastMessageTimestamp,
                unreadCount: latestMessageSubquery.unreadCount,
            })
            .from(whatsappMessages)
            .innerJoin(latestMessageSubquery, and(
                eq(whatsappMessages.contactJid, latestMessageSubquery.contactJid),
                eq(whatsappMessages.timestamp, latestMessageSubquery.lastMessageTimestamp)
            ))
            .where(eq(whatsappMessages.mktv2UserId, mktv2UserId))
            .orderBy(desc(latestMessageSubquery.lastMessageTimestamp));

        const formattedContacts = contactsWithLastMessage.map(c => {
            let snippet = '[Mídia]';
            // @ts-ignore
            if (c.lastMessageContent?.text) snippet = c.lastMessageContent.text;
            // @ts-ignore
            else if (c.lastMessageContent?.caption) snippet = c.lastMessageContent.caption;
            
            return {
                contactJid: c.contactJid,
                name: c.name, 
                profilePictureUrl: c.profilePictureUrl,
                lastMessageSnippet: snippet,
                lastMessageTimestamp: c.lastMessageTimestamp,
                unreadCount: Number(c.unreadCount || 0),
            };
        }).filter(c => 
            (c.name && c.name.toLowerCase().includes(searchTerm)) || 
            c.contactJid.toLowerCase().includes(searchTerm)
        );
        
        res.json(formattedContacts);
    } catch (error) {
        console.error("[ZapChatCtrl /contacts] Erro:", error);
        next(error);
    }
};

export const getZapMessagesController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const contactJid = req.query.contactJid as string;
    
    if (!contactJid) return res.status(400).json({ message: 'contactJid é obrigatório' });
    console.log(`[ZapChatCtrl /messages] GET para User: ${mktv2UserId}, JID: ${contactJid}`);

    try {
        const messages = await zapDb.select()
            .from(whatsappMessages)
            .where(and(
                eq(whatsappMessages.mktv2UserId, mktv2UserId),
                eq(whatsappMessages.contactJid, contactJid)
            ))
            .orderBy(whatsappMessages.timestamp);
        
        // Marcar mensagens como lidas pelo usuário do Zap (opcional, se a UI suportar "marcar como não lida")
        // await zapDb.update(whatsappMessages)
        //   .set({ isReadByZapUser: true })
        //   .where(and(
        //       eq(whatsappMessages.mktv2UserId, mktv2UserId),
        //       eq(whatsappMessages.contactJid, contactJid),
        //       eq(whatsappMessages.direction, 'incoming'),
        //       eq(whatsappMessages.isReadByZapUser, false)
        //   ));
        
        res.json(messages);
    } catch (error) {
        console.error(`[ZapChatCtrl /messages] Erro para JID ${contactJid}:`, error);
        next(error);
    }
};

export const sendZapTextMessageController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    try {
        const validationSchema = z.object({
            jid: z.string().min(5),
            content: z.object({ text: z.string().min(1) })
        });
        const parsedBody = validationSchema.parse(req.body);
        const { jid, content } = parsedBody;

        console.log(`[ZapChatCtrl /send-message] User: ${mktv2UserId}, JID: ${jid}`, content);
        
        const baileysContent: AnyMessageContent = { text: content.text };
        const messageInfo = await sendBaileysMessageFromService(mktv2UserId, jid, baileysContent);

        if (!messageInfo || !messageInfo.key.id) {
            throw new Error("Falha ao enviar mensagem via Baileys Service ou Baileys não retornou ID.");
        }
        
        // O salvamento no DB é feito dentro do `sendBaileysMessageFromService` (que chama `WhatsappConnectionService`)
        // ou pelo `messages.upsert` no service.
        // Buscamos a mensagem recém-salva para retornar ao frontend.
        const sentMessageFromDb = await zapDb.query.whatsappMessages.findFirst({
            where: and(
                eq(whatsappMessages.mktv2UserId, mktv2UserId),
                eq(whatsappMessages.baileysMessageId, messageInfo.key.id)
            )
        });

        if (!sentMessageFromDb) {
            console.warn(`[ZapChatCtrl /send-message] Mensagem enviada (ID Baileys: ${messageInfo.key.id}) mas não encontrada no DB para retorno imediato.`);
            // Retornar um objeto com base no messageInfo se não encontrado no DB
            const tempReturnMessage: Omit<ZapMessage, 'id' | 'createdAt'> & {id?: number} = { // id é opcional
                mktv2UserId,
                baileysMessageId: messageInfo.key.id,
                contactJid: jid,
                messageType: 'text',
                content: content,
                direction: 'outgoing',
                timestamp: new Date((typeof messageInfo.messageTimestamp === 'number' ? messageInfo.messageTimestamp : messageInfo.messageTimestamp?.toNumber() || Date.now()) * 1000),
                status: 'sent',
                isReadByZapUser: true,
                flowId: null, quotedMessageContent: null, quotedMessageId: null, quotedMessageSenderJid: null,
            };
            return res.status(201).json(tempReturnMessage);
        }
        
        res.status(201).json(sentMessageFromDb);

    } catch (error) {
        console.error(`[ZapChatCtrl /send-message] Erro:`, error);
        next(error);
    }
};

export const sendZapMediaMessageController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    // TODO: Implementar upload de arquivo com Multer.
    // TODO: Chamar sendBaileysMessageFromService com o tipo de mídia correto e buffer/URL.
    console.log(`[ZapChatCtrl /send-media] POST para User: ${mktv2UserId} (NÃO IMPLEMENTADO COM UPLOAD E BAILEYS REAL)`);
    res.status(501).json({ message: "Envio de mídia ainda não totalmente implementado."});
};