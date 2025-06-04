// server/storage.ts
import { eq, and, or, isNull, desc, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from './db';
import {
  users, // Corrigido: usersTable -> users
  campaigns, // Corrigido: campaignsTable -> campaigns
  creatives, // Corrigido: creativesTable -> creatives
  metrics, // Corrigido: metricsTable -> metrics (se existir, senão remover)
  budgets, // Corrigido: budgetsTable -> budgets
  alerts, // Corrigido: alertsTable -> alerts (se existir, senão remover)
  copies, // Corrigido: copiesTable -> copies
  chatSessions, // Corrigido: chatSessionsTable -> chatSessions
  chatMessages, // Corrigido: chatMessagesTable -> chatMessages
  landingPages, // Corrigido: landingPagesTable -> landingPages
  funnels, // Corrigido: funnelsTable -> funnels
  funnelStages, // Corrigido: funnelStagesTable -> funnelStages
  flows, // Corrigido: flowsTable -> flows
  // Zod schemas são importados separadamente ou via * em routes.ts
} from '../shared/schema';
import bcrypt from 'bcrypt';

// Tipos inferidos para Drizzle (usar diretamente ou como base para interfaces)
type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users>;

type Campaign = InferSelectModel<typeof campaigns>;
type NewCampaign = InferInsertModel<typeof campaigns>;

type Creative = InferSelectModel<typeof creatives>;
type NewCreative = InferInsertModel<typeof creatives>;

type Budget = InferSelectModel<typeof budgets>;
type NewBudget = InferInsertModel<typeof budgets>;

type Copy = InferSelectModel<typeof copies>;
type NewCopy = InferInsertModel<typeof copies>;

type ChatSession = InferSelectModel<typeof chatSessions>;
type NewChatSession = InferInsertModel<typeof chatSessions>;
type ChatMessage = InferSelectModel<typeof chatMessages>;
type NewChatMessage = InferInsertModel<typeof chatMessages>;

type LandingPage = InferSelectModel<typeof landingPages>;
type NewLandingPage = InferInsertModel<typeof landingPages>;

type Flow = InferSelectModel<typeof flows>; // Usaremos este como FlowData
type NewFlow = InferInsertModel<typeof flows>;


interface IStorage {
  // User methods
  createUser(userData: NewUser): Promise<User | null>;
  getUser(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  validatePassword(email: string, pass: string): Promise<User | null>;
  
  // Flow Methods
  createFlow(userId: number, flowData: Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Flow | null>;
  getFlows(userId: number, campaignIdParam?: string | null): Promise<Flow[]>;
  getFlowById(userId: number, flowId: number): Promise<Flow | null>;
  updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Flow | null>;
  deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }>;

  // Campaign Methods
  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaignById(userId: number, campaignId: number): Promise<Campaign | null>;
  createCampaign(userId: number, campaignData: Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign | null>;
  updateCampaign(userId: number, campaignId: number, campaignData: Partial<Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null>;
  deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }>;

  // Creative Methods
  getCreatives(userId: number, campaignId?: number): Promise<Creative[]>;
  createCreative(userId: number, creativeData: Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Creative | null>;
  updateCreative(userId: number, creativeId: number, creativeData: Partial<Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Creative | null>;
  deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }>;

  // Budget Methods
  getBudgets(userId: number, campaignId?: number): Promise<Budget[]>;
  createBudget(userId: number, budgetData: Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget | null>;
  updateBudget(userId: number, budgetId: number, budgetData: Partial<Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Budget | null>;
  deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }>;

  // Copy Methods
  createCopy(userId: number, copyData: Omit<NewCopy, 'userId' | 'id' | 'createdAt'>): Promise<Copy | null>;
  getCopies(userId: number, campaignId?: number): Promise<Copy[]>;
  updateCopy(userId: number, copyId: number, copyData: Partial<Omit<NewCopy, 'userId' | 'id' | 'createdAt'>>): Promise<Copy | null>;
  deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }>;
  
  // Dashboard
  getDashboardData(userId: number): Promise<any>;

  // Landing Page Methods
  createLandingPage(userId: number, pageData: Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'publicUrl'>): Promise<LandingPage | null>;
  getLandingPages(userId: number): Promise<LandingPage[]>;
  getLandingPageById(userId: number, pageId: number): Promise<LandingPage | null>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | null>;
  getLandingPageByStudioProjectId(studioProjectId: string): Promise<LandingPage | null>;
  updateLandingPage(userId: number, pageId: number, pageData: Partial<Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<LandingPage | null>;
  deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }>;

  // Chat MCP Methods
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
    const result = await db.insert(users).values({ ...userData, password: hashedPassword }).returning();
    return result[0] || null;
  }

  async getUser(email: string): Promise<User | null> {
    return await db.query.users.findFirst({ where: eq(users.email, email) }) || null;
  }

  async getUserById(id: number): Promise<User | null> {
    return await db.query.users.findFirst({ where: eq(users.id, id) }) || null;
  }

  async validatePassword(email: string, pass: string): Promise<User | null> {
    const userRecord = await this.getUser(email); // Renomeado para userRecord para evitar conflito com a tabela 'users'
    if (!userRecord || !userRecord.password) return null;
    const isValid = await bcrypt.compare(pass, userRecord.password);
    return isValid ? userRecord : null;
  }

  // --- Flow Methods ---
  async createFlow(userId: number, flowData: Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Flow | null> {
    const result = await db.insert(flows).values({ ...flowData, userId }).returning();
    return result[0] || null;
  }

  async getFlows(userId: number, campaignIdParam?: string | null): Promise<Flow[]> {
    const conditions = [eq(flows.userId, userId)];
    if (campaignIdParam) {
      if (campaignIdParam === 'null' || campaignIdParam === '') { // Trata string 'null' ou vazia como ID de campanha nulo
        conditions.push(isNull(flows.campaignId));
      } else {
        const numericCampaignId = parseInt(campaignIdParam, 10);
        if (!isNaN(numericCampaignId)) {
          conditions.push(eq(flows.campaignId, numericCampaignId));
        }
        // Se não for 'null' nem numérico, pode optar por ignorar ou lançar erro
      }
    }
    return db.query.flows.findMany({
      where: and(...conditions),
      orderBy: [desc(flows.updatedAt)],
    });
  }

  async getFlowById(userId: number, flowId: number): Promise<Flow | null> {
    return await db.query.flows.findFirst({
      where: and(eq(flows.id, flowId), eq(flows.userId, userId)),
    }) || null;
  }

  async updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Flow | null> {
    const dataToUpdate = { ...flowData, updatedAt: new Date() };
    const result = await db.update(flows)
      .set(dataToUpdate)
      .where(and(eq(flows.id, flowId), eq(flows.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }> {
    const result = await db.delete(flows)
      .where(and(eq(flows.id, flowId), eq(flows.userId, userId)))
      .returning({ id: flows.id });
    if (result.length > 0) {
      return { success: true };
    }
    return { success: false, message: "Fluxo não encontrado ou usuário não autorizado." };
  }

  // --- Campaign Methods ---
  async getCampaigns(userId: number): Promise<Campaign[]> {
    return db.query.campaigns.findMany({
      where: eq(campaigns.userId, userId),
      orderBy: [desc(campaigns.updatedAt)],
    });
  }

  async getCampaignById(userId: number, campaignId: number): Promise<Campaign | null> {
    return db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    }) || null;
  }

  async createCampaign(userId: number, campaignData: Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign | null> {
    const result = await db.insert(campaigns).values({ ...campaignData, userId }).returning();
    return result[0] || null;
  }

  async updateCampaign(userId: number, campaignId: number, campaignData: Partial<Omit<NewCampaign, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null> {
    const result = await db.update(campaigns)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }> {
    const result = await db.delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .returning({ id: campaigns.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Creative Methods ---
  async getCreatives(userId: number, campaignId?: number): Promise<Creative[]> {
    const conditions = [eq(creatives.userId, userId)];
    if (campaignId) {
      conditions.push(eq(creatives.campaignId, campaignId));
    }
    return db.query.creatives.findMany({
      where: and(...conditions),
      orderBy: [desc(creatives.updatedAt)],
    });
  }
  async createCreative(userId: number, creativeData: Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Creative | null> {
    const result = await db.insert(creatives).values({ ...creativeData, userId }).returning();
    return result[0] || null;
  }
  async updateCreative(userId: number, creativeId: number, creativeData: Partial<Omit<NewCreative, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Creative | null> {
    const result = await db.update(creatives)
      .set({ ...creativeData, updatedAt: new Date() })
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }> {
    const result = await db.delete(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .returning({ id: creatives.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Budget Methods ---
  async getBudgets(userId: number, campaignId?: number): Promise<Budget[]> {
    const conditions = [eq(budgets.userId, userId)];
    if (campaignId) {
      conditions.push(eq(budgets.campaignId, campaignId));
    }
    return db.query.budgets.findMany({ where: and(...conditions) });
  }
  async createBudget(userId: number, budgetData: Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget | null> {
    const result = await db.insert(budgets).values({ ...budgetData, userId }).returning();
    return result[0] || null;
  }
  async updateBudget(userId: number, budgetId: number, budgetData: Partial<Omit<NewBudget, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Budget | null> {
    const result = await db.update(budgets)
      .set(budgetData) // updatedAt é opcional para orçamentos, pode ser atualizado explicitamente se necessário
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }> {
    const result = await db.delete(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
  
  // --- Copy Methods ---
  async createCopy(userId: number, copyData: Omit<NewCopy, 'userId' | 'id' | 'createdAt'>): Promise<Copy | null> {
    const result = await db.insert(copies).values({ ...copyData, userId }).returning();
    return result[0] || null;
  }
  async getCopies(userId: number, campaignId?: number): Promise<Copy[]> {
    const conditions = [eq(copies.userId, userId)];
    if (campaignId) {
      conditions.push(eq(copies.campaignId, campaignId));
    }
    return db.query.copies.findMany({ where: and(...conditions) });
  }
  async updateCopy(userId: number, copyId: number, copyData: Partial<Omit<NewCopy, 'userId' | 'id' | 'createdAt'>>): Promise<Copy | null> {
    const result = await db.update(copies)
      .set(copyData) // Assumindo que 'updatedAt' não é gerenciado aqui, mas pelo DB ou schema
      .where(and(eq(copies.id, copyId), eq(copies.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }> {
    const result = await db.delete(copies)
      .where(and(eq(copies.id, copyId), eq(copies.userId, userId)))
      .returning({ id: copies.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Dashboard Data ---
  async getDashboardData(userId: number): Promise<any> {
    const activeCampaignsResult = await db.query.campaigns.findMany({
      where: and(eq(campaigns.userId, userId), eq(campaigns.status, 'active'))
    });
    const recentCampaignsResult = await db.query.campaigns.findMany({
        where: eq(campaigns.userId, userId),
        orderBy: [desc(campaigns.createdAt)],
        limit: 5,
    });
    // Adicionar mais lógicas de agregação conforme necessário
    return {
      metrics: {
        activeCampaigns: activeCampaignsResult.length,
        totalSpent: 0, // TODO: Calcular
        totalCostPeriod: 0, // TODO: Calcular
        conversions: 0, // TODO: Calcular
        avgROI: 0, // TODO: Calcular
        impressions: 0, // TODO: Calcular
        clicks: 0, // TODO: Calcular
        ctr: 0, // TODO: Calcular
        cpc: 0, // TODO: Calcular
      },
      recentCampaigns: recentCampaignsResult,
      performanceChartData: { labels: [], datasets: [] }, 
      channelDistributionData: { labels: [], datasets: [] },
      conversionByMonthData: { labels: [], datasets: [] },
      roiByPlatformData: { labels: [], datasets: [] },
    };
  }
  // --- Landing Page Methods ---
  async createLandingPage(userId: number, pageData: Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'publicUrl'>): Promise<LandingPage | null> {
    const result = await db.insert(landingPages).values({ ...pageData, userId }).returning();
    return result[0] || null;
  }

  async getLandingPages(userId: number): Promise<LandingPage[]> {
    return db.query.landingPages.findMany({
      where: eq(landingPages.userId, userId),
      orderBy: [desc(landingPages.updatedAt)],
    });
  }

  async getLandingPageById(userId: number, pageId: number): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({
      where: and(eq(landingPages.id, pageId), eq(landingPages.userId, userId)),
    }) || null;
  }

  async getLandingPageBySlug(slug: string): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({
      where: eq(landingPages.slug, slug),
    }) || null;
  }
  
  async getLandingPageByStudioProjectId(studioProjectId: string): Promise<LandingPage | null> {
    return db.query.landingPages.findFirst({
        where: eq(landingPages.studioProjectId, studioProjectId),
    }) || null;
  }

  async updateLandingPage(userId: number, pageId: number, pageData: Partial<Omit<NewLandingPage, 'userId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<LandingPage | null> {
    const result = await db.update(landingPages)
      .set({ ...pageData, updatedAt: new Date() })
      .where(and(eq(landingPages.id, pageId), eq(landingPages.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }> {
    const result = await db.delete(landingPages)
      .where(and(eq(landingPages.id, pageId), eq(landingPages.userId, userId)))
      .returning({ id: landingPages.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // Chat MCP Methods
  async createChatSession(userId: number, title: string): Promise<ChatSession | null> {
    const result = await db.insert(chatSessions).values({ userId, title }).returning();
    return result[0] || null;
  }

  async getChatSessions(userId: number): Promise<ChatSession[]> {
    return db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, userId),
      orderBy: [desc(chatSessions.updatedAt)],
    });
  }

  async getChatSessionById(userId: number, sessionId: number): Promise<ChatSession & { messages: ChatMessage[] } | null> {
    return db.query.chatSessions.findFirst({
      where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      with: {
        messages: {
          orderBy: (msgs, { asc }) => [asc(msgs.timestamp)], // Corrigido para 'msgs'
        },
      },
    }) || null;
  }

  async addChatMessage(sessionId: number, sender: 'user' | 'mcp' | 'system', text: string, attachmentUrl?: string | null): Promise<ChatMessage | null> {
    const result = await db.insert(chatMessages).values({ sessionId, sender, text, attachmentUrl }).returning();
    await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
    return result[0] || null;
  }

  async updateChatSessionTitle(userId: number, sessionId: number, newTitle: string): Promise<ChatSession | null> {
    const result = await db.update(chatSessions)
      .set({ title: newTitle, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteChatSession(userId: number, sessionId: number): Promise<{ success: boolean }> {
    const result = await db.delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning({ id: chatSessions.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
}

export const storage: IStorage = new DatabaseStorage();
