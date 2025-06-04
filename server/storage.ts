// server/storage.ts
import { eq, and, or, isNull, desc, sum, count, avg } from 'drizzle-orm';
import { db } from './db';
import * as schema from '../shared/schema'; 
import bcrypt from 'bcrypt';

// Tipos inferidos para Drizzle usando o namespace 'schema'
type User = InferSelectModel<typeof schema.users>;
type NewUser = InferInsertModel<typeof schema.users>;

type Campaign = InferSelectModel<typeof schema.campaigns>;
type NewCampaign = InferInsertModel<typeof schema.campaigns>;

type Creative = InferSelectModel<typeof schema.creatives>;
type NewCreative = InferInsertModel<typeof schema.creatives>;

type Budget = InferSelectModel<typeof schema.budgets>;
type NewBudget = InferInsertModel<typeof schema.budgets>;

type Copy = InferSelectModel<typeof schema.copies>;
type NewCopy = InferInsertModel<typeof schema.copies>;

type ChatSession = InferSelectModel<typeof schema.chatSessions>;
type ChatMessage = InferSelectModel<typeof schema.chatMessages>;

type LandingPage = InferSelectModel<typeof schema.landingPages>;
type NewLandingPage = InferInsertModel<typeof schema.landingPages>;

type Flow = InferSelectModel<typeof schema.flowsTable>; 
type NewFlow = InferInsertModel<typeof schema.flowsTable>;

// type Metric = InferSelectModel<typeof schema.metrics>; // Não usado diretamente aqui


interface IStorage {
  createUser(userData: NewUser): Promise<User | null>;
  getUser(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  validatePassword(email: string, pass: string): Promise<User | null>;
  
  createFlow(userId: number, flowData: Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Flow | null>;
  getFlows(userId: number, campaignIdParam?: string | null): Promise<Flow[]>;
  getFlowById(userId: number, flowId: number): Promise<Flow | null>;
  updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'elements'>> & { elements?: any }): Promise<Flow | null>;
  deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }>;

  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaignById(userId: number, campaignId: number): Promise<Campaign | null>;
  createCampaign(userId: number, campaignData: Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign | null>;
  updateCampaign(userId: number, campaignId: number, campaignData: Partial<Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null>;
  deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }>;

  getCreatives(userId: number, campaignId?: number): Promise<Creative[]>;
  getCreativeById(userId: number, creativeId: number): Promise<Creative | null>;
  createCreative(userId: number, creativeData: Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Creative | null>;
  updateCreative(userId: number, creativeId: number, creativeData: Partial<Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Creative | null>;
  deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }>;

  getBudgets(userId: number, campaignId?: number): Promise<Budget[]>;
  createBudget(userId: number, budgetData: Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget | null>;
  updateBudget(userId: number, budgetId: number, budgetData: Partial<Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Budget | null>;
  deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }>;

  createCopy(userId: number, copyData: Omit<NewCopy, 'userId' | 'id' | 'createdAt'>): Promise<Copy | null>;
  getCopies(userId: number, campaignId?: number): Promise<Copy[]>;
  updateCopy(userId: number, copyId: number, copyData: Partial<Omit<NewCopy, 'userId' | 'id' | 'createdAt'>>): Promise<Copy | null>;
  deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }>;
  
  getDashboardData(userId: number, timeRange?: string): Promise<any>;

  createLandingPage(userId: number, pageData: Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'publicUrl'>): Promise<LandingPage | null>;
  getLandingPages(userId: number): Promise<LandingPage[]>;
  getLandingPageById(userId: number, pageId: number): Promise<LandingPage | null>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | null>;
  getLandingPageByStudioProjectId(studioProjectId: string): Promise<LandingPage | null>;
  updateLandingPage(userId: number, pageId: number, pageData: Partial<Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<LandingPage | null>;
  deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }>;

  createChatSession(userId: number, title: string): Promise<ChatSession | null>;
  getChatSessions(userId: number): Promise<ChatSession[]>;
  getChatSessionById(userId: number, sessionId: number): Promise<ChatSession & { messages: ChatMessage[] } | null>;
  addChatMessage(sessionId: number, sender: 'user' | 'mcp' | 'system', text: string, attachmentUrl?: string | null): Promise<ChatMessage | null>;
  updateChatSessionTitle(userId: number, sessionId: number, newTitle: string): Promise<ChatSession | null>;
  deleteChatSession(userId: number, sessionId: number): Promise<{ success: boolean }>;
}


export class DatabaseStorage implements IStorage {
  async createUser(userData: NewUser): Promise<User | null> {
    if (!userData.email || !userData.password || !userData.username) {
      throw new Error("Email, username, and password are required");
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const result = await db.insert(schema.users).values({ ...userData, password: hashedPassword }).returning();
    return result[0] || null;
  }

  async getUser(email: string): Promise<User | null> {
    return await db.query.users.findFirst({ where: eq(schema.users.email, email) }) || null;
  }

  async getUserById(id: number): Promise<User | null> {
    return await db.query.users.findFirst({ where: eq(schema.users.id, id) }) || null;
  }

  async validatePassword(email: string, pass: string): Promise<User | null> {
    const userRecord = await this.getUser(email);
    if (!userRecord || !userRecord.password) return null;
    const isValid = await bcrypt.compare(pass, userRecord.password);
    return isValid ? userRecord : null;
  }

  async createFlow(userId: number, flowData: Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Flow | null> {
    const result = await db.insert(schema.flowsTable).values({ ...flowData, userId }).returning();
    return result[0] || null;
  }

  async getFlows(userId: number, campaignIdParam?: string | null): Promise<Flow[]> {
    const conditions = [eq(schema.flowsTable.userId, userId)];
    if (campaignIdParam) {
      if (campaignIdParam === 'null' || campaignIdParam === '') {
        conditions.push(isNull(schema.flowsTable.campaignId));
      } else {
        const numericCampaignId = parseInt(campaignIdParam, 10);
        if (!isNaN(numericCampaignId)) {
          conditions.push(eq(schema.flowsTable.campaignId, numericCampaignId));
        }
      }
    }
    return db.query.flowsTable.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.flowsTable.updatedAt)],
    });
  }

  async getFlowById(userId: number, flowId: number): Promise<Flow | null> {
    return await db.query.flowsTable.findFirst({
      where: and(eq(schema.flowsTable.id, flowId), eq(schema.flowsTable.userId, userId)),
    }) || null;
  }

  async updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'elements'>> & { elements?: any }): Promise<Flow | null> {
    const dataToUpdate: Partial<NewFlow> & { updatedAt: Date } = { ...flowData, updatedAt: new Date() };
    if (flowData.elements) {
        dataToUpdate.elements = flowData.elements;
    }
    const result = await db.update(schema.flowsTable)
      .set(dataToUpdate)
      .where(and(eq(schema.flowsTable.id, flowId), eq(schema.flowsTable.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }> {
    const result = await db.delete(schema.flowsTable)
      .where(and(eq(schema.flowsTable.id, flowId), eq(schema.flowsTable.userId, userId)))
      .returning({ id: schema.flowsTable.id });
    if (result.length > 0) {
      return { success: true };
    }
    return { success: false, message: "Fluxo não encontrado ou usuário não autorizado." };
  }

  async getCampaigns(userId: number): Promise<Campaign[]> {
    return db.query.campaigns.findMany({ where: eq(schema.campaigns.userId, userId), orderBy: [desc(schema.campaigns.updatedAt)], });
  }
  async getCampaignById(userId: number, campaignId: number): Promise<Campaign | null> {
    return db.query.campaigns.findFirst({ where: and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, userId)), }) || null;
  }
  async createCampaign(userId: number, campaignData: Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign | null> {
    const result = await db.insert(schema.campaigns).values({ ...campaignData, userId }).returning();
    return result[0] || null;
  }
  async updateCampaign(userId: number, campaignId: number, campaignData: Partial<Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null> {
    const result = await db.update(schema.campaigns).set({ ...campaignData, updatedAt: new Date() }).where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.campaigns).where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, userId))).returning({ id: schema.campaigns.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  async getCreatives(userId: number, campaignId?: number): Promise<Creative[]> {
    const conditions = [eq(schema.creatives.userId, userId)];
    if (campaignId) conditions.push(eq(schema.creatives.campaignId, campaignId));
    return db.query.creatives.findMany({ where: and(...conditions), orderBy: [desc(schema.creatives.updatedAt)], });
  }
   async getCreativeById(userId: number, creativeId: number): Promise<Creative | null> {
    return db.query.creatives.findFirst({ where: and(eq(schema.creatives.id, creativeId), eq(schema.creatives.userId, userId)) }) || null;
  }
  async createCreative(userId: number, creativeData: Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Creative | null> {
    const result = await db.insert(schema.creatives).values({ ...creativeData, userId }).returning();
    return result[0] || null;
  }
  async updateCreative(userId: number, creativeId: number, creativeData: Partial<Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Creative | null> {
    const result = await db.update(schema.creatives).set({ ...creativeData, updatedAt: new Date() }).where(and(eq(schema.creatives.id, creativeId), eq(schema.creatives.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.creatives).where(and(eq(schema.creatives.id, creativeId), eq(schema.creatives.userId, userId))).returning({ id: schema.creatives.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  async getBudgets(userId: number, campaignId?: number): Promise<Budget[]> {
    const conditions = [eq(schema.budgets.userId, userId)];
    if (campaignId) conditions.push(eq(schema.budgets.campaignId, campaignId));
    return db.query.budgets.findMany({ where: and(...conditions), orderBy: [desc(schema.budgets.createdAt)] });
  }
  async createBudget(userId: number, budgetData: Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget | null> {
    const result = await db.insert(schema.budgets).values({ ...budgetData, userId }).returning();
    return result[0] || null;
  }
  async updateBudget(userId: number, budgetId: number, budgetData: Partial<Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Budget | null> {
    const result = await db.update(schema.budgets).set({ ...budgetData, updatedAt: new Date() }).where(and(eq(schema.budgets.id, budgetId), eq(schema.budgets.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.budgets).where(and(eq(schema.budgets.id, budgetId), eq(schema.budgets.userId, userId))).returning({ id: schema.budgets.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
  
  async createCopy(userId: number, copyData: Omit<NewCopy, 'userId' | 'id' | 'createdAt'>): Promise<Copy | null> {
    const result = await db.insert(schema.copies).values({ ...copyData, userId }).returning();
    return result[0] || null;
  }
  async getCopies(userId: number, campaignId?: number): Promise<Copy[]> {
    const conditions = [eq(schema.copies.userId, userId)];
    if (campaignId) conditions.push(eq(schema.copies.campaignId, campaignId));
    return db.query.copies.findMany({ where: and(...conditions), orderBy: [desc(schema.copies.createdAt)] });
  }
  async updateCopy(userId: number, copyId: number, copyData: Partial<Omit<NewCopy, 'userId' | 'id' | 'createdAt'>>): Promise<Copy | null> {
    const result = await db.update(schema.copies).set(copyData) .where(and(eq(schema.copies.id, copyId), eq(schema.copies.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.copies).where(and(eq(schema.copies.id, copyId), eq(schema.copies.userId, userId))).returning({ id: schema.copies.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
  
  async getDashboardData(userId: number, timeRange?: string): Promise<any> {
    const activeCampaignsResult = await db.select({value: count()})
        .from(schema.campaigns)
        .where(and(eq(schema.campaigns.userId, userId), eq(schema.campaigns.status, 'active')));
    
    const metricsAggregated = await db
        .select({
            totalSpent: sum(schema.metrics.cost).mapWith(Number),
            totalConversions: sum(schema.metrics.conversions).mapWith(Number),
            totalImpressions: sum(schema.metrics.impressions).mapWith(Number),
            totalClicks: sum(schema.metrics.clicks).mapWith(Number),
            totalRevenue: sum(schema.metrics.revenue).mapWith(Number), // Adicionado
        })
        .from(schema.metrics)
        .where(eq(schema.metrics.userId, userId)); // Idealmente filtrar por timeRange aqui também

    const agg = metricsAggregated[0] || { 
        totalSpent: 0, totalConversions: 0, totalImpressions: 0, totalClicks: 0, totalRevenue: 0
    };

    const totalSpent = agg.totalSpent || 0;
    const totalRevenue = agg.totalRevenue || 0;
    const totalConversions = agg.totalConversions || 0;
    
    let avgROI = 0;
    if (totalSpent > 0) {
        avgROI = ((totalRevenue - totalSpent) / totalSpent) * 100;
    } else if (totalRevenue > 0) {
        avgROI = 100; // Ou Infinity, ou tratar como N/A
    }

    let ctr = 0;
    if ((agg.totalImpressions || 0) > 0) {
        ctr = ((agg.totalClicks || 0) / (agg.totalImpressions || 0)) * 100;
    }

    let cpc = 0;
    if ((agg.totalClicks || 0) > 0) {
        cpc = (totalSpent) / (agg.totalClicks || 0);
    }
    
    const recentCampaignsResult = await db.query.campaigns.findMany({
        where: eq(schema.campaigns.userId, userId),
        orderBy: [desc(schema.campaigns.createdAt)],
        limit: 5,
    });
    
    // Sempre retornar a estrutura completa esperada pelo frontend
    const metricsResponse = {
        activeCampaigns: activeCampaignsResult[0]?.value || 0,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        totalCostPeriod: parseFloat(totalSpent.toFixed(2)), // Simplificado por agora
        conversions: totalConversions,
        avgROI: parseFloat(avgROI.toFixed(2)),
        impressions: agg.totalImpressions || 0,
        clicks: agg.totalClicks || 0,
        ctr: parseFloat(ctr.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        leads: await db.select({value: sum(schema.metrics.leads).mapWith(Number)}).from(schema.metrics).where(eq(schema.metrics.userId, userId)).then(r => r[0]?.value || 0),
        campaignsChange: 0, // Placeholder, necessita lógica de período anterior
        budgetChange: 0,    // Placeholder
        conversionsChange: 0, // Placeholder
        roiChange: 0,       // Placeholder
    };

    const summaryResponse = {
        totalSpent: metricsResponse.totalSpent,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalConversions: metricsResponse.conversions,
        avgROI: metricsResponse.avgROI,
      };
    
    return {
      metrics: metricsResponse,
      summary: summaryResponse,
      recentCampaigns: recentCampaignsResult,
      performanceChartData: { labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"], datasets: [{ label: "Conversões", data: [5,8,12,10], tension: 0.3, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)' }] }, 
      channelDistributionData: { labels: ["Facebook", "Google", "Instagram"], datasets: [{ data: [120, 180, 90], backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'] }] },
      conversionByMonthData: { labels: ["Jan", "Fev", "Mar"], datasets: [{ label: "Conversões Totais", data: [20,30,25], backgroundColor: '#4bc0c0' }]},
      roiByPlatformData: { labels: ["Facebook", "Google"], datasets: [{ label: "ROI (%)", data: [180, 210], backgroundColor: ['#FFB300', '#0D47A1'] }]},
    };
  }

  async createLandingPage(userId: number, pageData: Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'publicUrl'>): Promise<LandingPage | null> {
    const result = await db.insert(schema.landingPages).values({ ...pageData, userId }).returning();
    return result[0] || null;
  }
  async getLandingPages(userId: number): Promise<LandingPage[]> {
    return db.query.landingPages.findMany({ where: eq(schema.landingPages.userId, userId), orderBy: [desc(schema.landingPages.updatedAt)], });
  }
  async getLandingPageById(userId: number, pageId: number): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({ where: and(eq(schema.landingPages.id, pageId), eq(schema.landingPages.userId, userId)), }) || null;
  }
  async getLandingPageBySlug(slug: string): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({ where: eq(schema.landingPages.slug, slug), }) || null;
  }
  async getLandingPageByStudioProjectId(studioProjectId: string): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({ where: eq(schema.landingPages.studioProjectId, studioProjectId), }) || null;
  }
  async updateLandingPage(userId: number, pageId: number, pageData: Partial<Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<LandingPage | null> {
    const result = await db.update(schema.landingPages).set({ ...pageData, updatedAt: new Date() }).where(and(eq(schema.landingPages.id, pageId), eq(schema.landingPages.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.landingPages).where(and(eq(schema.landingPages.id, pageId), eq(schema.landingPages.userId, userId))).returning({ id: schema.landingPages.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  async createChatSession(userId: number, title: string): Promise<ChatSession | null> {
    const result = await db.insert(schema.chatSessions).values({ userId, title }).returning();
    return result[0] || null;
  }
  async getChatSessions(userId: number): Promise<ChatSession[]> {
    return db.query.chatSessions.findMany({ where: eq(schema.chatSessions.userId, userId), orderBy: [desc(schema.chatSessions.updatedAt)], });
  }
  async getChatSessionById(userId: number, sessionId: number): Promise<ChatSession & { messages: ChatMessage[] } | null> {
    return db.query.chatSessions.findFirst({ where: and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)), with: { messages: { orderBy: (msgs, { asc }) => [asc(msgs.timestamp)], }, }, }) || null;
  }
  async addChatMessage(sessionId: number, sender: 'user' | 'mcp' | 'system', text: string, attachmentUrl?: string | null): Promise<ChatMessage | null> {
    const result = await db.insert(schema.chatMessages).values({ sessionId, sender, text, attachmentUrl }).returning();
    await db.update(schema.chatSessions).set({ updatedAt: new Date() }).where(eq(schema.chatSessions.id, sessionId));
    return result[0] || null;
  }
  async updateChatSessionTitle(userId: number, sessionId: number, newTitle: string): Promise<ChatSession | null> {
    const result = await db.update(schema.chatSessions).set({ title: newTitle, updatedAt: new Date() }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning();
    return result[0] || null;
  }
  async deleteChatSession(userId: number, sessionId: number): Promise<{ success: boolean }> {
    const result = await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning({ id: schema.chatSessions.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
}

export const storage: IStorage = new DatabaseStorage();
