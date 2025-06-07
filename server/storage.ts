// server/storage.ts (CORRIGIDO E COMPLETO)
import { db } from './db.js';
import * as schema from '../shared/schema.js';
import { eq, and, sql, desc, isNull, or, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { InsertFlowUserState, WhatsappFlowUserState, FlowElementData } from '../shared/schema.js';

// Mantendo os tipos que você já tinha
type InsertCampaignWithUser = typeof schema.campaigns.$inferInsert;
type InsertCreativeWithUser = typeof schema.creatives.$inferInsert;
type InsertFunnelWithUser = typeof schema.funnels.$inferInsert;
type InsertCopyWithUser = typeof schema.copies.$inferInsert;
type InsertLandingPageWithUser = typeof schema.landingPages.$inferInsert;
type InsertBudgetWithUser = typeof schema.budgets.$inferInsert;
type InsertFlowWithUser = typeof schema.flows.$inferInsert;
type InsertWhatsappTemplateWithUser = typeof schema.whatsappMessageTemplates.$inferInsert;
type InsertWhatsappMessageWithUser = typeof schema.whatsappMessages.$inferInsert;

export const storage = {
    // User
    async getUser(id: number) { return await db.query.users.findFirst({ where: eq(schema.users.id, id) }); },
    async getUserByEmail(email: string) { return await db.query.users.findFirst({ where: eq(schema.users.email, email) }); },
    async createUser(userData: typeof schema.insertUserSchema._type) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const [newUser] = await db.insert(schema.users).values({ ...userData, password: hashedPassword }).returning();
        return newUser;
    },
    async validatePassword(password: string, hash: string) { return await bcrypt.compare(password, hash); },

    // Dashboard
    async getDashboardData(userId: number) {
        const campaigns = await this.getCampaigns(userId);
        const funnels = await this.getFunnels(userId);
        const creatives = await this.getCreatives(userId);
        return { campaignsCount: campaigns.length, funnelsCount: funnels.length, creativesCount: creatives.length };
    },

    // Campaigns
    async getCampaigns(userId: number) { return await db.query.campaigns.findMany({ where: eq(schema.campaigns.userId, userId), orderBy: [desc(schema.campaigns.createdAt)] }); },
    async getCampaign(id: number, userId: number) { return await db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)) }); },
    async createCampaign(campaignData: InsertCampaignWithUser) { const [newCampaign] = await db.insert(schema.campaigns).values(campaignData).returning(); return newCampaign; },
    async updateCampaign(id: number, campaignData: Partial<InsertCampaignWithUser>, userId: number) { const [updatedCampaign] = await db.update(schema.campaigns).set(campaignData).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))).returning(); return updatedCampaign; },
    async deleteCampaign(id: number, userId: number) { await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))); },

    // Creatives
    async getCreatives(userId: number, campaignId?: number | null) {
        const conditions = [eq(schema.creatives.userId, userId)];
        if (campaignId !== undefined) {
            conditions.push(campaignId === null ? isNull(schema.creatives.campaignId) : eq(schema.creatives.campaignId, campaignId));
        }
        return await db.query.creatives.findMany({ where: and(...conditions), orderBy: [desc(schema.creatives.createdAt)] });
    },
    async createCreative(creativeData: InsertCreativeWithUser) { const [newCreative] = await db.insert(schema.creatives).values(creativeData).returning(); return newCreative; },
    async updateCreative(id: number, creativeData: Partial<InsertCreativeWithUser>, userId: number) { const [updatedCreative] = await db.update(schema.creatives).set(creativeData).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))).returning(); return updatedCreative; },
    async deleteCreative(id: number, userId: number) { await db.delete(schema.creatives).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))); },

    // Funnels
    async getFunnels(userId: number) { return await db.query.funnels.findMany({ where: eq(schema.funnels.userId, userId), orderBy: [desc(schema.funnels.createdAt)] }); },
    async createFunnel(funnelData: InsertFunnelWithUser) { const [newFunnel] = await db.insert(schema.funnels).values(funnelData).returning(); return newFunnel; },

    // Copies
    // ✅ CORREÇÃO: Usando 'launchPhase' e 'purposeKey' do schema e corrigindo o builder pattern.
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string) {
        let query = db.select().from(schema.copies).where(eq(schema.copies.userId, userId));
        if (campaignId) query = query.where(eq(schema.copies.campaignId, campaignId));
        if (phase) query = query.where(eq(schema.copies.launchPhase, phase as schema.LaunchPhase)); // Corrigido para 'launchPhase'
        if (purpose) query = query.where(eq(schema.copies.purposeKey, purpose)); // Corrigido para 'purposeKey'
        if (search) query = query.where(like(schema.copies.content, `%${search}%`));
        return await query.orderBy(desc(schema.copies.createdAt));
    },
    async createCopy(copyData: InsertCopyWithUser) { const [newCopy] = await db.insert(schema.copies).values(copyData).returning(); return newCopy; },
    async deleteCopy(id: number, userId: number) { await db.delete(schema.copies).where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId))); },

    // [O restante dos seus métodos de storage (Landing Pages, Budgets, Alerts) permanece aqui]
    // ...

    // ✅ NOVO: Métodos para o WhatsApp Flow Engine
    async getFlowUserState(userId: number, contactJid: string): Promise<WhatsappFlowUserState | undefined> {
        return await db.query.whatsappFlowUserStates.findFirst({ where: and(eq(schema.whatsappFlowUserStates.userId, userId), eq(schema.whatsappFlowUserStates.contactJid, contactJid)) });
    },
    async createFlowUserState(data: InsertFlowUserState): Promise<WhatsappFlowUserState> {
        const [newState] = await db.insert(schema.whatsappFlowUserStates).values(data).returning();
        return newState;
    },
    async updateFlowUserState(id: number, data: Partial<Omit<WhatsappFlowUserState, 'id' | 'userId' | 'contactJid'>>): Promise<WhatsappFlowUserState | undefined> {
        const [updatedState] = await db.update(schema.whatsappFlowUserStates).set({...data, lastInteractionAt: new Date()}).where(eq(schema.whatsappFlowUserStates.id, id)).returning();
        return updatedState;
    },
    async deleteFlowUserState(id: number): Promise<void> {
        await db.delete(schema.whatsappFlowUserStates).where(eq(schema.whatsappFlowUserStates.id, id));
    },
    async findTriggerFlow(userId: number, triggerText: string): Promise<schema.Flow | undefined> {
        // Lógica simples: encontrar um fluxo cujo nome corresponda ao gatilho
        return await db.query.flows.findFirst({ where: and(eq(schema.flows.userId, userId), eq(schema.flows.name, triggerText), eq(schema.flows.status, 'active')) });
    },


    // WhatsApp
    async getContacts(userId: number) {
        return await db.selectDistinct({ jid: schema.whatsappMessages.contactNumber }).from(schema.whatsappMessages).where(eq(schema.whatsappMessages.userId, userId));
    },
    async getMessages(userId: number, contactNumber: string) {
        return await db.query.whatsappMessages.findMany({
            where: and(eq(schema.whatsappMessages.userId, userId), eq(schema.whatsappMessages.contactNumber, contactNumber)),
            orderBy: [desc(schema.whatsappMessages.timestamp)]
        });
    },
    async createMessage(messageData: InsertWhatsappMessageWithUser) {
        const [newMessage] = await db.insert(schema.whatsappMessages).values(messageData).returning();
        return newMessage;
    },

    // [Restante dos métodos de WhatsApp Templates, Chat/MCP permanecem aqui]
    // ...

    // Chat / MCP
    async getChatSessions(userId: number) { return await db.query.chatSessions.findMany({ where: eq(schema.chatSessions.userId, userId), orderBy: [desc(schema.chatSessions.createdAt)] }); },
    async createChatSession(userId: number, title?: string | null) { const [newSession] = await db.insert(schema.chatSessions).values({ userId, title: title || 'Nova Conversa' }).returning(); return newSession; },
    // ✅ CORREÇÃO: Removendo o filtro por `userId` que não existe na tabela `chatMessages`
    async getChatMessages(sessionId: number, userId: number) {
      // Primeiro, verificamos se a sessão pertence ao usuário
      const session = await db.query.chatSessions.findFirst({ where: and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)) });
      if (!session) return []; // Se não pertence, retorna array vazio
      // Se pertence, busca as mensagens
      return await db.query.chatMessages.findMany({ where: eq(schema.chatMessages.sessionId, sessionId), orderBy: [schema.chatMessages.timestamp] });
    },
    async createChatMessage(messageData: typeof schema.chatMessages.$inferInsert) { const [newMessage] = await db.insert(schema.chatMessages).values(messageData).returning(); return newMessage; },
    async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string) { const [updatedSession] = await db.update(schema.chatSessions).set({ title: newTitle }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning(); return updatedSession; },
    async deleteChatSession(sessionId: number, userId: number) { await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))); }
};
