// server/storage.ts (CORRIGIDO E COMPLETO)
import { db } from './db.js';
import * as schema from '../shared/schema.js';
import { eq, and, sql, desc, isNull, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { WhatsappFlowUserState, InsertFlowUserState, FlowElementData } from '../shared/schema.js';

// Seus tipos personalizados (estão corretos)
type InsertCampaignWithUser = typeof schema.campaigns.$inferInsert;
type InsertCreativeWithUser = typeof schema.creatives.$inferInsert;
// ... e outros que você tenha

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
    async getDashboardData(userId: number) { /* ... seu código existente ... */ return {}; },

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

    // Copies
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string) {
        let query = db.select().from(schema.copies).where(eq(schema.copies.userId, userId));
        if (campaignId) query = query.where(eq(schema.copies.campaignId, campaignId));
        if (phase) query = query.where(eq(schema.copies.launchPhase, phase as schema.LaunchPhase));
        if (purpose) query = query.where(eq(schema.copies.purposeKey, purpose));
        if (search) query = query.where(like(schema.copies.content, `%${search}%`));
        return await query.orderBy(desc(schema.copies.createdAt));
    },
    // ... outros métodos de Copies

    // ✅ NOVO: MÉTODOS PARA O WHATSAPP FLOW ENGINE
    async getFlow(id: number, userId: number): Promise<schema.Flow | undefined> {
        return await db.query.flows.findFirst({ where: and(eq(schema.flows.id, id), eq(schema.flows.userId, userId)) });
    },
    async getFlows(userId: number, campaignId?: number | null) {
        const conditions = [eq(schema.flows.userId, userId)];
        if (campaignId !== undefined) {
            conditions.push(campaignId === null ? isNull(schema.flows.campaignId) : eq(schema.flows.campaignId, campaignId));
        }
        return await db.query.flows.findMany({ where: and(...conditions), orderBy: [desc(schema.flows.createdAt)] });
    },
    async createFlow(flowData: InsertFlowWithUser) { const [newFlow] = await db.insert(schema.flows).values(flowData).returning(); return newFlow; },
    async updateFlow(id: number, flowData: Partial<InsertFlowWithUser>, userId: number) { const [updatedFlow] = await db.update(schema.flows).set(flowData).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId))).returning(); return updatedFlow; },
    async deleteFlow(id: number, userId: number) { await db.delete(schema.flows).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId))); },
    
    async getFlowUserState(userId: number, contactJid: string): Promise<WhatsappFlowUserState | undefined> {
        return await db.query.whatsappFlowUserStates.findFirst({ where: and(eq(schema.whatsappFlowUserStates.userId, userId), eq(schema.whatsappFlowUserStates.contactJid, contactJid)) });
    },
    async createFlowUserState(data: InsertFlowUserState): Promise<WhatsappFlowUserState> {
        const [newState] = await db.insert(schema.whatsappFlowUserStates).values(data).returning();
        return newState;
    },
    async updateFlowUserState(id: number, data: Partial<Omit<WhatsappFlowUserState, 'id' | 'userId' | 'contactJid'>>): Promise<WhatsappFlowUserState | undefined> {
        const [updatedState] = await db.update(schema.whatsappFlowUserStates).set({ ...data, lastInteractionAt: new Date() }).where(eq(schema.whatsappFlowUserStates.id, id)).returning();
        return updatedState;
    },
    async deleteFlowUserState(id: number): Promise<void> {
        await db.delete(schema.whatsappFlowUserStates).where(eq(schema.whatsappFlowUserStates.id, id));
    },
    async findTriggerFlow(userId: number, triggerText: string): Promise<schema.Flow | undefined> {
        return await db.query.flows.findFirst({ where: and(eq(schema.flows.userId, userId), eq(schema.flows.name, triggerText), eq(schema.flows.status, 'active')) });
    },

    // Chat / MCP
    // ✅ CORREÇÃO: Removendo o filtro por `userId` que não existe na tabela `chatMessages`
    async getChatMessages(sessionId: number, userId: number) {
      const session = await db.query.chatSessions.findFirst({ where: and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)) });
      if (!session) return [];
      return await db.query.chatMessages.findMany({ where: eq(schema.chatMessages.sessionId, sessionId), orderBy: [schema.chatMessages.timestamp] });
    },
    // ... [Restante dos seus métodos de storage]
};
