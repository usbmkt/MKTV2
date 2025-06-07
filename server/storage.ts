// usbmkt/mktv2/MKTV2-mktv5/server/storage.ts

import { db } from './db.js';
import * as schema from '../shared/schema.js';
import type { LaunchPhase } from '../shared/schema.js';
import { eq, and, sql, desc, isNull, or, ilike } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { FlowElementData } from '../shared/schema.js';

// Definições de tipo para clareza
type User = typeof schema.users.$inferSelect;
type Campaign = typeof schema.campaigns.$inferSelect;
type InsertCampaign = typeof schema.campaigns.$inferInsert;
type Creative = typeof schema.creatives.$inferSelect;
type InsertCreative = typeof schema.creatives.$inferInsert;
type Funnel = typeof schema.funnels.$inferSelect;
type InsertFunnel = typeof schema.funnels.$inferInsert;
type Copy = typeof schema.copies.$inferSelect;
type InsertCopy = typeof schema.copies.$inferInsert;
type LandingPage = typeof schema.landingPages.$inferSelect;
type InsertLandingPage = typeof schema.landingPages.$inferInsert;
type Budget = typeof schema.budgets.$inferSelect;
type InsertBudget = typeof schema.budgets.$inferInsert;
type Alert = typeof schema.alerts.$inferSelect;
type InsertAlert = typeof schema.alerts.$inferInsert;
type Flow = typeof schema.flows.$inferSelect;
type InsertFlow = typeof schema.flows.$inferInsert;
type WhatsappMessageTemplate = typeof schema.whatsappMessageTemplates.$inferSelect;
type InsertWhatsappMessageTemplate = typeof schema.whatsappMessageTemplates.$inferInsert;
type WhatsappMessage = typeof schema.whatsappMessages.$inferSelect;
type InsertWhatsappMessage = typeof schema.whatsappMessages.$inferInsert;
type WhatsappFlowUserState = typeof schema.whatsappFlowUserStates.$inferSelect;
type InsertFlowUserState = typeof schema.whatsappFlowUserStates.$inferInsert;
type ChatSession = typeof schema.chatSessions.$inferSelect;
type InsertChatSession = typeof schema.chatSessions.$inferInsert;
type ChatMessage = typeof schema.chatMessages.$inferSelect;
type InsertChatMessage = typeof schema.chatMessages.$inferInsert;


export const storage = {
    // User
    async getUser(id: number): Promise<User | undefined> {
        return await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    },
    async getUserByEmail(email: string): Promise<User | undefined> {
        return await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    },
    async createUser(userData: schema.InsertUser): Promise<User> {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const [newUser] = await db.insert(schema.users).values({ ...userData, password: hashedPassword }).returning();
        if (!newUser) throw new Error("Falha ao criar usuário.");
        return newUser;
    },
    async validatePassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    },

    // Campaigns
    async getCampaigns(userId: number): Promise<Campaign[]> {
        return await db.query.campaigns.findMany({ where: eq(schema.campaigns.userId, userId), orderBy: [desc(schema.campaigns.createdAt)] });
    },
    async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
        return await db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)) });
    },
    async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
        const [newCampaign] = await db.insert(schema.campaigns).values(campaignData).returning();
        if (!newCampaign) throw new Error("Falha ao criar campanha.");
        return newCampaign;
    },
    async updateCampaign(id: number, campaignData: Partial<InsertCampaign>, userId: number): Promise<Campaign | undefined> {
        const [updatedCampaign] = await db.update(schema.campaigns).set(campaignData).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId))).returning();
        return updatedCampaign;
    },
    async deleteCampaign(id: number, userId: number): Promise<void> {
        await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)));
    },

    // Creatives
    async getCreatives(userId: number, campaignId?: number | null): Promise<Creative[]> {
        const conditions = [eq(schema.creatives.userId, userId)];
        if (campaignId) {
            conditions.push(eq(schema.creatives.campaignId, campaignId));
        } else if (campaignId === null) {
            conditions.push(isNull(schema.creatives.campaignId));
        }
        return await db.query.creatives.findMany({ where: and(...conditions), orderBy: [desc(schema.creatives.createdAt)] });
    },
    async createCreative(creativeData: InsertCreative): Promise<Creative> {
        const [newCreative] = await db.insert(schema.creatives).values(creativeData).returning();
        if (!newCreative) throw new Error("Falha ao criar criativo.");
        return newCreative;
    },
    async updateCreative(id: number, creativeData: Partial<InsertCreative>, userId: number): Promise<Creative | undefined> {
        const [updatedCreative] = await db.update(schema.creatives).set(creativeData).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId))).returning();
        return updatedCreative;
    },
    async deleteCreative(id: number, userId: number): Promise<void> {
        await db.delete(schema.creatives).where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)));
    },
    async getCreative(id: number, userId: number): Promise<Creative | undefined> {
        return await db.query.creatives.findFirst({ where: and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)) });
    },

    // Funnels
    async getFunnels(userId: number): Promise<Funnel[]> {
        return await db.query.funnels.findMany({ where: eq(schema.funnels.userId, userId), orderBy: [desc(schema.funnels.createdAt)] });
    },
    async createFunnel(funnelData: InsertFunnel): Promise<Funnel> {
        const [newFunnel] = await db.insert(schema.funnels).values(funnelData).returning();
        if (!newFunnel) throw new Error("Falha ao criar funil.");
        return newFunnel;
    },

    // Copies
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string): Promise<Copy[]> {
        const conditions = [eq(schema.copies.userId, userId)];

        if (campaignId) {
            conditions.push(eq(schema.copies.campaignId, campaignId));
        }
        if (phase) {
            conditions.push(eq(schema.copies.launchPhase, phase as LaunchPhase));
        }
        if (purpose) {
            conditions.push(eq(schema.copies.purposeKey, purpose));
        }
        if (search) {
            conditions.push(or(
                ilike(schema.copies.title, `%${search}%`),
                ilike(schema.copies.content, `%${search}%`)
            ));
        }

        return await db.query.copies.findMany({
            where: and(...conditions),
            orderBy: [desc(schema.copies.createdAt)],
        });
    },
    async createCopy(copyData: InsertCopy): Promise<Copy> {
        const [newCopy] = await db.insert(schema.copies).values(copyData).returning();
        if (!newCopy) throw new Error("Falha ao criar cópia.");
        return newCopy;
    },
    async deleteCopy(id: number, userId: number): Promise<void> {
        await db.delete(schema.copies).where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId)));
    },

    // Landing Pages
    async getLandingPages(userId: number): Promise<LandingPage[]> {
        return await db.query.landingPages.findMany({ where: eq(schema.landingPages.userId, userId), orderBy: [desc(schema.landingPages.createdAt)] });
    },
    async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> {
        return await db.query.landingPages.findFirst({ where: eq(schema.landingPages.slug, slug) });
    },
    async getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined> {
        return await db.query.landingPages.findFirst({ where: and(eq(schema.landingPages.studioProjectId, studioProjectId), eq(schema.landingPages.userId, userId)) });
    },
    async createLandingPage(lpData: InsertLandingPage): Promise<LandingPage> {
        const [newLp] = await db.insert(schema.landingPages).values(lpData).returning();
        if (!newLp) throw new Error("Falha ao criar Landing Page.");
        return newLp;
    },
    async updateLandingPage(id: number, lpData: Partial<InsertLandingPage>, userId: number): Promise<LandingPage | undefined> {
        const [updatedLp] = await db.update(schema.landingPages).set(lpData).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId))).returning();
        return updatedLp;
    },
    async deleteLandingPage(id: number, userId: number): Promise<void> {
        await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId)));
    },
    
    // Budgets
    async getBudgets(userId: number): Promise<Budget[]> {
        return await db.query.budgets.findMany({ where: eq(schema.budgets.userId, userId), orderBy: [desc(schema.budgets.createdAt)] });
    },
    async createBudget(budgetData: InsertBudget): Promise<Budget> {
        const [newBudget] = await db.insert(schema.budgets).values(budgetData).returning();
        if (!newBudget) throw new Error("Falha ao criar orçamento.");
        return newBudget;
    },

    // Alerts
    async getAlerts(userId: number, unreadOnly: boolean = false): Promise<Alert[]> {
        const conditions = [eq(schema.alerts.userId, userId)];
        if (unreadOnly) conditions.push(eq(schema.alerts.isRead, false));
        return await db.query.alerts.findMany({ where: and(...conditions), orderBy: [desc(schema.alerts.createdAt)] });
    },
    async markAlertAsRead(id: number, userId: number): Promise<void> {
        await db.update(schema.alerts).set({ isRead: true }).where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId)));
    },

    // Flows
    async findTriggerFlow(userId: number, triggerKeyword: string): Promise<Flow | undefined> {
        const flows = await this.getFlows(userId);
        return flows.find(f => f.status === 'active' && f.name.toLowerCase().includes(triggerKeyword.toLowerCase()));
    },
    async getFlowUserState(userId: number, contactJid: string): Promise<WhatsappFlowUserState | undefined> {
        return await db.query.whatsappFlowUserStates.findFirst({
            where: and(eq(schema.whatsappFlowUserStates.userId, userId), eq(schema.whatsappFlowUserStates.contactJid, contactJid))
        });
    },
    async createFlowUserState(stateData: InsertFlowUserState): Promise<WhatsappFlowUserState> {
        const [newState] = await db.insert(schema.whatsappFlowUserStates).values(stateData).returning();
        if (!newState) throw new Error("Falha ao criar estado de usuário do fluxo.");
        return newState;
    },
    async updateFlowUserState(stateId: number, dataToUpdate: Partial<Omit<InsertFlowUserState, 'id'>>): Promise<WhatsappFlowUserState | undefined> {
        const [updatedState] = await db.update(schema.whatsappFlowUserStates).set(dataToUpdate).where(eq(schema.whatsappFlowUserStates.id, stateId)).returning();
        return updatedState;
    },
    async deleteFlowUserState(stateId: number): Promise<void> {
        await db.delete(schema.whatsappFlowUserStates).where(eq(schema.whatsappFlowUserStates.id, stateId));
    },
    async getFlow(id: number, userId: number): Promise<Flow | undefined> {
        return await db.query.flows.findFirst({ where: and(eq(schema.flows.id, id), eq(schema.flows.userId, userId)) });
    },
    async getFlows(userId: number, campaignId?: number | null): Promise<Flow[]> {
        const conditions = [eq(schema.flows.userId, userId)];
        if (campaignId !== undefined) {
            conditions.push(campaignId === null ? isNull(schema.flows.campaignId) : eq(schema.flows.campaignId, campaignId));
        }
        return await db.query.flows.findMany({ where: and(...conditions), orderBy: [desc(schema.flows.createdAt)] });
    },
    async createFlow(flowData: InsertFlow): Promise<Flow> {
        const [newFlow] = await db.insert(schema.flows).values(flowData).returning();
        if (!newFlow) throw new Error("Falha ao criar fluxo.");
        return newFlow;
    },
    async updateFlow(id: number, flowData: Partial<InsertFlow>, userId: number): Promise<Flow | undefined> {
        const [updatedFlow] = await db.update(schema.flows).set({ ...flowData, updatedAt: new Date() }).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId))).returning();
        return updatedFlow;
    },
    async deleteFlow(id: number, userId: number): Promise<void> {
        await db.delete(schema.flows).where(and(eq(schema.flows.id, id), eq(schema.flows.userId, userId)));
    },

    // WhatsApp
    async getContacts(userId: number): Promise<any[]> {
        return await db.selectDistinctOn([schema.whatsappMessages.contactNumber], {
            contactNumber: schema.whatsappMessages.contactNumber,
            contactName: schema.whatsappMessages.contactName,
            lastMessage: schema.whatsappMessages.message,
            timestamp: schema.whatsappMessages.timestamp
        }).from(schema.whatsappMessages)
          .where(eq(schema.whatsappMessages.userId, userId))
          .orderBy(desc(schema.whatsappMessages.timestamp));
    },
    async getMessages(userId: number, contactNumber: string): Promise<WhatsappMessage[]> {
        return await db.query.whatsappMessages.findMany({
            where: and(eq(schema.whatsappMessages.userId, userId), eq(schema.whatsappMessages.contactNumber, contactNumber)),
            orderBy: [desc(schema.whatsappMessages.timestamp)]
        });
    },
    async createMessage(messageData: InsertWhatsappMessage): Promise<WhatsappMessage> {
        const [newMessage] = await db.insert(schema.whatsappMessages).values(messageData).returning();
        if (!newMessage) throw new Error("Falha ao salvar mensagem.");
        return newMessage;
    },
    async getWhatsappTemplates(userId: number): Promise<WhatsappMessageTemplate[]> {
        return await db.query.whatsappMessageTemplates.findMany({ where: eq(schema.whatsappMessageTemplates.userId, userId) });
    },
    async createWhatsappTemplate(templateData: InsertWhatsappMessageTemplate): Promise<WhatsappMessageTemplate> {
        const [newTemplate] = await db.insert(schema.whatsappMessageTemplates).values(templateData).returning();
        if (!newTemplate) throw new Error("Falha ao criar template.");
        return newTemplate;
    },
    async updateWhatsappTemplate(id: number, templateData: Partial<InsertWhatsappMessageTemplate>, userId: number): Promise<WhatsappMessageTemplate | undefined> {
        const [updatedTemplate] = await db.update(schema.whatsappMessageTemplates).set(templateData).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))).returning();
        return updatedTemplate;
    },
    async deleteWhatsappTemplate(id: number, userId: number): Promise<boolean> {
        const result = await db.delete(schema.whatsappMessageTemplates).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))).returning({id: schema.whatsappMessageTemplates.id});
        return result.length > 0;
    },
    
    // Chat / MCP
    async getChatSessions(userId: number): Promise<ChatSession[]> {
        return await db.query.chatSessions.findMany({ where: eq(schema.chatSessions.userId, userId), orderBy: [desc(schema.chatSessions.updatedAt)] });
    },
    async createChatSession(userId: number, title?: string | null): Promise<ChatSession> {
        const [newSession] = await db.insert(schema.chatSessions).values({ userId, title: title || 'Nova Conversa' }).returning();
        if (!newSession) throw new Error("Falha ao criar sessão de chat.");
        return newSession;
    },
    async getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]> {
        return await db.select().from(schema.chatMessages).where(and(eq(schema.chatMessages.sessionId, sessionId), eq(schema.chatMessages.userId, userId))).orderBy(schema.chatMessages.createdAt);
    },
    async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
        const [newMessage] = await db.insert(schema.chatMessages).values(messageData).returning();
        if (!newMessage) throw new Error("Falha ao adicionar mensagem no chat.");
        return newMessage;
    },
    async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<ChatSession | undefined> {
        const [updatedSession] = await db.update(schema.chatSessions).set({ title: newTitle, updatedAt: new Date() }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning();
        return updatedSession;
    },
    async deleteChatSession(sessionId: number, userId: number): Promise<void> {
        await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)));
    }
};
