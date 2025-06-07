// server/storage.ts
import { db } from './db.js';
import * as schema from '../shared/schema.js';
import { eq, and, sql, desc, isNull, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Tipos para facilitar a passagem de dados com userId
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
    async getUser(id: number) {
        return await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    },
    async getUserByEmail(email: string) {
        return await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    },
    async createUser(userData: typeof schema.insertUserSchema._type) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const [newUser] = await db.insert(schema.users).values({ ...userData, password: hashedPassword }).returning();
        return newUser;
    },
    async validatePassword(password: string, hash: string) {
        return await bcrypt.compare(password, hash);
    },

    // Dashboard
    async getDashboardData(userId: number) {
        const campaigns = await this.getCampaigns(userId);
        const funnels = await this.getFunnels(userId);
        const creatives = await this.getCreatives(userId);
        return {
            campaignsCount: campaigns.length,
            funnelsCount: funnels.length,
            creativesCount: creatives.length,
        };
    },

    // Campaigns
    async getCampaigns(userId: number) {
        return await db.query.campaigns.findMany({ where: eq(schema.campaigns.userId, userId), orderBy: [desc(schema.campaigns.createdAt)] });
    },
    async getCampaign(id: number, userId: number) {
        return await db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)) });
    },
    async createCampaign(campaignData: InsertCampaignWithUser) {
        const [newCampaign] = await db.insert(schema.campaigns).values(campaignData).returning();
        return newCampaign;
    },
    async updateCampaign(id: number, campaignData: Partial<InsertCampaignWithUser>, userId: number) {
        const [updatedCampaign] = await db.update(schema.campaigns).set(campaignData).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))).returning();
        return updatedCampaign;
    },
    async deleteCampaign(id: number, userId: number) {
        await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)));
    },

    // Creatives
    async getCreatives(userId: number, campaignId?: number | null) {
        const conditions = [eq(schema.creatives.userId, userId)];
        if (campaignId) {
            conditions.push(eq(schema.creatives.campaignId, campaignId));
        } else if (campaignId === null) {
            conditions.push(isNull(schema.creatives.campaignId));
        }
        return await db.query.creatives.findMany({ where: and(...conditions), orderBy: [desc(schema.creatives.createdAt)] });
    },
    async createCreative(creativeData: InsertCreativeWithUser) {
        const [newCreative] = await db.insert(schema.creatives).values(creativeData).returning();
        return newCreative;
    },
    async updateCreative(id: number, creativeData: Partial<InsertCreativeWithUser>, userId: number) {
        const [updatedCreative] = await db.update(schema.creatives).set(creativeData).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))).returning();
        return updatedCreative;
    },
    async deleteCreative(id: number, userId: number) {
        await db.delete(schema.creatives).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)));
    },

    // Funnels
    async getFunnels(userId: number) {
        return await db.query.funnels.findMany({ where: eq(schema.funnels.userId, userId), orderBy: [desc(schema.funnels.createdAt)] });
    },
    async createFunnel(funnelData: InsertFunnelWithUser) {
        const [newFunnel] = await db.insert(schema.funnels).values(funnelData).returning();
        return newFunnel;
    },

    // Copies
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string) {
        let query = db.select().from(schema.copies).where(eq(schema.copies.userId, userId));
        if (campaignId) query = query.where(eq(schema.copies.campaignId, campaignId));
        if (phase) query = query.where(eq(schema.copies.phase, phase));
        if (purpose) query = query.where(eq(schema.copies.purpose, purpose));
        if (search) query = query.where(sql`"text" ILIKE ${'%' + search + '%'}`);
        return await query.orderBy(desc(schema.copies.createdAt));
    },
    async createCopy(copyData: InsertCopyWithUser) {
        const [newCopy] = await db.insert(schema.copies).values(copyData).returning();
        return newCopy;
    },
    async deleteCopy(id: number, userId: number) {
        await db.delete(schema.copies).where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId)));
    },

    // Landing Pages
    async getLandingPages(userId: number) {
        return await db.query.landingPages.findMany({ where: eq(schema.landingPages.userId, userId), orderBy: [desc(schema.landingPages.createdAt)] });
    },
    async getLandingPageBySlug(slug: string) {
        return await db.query.landingPages.findFirst({ where: eq(schema.landingPages.slug, slug) });
    },
    async getLandingPageByStudioProjectId(studioProjectId: string, userId: number) {
        return await db.query.landingPages.findFirst({ where: and(eq(schema.landingPages.studioProjectId, studioProjectId), eq(schema.landingPages.userId, userId)) });
    },
    async createLandingPage(lpData: InsertLandingPageWithUser) {
        const [newLp] = await db.insert(schema.landingPages).values(lpData).returning();
        return newLp;
    },
    async updateLandingPage(id: number, lpData: Partial<InsertLandingPageWithUser>, userId: number) {
        const [updatedLp] = await db.update(schema.landingPages).set(lpData).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId))).returning();
        return updatedLp;
    },
    async deleteLandingPage(id: number, userId: number) {
        await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId)));
    },

    // Budgets
    async getBudgets(userId: number) {
        return await db.query.budgets.findMany({ where: eq(schema.budgets.userId, userId), orderBy: [desc(schema.budgets.createdAt)] });
    },
    async createBudget(budgetData: InsertBudgetWithUser) {
        const [newBudget] = await db.insert(schema.budgets).values(budgetData).returning();
        return newBudget;
    },

    // Alerts
    async getAlerts(userId: number, unreadOnly: boolean = false) {
        const conditions = [eq(schema.alerts.userId, userId)];
        if (unreadOnly) conditions.push(eq(schema.alerts.isRead, false));
        return await db.query.alerts.findMany({ where: and(...conditions), orderBy: [desc(schema.alerts.createdAt)] });
    },
    async markAlertAsRead(id: number, userId: number) {
        await db.update(schema.alerts).set({ isRead: true }).where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId)));
    },

    // Flows
    async getFlow(id: number, userId: number) {
        return await db.query.flows.findFirst({ where: and(eq(schema.flows.id, id), eq(schema.flows.userId, userId)) });
    },
    async getFlows(userId: number, campaignId?: number | null) {
        const conditions = [eq(schema.flows.userId, userId)];
        if (campaignId) {
            conditions.push(eq(schema.flows.campaignId, campaignId));
        } else if (campaignId === null) {
            conditions.push(isNull(schema.flows.campaignId));
        }
        return await db.query.flows.findMany({ where: and(...conditions), orderBy: [desc(schema.flows.createdAt)] });
    },
    async createFlow(flowData: InsertFlowWithUser) {
        const [newFlow] = await db.insert(schema.flows).values(flowData).returning();
        return newFlow;
    },
    async updateFlow(id: number, flowData: Partial<InsertFlowWithUser>, userId: number) {
        const [updatedFlow] = await db.update(schema.flows).set(flowData).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId))).returning();
        return updatedFlow;
    },
    async deleteFlow(id: number, userId: number) {
        await db.delete(schema.flows).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId)));
    },

    // WhatsApp
    async getContacts(userId: number) {
        return await db.selectDistinct({ jid: schema.whatsappMessages.contactNumber })
            .from(schema.whatsappMessages)
            .where(eq(schema.whatsappMessages.userId, userId));
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
    async getWhatsappTemplates(userId: number) {
        return await db.query.whatsappMessageTemplates.findMany({ where: eq(schema.whatsappMessageTemplates.userId, userId) });
    },
    async createWhatsappTemplate(templateData: InsertWhatsappTemplateWithUser) {
        const [newTemplate] = await db.insert(schema.whatsappMessageTemplates).values(templateData).returning();
        return newTemplate;
    },
    async updateWhatsappTemplate(id: number, templateData: Partial<InsertWhatsappTemplateWithUser>, userId: number) {
        const [updatedTemplate] = await db.update(schema.whatsappMessageTemplates).set(templateData).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))).returning();
        return updatedTemplate;
    },
    async deleteWhatsappTemplate(id: number, userId: number) {
        const result = await db.delete(schema.whatsappMessageTemplates).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId)));
        return result.rowCount > 0;
    },
    
    // Chat / MCP
    async getChatSessions(userId: number) {
        return await db.query.chatSessions.findMany({ where: eq(schema.chatSessions.userId, userId), orderBy: [desc(schema.chatSessions.createdAt)] });
    },
    async createChatSession(userId: number, title?: string | null) {
        const [newSession] = await db.insert(schema.chatSessions).values({ userId, title: title || 'Nova Conversa' }).returning();
        return newSession;
    },
    async getChatMessages(sessionId: number, userId: number) {
        return await db.query.chatMessages.findMany({ where: and(eq(schema.chatMessages.sessionId, sessionId), eq(schema.chatMessages.userId, userId)), orderBy: [schema.chatMessages.createdAt] });
    },
    async createChatMessage(messageData: typeof schema.chatMessages.$inferInsert) {
        const [newMessage] = await db.insert(schema.chatMessages).values(messageData).returning();
        return newMessage;
    },
    async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string) {
        const [updatedSession] = await db.update(schema.chatSessions).set({ title: newTitle }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning();
        return updatedSession;
    },
    async deleteChatSession(sessionId: number, userId: number) {
        await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)));
    }
};
