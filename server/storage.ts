// server/storage.ts (VERSÃO FINAL E COMPLETA)
import { db } from './db.js';
import * as schema from '../shared/schema.js';
import { eq, and, desc, isNull, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { InsertFlowUserState, WhatsappFlowUserState, FlowElementData, User } from '../shared/schema.js';

export const storage = {
    // User
    async getUser(id: number): Promise<User | undefined> { return db.query.users.findFirst({ where: eq(schema.users.id, id) }); },
    async getUserByEmail(email: string): Promise<User | undefined> { return db.query.users.findFirst({ where: eq(schema.users.email, email) }); },
    async createUser(userData: typeof schema.insertUserSchema._type): Promise<User> {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const [newUser] = await db.insert(schema.users).values({ ...userData, password: hashedPassword }).returning();
        return newUser;
    },
    async validatePassword(password: string, hash: string): Promise<boolean> { return bcrypt.compare(password, hash); },

    // Dashboard
    async getDashboardData(userId: number) { return { campaignsCount: 0, funnelsCount: 0, creativesCount: 0 }; },

    // Campaigns
    async getCampaigns(userId: number) { return db.query.campaigns.findMany({ where: eq(schema.campaigns.userId, userId), orderBy: [desc(schema.campaigns.createdAt)] }); },
    async getCampaign(id: number, userId: number) { return db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)) }); },
    async createCampaign(campaignData: schema.InsertCampaign) { const [nc] = await db.insert(schema.campaigns).values(campaignData).returning(); return nc; },
    async updateCampaign(id: number, data: Partial<schema.InsertCampaign>, userId: number) { const [uc] = await db.update(schema.campaigns).set(data).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))).returning(); return uc; },
    async deleteCampaign(id: number, userId: number) { await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))); },

    // Creatives
    async getCreatives(userId: number, campaignId?: number | null) {
        const conditions = [eq(schema.creatives.userId, userId)];
        if (campaignId !== undefined) conditions.push(campaignId === null ? isNull(schema.creatives.campaignId) : eq(schema.creatives.campaignId, campaignId));
        return db.query.creatives.findMany({ where: and(...conditions), orderBy: [desc(schema.creatives.createdAt)] });
    },
    async createCreative(creativeData: schema.InsertCreative) { const [nc] = await db.insert(schema.creatives).values(creativeData).returning(); return nc; },
    async updateCreative(id: number, data: Partial<schema.InsertCreative>, userId: number) { const [uc] = await db.update(schema.creatives).set(data).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))).returning(); return uc; },
    async deleteCreative(id: number, userId: number) { await db.delete(schema.creatives).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))); },

    // Funnels
    async getFunnels(userId: number) { return db.query.funnels.findMany({ where: eq(schema.funnels.userId, userId) }); },
    async createFunnel(funnelData: schema.InsertFunnel) { const [nf] = await db.insert(schema.funnels).values(funnelData).returning(); return nf; },

    // Copies
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string) {
        let query = db.select().from(schema.copies).where(eq(schema.copies.userId, userId));
        if (campaignId) query = query.where(eq(schema.copies.campaignId, campaignId));
        if (phase) query = query.where(eq(schema.copies.launchPhase, phase as schema.LaunchPhase));
        if (purpose) query = query.where(eq(schema.copies.purposeKey, purpose));
        if (search) query = query.where(like(schema.copies.content, `%${search}%`));
        return query.orderBy(desc(schema.copies.createdAt));
    },
    async createCopy(copyData: schema.InsertCopy) { const [nc] = await db.insert(schema.copies).values(copyData).returning(); return nc; },
    async deleteCopy(id: number, userId: number) { await db.delete(schema.copies).where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId))); },

    // Landing Pages
    async getLandingPages(userId: number) { return db.query.landingPages.findMany({ where: eq(schema.landingPages.userId, userId) }); },
    async getLandingPageBySlug(slug: string) { return db.query.landingPages.findFirst({ where: eq(schema.landingPages.slug, slug) }); },
    async getLandingPageByStudioProjectId(studioProjectId: string, userId: number) { return db.query.landingPages.findFirst({ where: and(eq(schema.landingPages.studioProjectId, studioProjectId), eq(schema.landingPages.userId, userId)) }); },
    async createLandingPage(lpData: schema.InsertLandingPage) { const [nlp] = await db.insert(schema.landingPages).values(lpData).returning(); return nlp; },
    async updateLandingPage(id: number, data: Partial<schema.InsertLandingPage>, userId: number) { const [ulp] = await db.update(schema.landingPages).set(data).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId))).returning(); return ulp; },
    async deleteLandingPage(id: number, userId: number) { await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId))); },

    // Budgets
    async getBudgets(userId: number) { return db.query.budgets.findMany({ where: eq(schema.budgets.userId, userId) }); },
    async createBudget(budgetData: schema.InsertBudget) { const [nb] = await db.insert(schema.budgets).values(budgetData).returning(); return nb; },

    // Alerts
    async getAlerts(userId: number, unreadOnly: boolean) {
        const conditions = [eq(schema.alerts.userId, userId)];
        if (unreadOnly) conditions.push(eq(schema.alerts.isRead, false));
        return db.query.alerts.findMany({ where: and(...conditions), orderBy: [desc(schema.alerts.createdAt)] });
    },
    async markAlertAsRead(id: number, userId: number) { await db.update(schema.alerts).set({ isRead: true }).where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId))); },

    // WhatsApp
    async getContacts(userId: number) { return db.selectDistinct({ jid: schema.whatsappMessages.contactNumber }).from(schema.whatsappMessages).where(eq(schema.whatsappMessages.userId, userId)); },
    async getMessages(userId: number, contactNumber: string) { return db.query.whatsappMessages.findMany({ where: and(eq(schema.whatsappMessages.userId, userId), eq(schema.whatsappMessages.contactNumber, contactNumber)), orderBy: [desc(schema.whatsappMessages.timestamp)] }); },
    async createMessage(messageData: schema.InsertWhatsappMessage) { const [nm] = await db.insert(schema.whatsappMessages).values(messageData).returning(); return nm; },
    async getWhatsappTemplates(userId: number) { return db.query.whatsappMessageTemplates.findMany({ where: eq(schema.whatsappMessageTemplates.userId, userId) }); },
    async createWhatsappTemplate(templateData: schema.InsertWhatsappMessageTemplate) { const [nt] = await db.insert(schema.whatsappMessageTemplates).values(templateData).returning(); return nt; },
    async updateWhatsappTemplate(id: number, data: Partial<schema.InsertWhatsappMessageTemplate>, userId: number) { const [ut] = await db.update(schema.whatsappMessageTemplates).set(data).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))).returning(); return ut; },
    async deleteWhatsappTemplate(id: number, userId: number) { const result = await db.delete(schema.whatsappMessageTemplates).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))); return result.rowCount > 0; },
    
    // Chat / MCP
    async getChatSessions(userId: number) { return db.query.chatSessions.findMany({ where: eq(schema.chatSessions.userId, userId), orderBy: [desc(schema.chatSessions.createdAt)] }); },
    async createChatSession(userId: number, title?: string | null) { const [ns] = await db.insert(schema.chatSessions).values({ userId, title: title || 'Nova Conversa' }).returning(); return ns; },
    async getChatMessages(sessionId: number, userId: number) {
      const session = await db.query.chatSessions.findFirst({ where: and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)) });
      if (!session) return [];
      return db.query.chatMessages.findMany({ where: eq(schema.chatMessages.sessionId, sessionId), orderBy: [schema.chatMessages.timestamp] });
    },
    async createChatMessage(messageData: schema.InsertChatMessage) { const [nm] = await db.insert(schema.chatMessages).values(messageData).returning(); return nm; },
    async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string) { const [us] = await db.update(schema.chatSessions).set({ title: newTitle }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning(); return us; },
    async deleteChatSession(sessionId: number, userId: number) { await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))); }
};
