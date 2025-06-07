import { eq, desc } from 'drizzle-orm';
import { db } from './db/index.js';
import { chatSessions, chatMessages as chatMessagesTable } from './db/schema.js';

class DatabaseStorage {
    constructor(db) {
        this.db = db;
    }

    async getChatSessions(userId) {
        if (!userId) {
            console.error('[DB] Tentativa de buscar sessões sem userId');
            return [];
        }
        try {
            const sessions = await this.db.select()
                .from(chatSessions)
                .where(eq(chatSessions.userId, userId))
                .orderBy(desc(chatSessions.createdAt));
            return sessions;
        } catch (error) {
            console.error('[DB] Erro ao buscar sessões de chat:', error);
            throw error;
        }
    }

    async getChatSession(sessionId, userId) {
        if (!sessionId || !userId) {
            console.error('[DB] Tentativa de buscar sessão com parâmetros inválidos');
            return null;
        }
        try {
            const result = await this.db.select()
                .from(chatSessions)
                .where(eq(chatSessions.id, sessionId) && eq(chatSessions.userId, userId));
            return result[0] || null;
        } catch (error) {
            console.error(`[DB] Erro ao buscar sessão de chat ${sessionId}:`, error);
            throw error;
        }
    }

    async createChatSession(userId, title) {
        if (!userId) {
            console.error('[DB] Tentativa de criar sessão sem userId');
            throw new Error('User ID é obrigatório para criar uma sessão de chat.');
        }
        try {
            const [newSession] = await this.db.insert(chatSessions)
                .values({
                    userId,
                    title: title || 'Nova Conversa',
                })
                .returning();
            return newSession;
        } catch (error) {
            console.error('[DB] Erro ao criar sessão de chat:', error);
            throw error;
        }
    }
    
    async getChatMessages(sessionId) {
        if (!sessionId) {
            console.error('[DB] Tentativa de buscar mensagens sem sessionId');
            return [];
        }
        try {
            const messages = await this.db.select()
                .from(chatMessagesTable)
                .where(eq(chatMessagesTable.sessionId, sessionId))
                .orderBy(chatMessagesTable.createdAt);
            
            // Mapeia o resultado para o formato esperado (role, content)
            return messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
        } catch (error) {
            console.error(`[DB] Erro ao buscar mensagens para a sessão ${sessionId}:`, error);
            throw error;
        }
    }
    
    async addChatMessage(sessionId, { role, content }) {
        if (!sessionId || !role || content === undefined) {
            console.error('[DB] Tentativa de adicionar mensagem com parâmetros inválidos:', { sessionId, role, content });
            throw new Error('Parâmetros inválidos para adicionar mensagem de chat.');
        }
        try {
            // CORREÇÃO: A coluna é 'role', não 'sender'.
            const [newMessage] = await this.db.insert(chatMessagesTable)
                .values({
                    sessionId,
                    role: role, // Alterado de 'sender' para 'role'
                    content,
                })
                .returning();
            return newMessage;
        } catch (error) {
            console.error(`[DB] Erro ao adicionar mensagem de chat na sessão ${sessionId}:`, error);
            throw error;
        }
    }
}

let storageInstance;

export const getStorage = () => {
    if (!storageInstance) {
        storageInstance = new DatabaseStorage(db);
    }
    return storageInstance;
};
