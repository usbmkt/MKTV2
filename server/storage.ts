// server/storage.ts
import { eq, and, or, isNull, desc, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from './db';
import {
  usersTable,
  campaignsTable,
  creativesTable,
  metricsTable,
  budgetsTable,
  alertsTable,
  copiesTable,
  chatSessionsTable,
  chatMessagesTable,
  landingPagesTable,
  funnelsTable,
  funnelStagesTable,
  flowsTable, // Adicionado para clareza, já deveria estar importado por '*' em db
  NewFlow, // Assumindo que NewFlow é o tipo de inserção (InferInsertModel<typeof flowsTable>)
  FlowData // Assumindo que FlowData é o tipo de seleção (InferSelectModel<typeof flowsTable>)
} from '../shared/schema';
import bcrypt from 'bcrypt';

// Tipos inferidos para garantir consistência (ajuste os nomes se necessário)
// type FlowData = InferSelectModel<typeof flowsTable>; // Já definido acima
// type NewFlow = InferInsertModel<typeof flowsTable>; // Já definido acima


// Interface IStorage (simplificada para o contexto, mantenha a sua completa)
interface IStorage {
  // ... outras assinaturas de métodos ...
  createUser(userData: InferInsertModel<typeof usersTable>): Promise<InferSelectModel<typeof usersTable> | null>;
  getUser(email: string): Promise<InferSelectModel<typeof usersTable> | null>;
  getUserById(id: number): Promise<InferSelectModel<typeof usersTable> | null>;
  validatePassword(email: string, pass: string): Promise<InferSelectModel<typeof usersTable> | null>;
  
  createFlow(userId: number, flowData: NewFlow): Promise<FlowData | null>;
  getFlows(userId: number, campaignIdParam?: string | null): Promise<FlowData[]>;
  getFlowById(userId: number, flowId: number): Promise<FlowData | null>;
  updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id'>>): Promise<FlowData | null>;
  deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }>;

  getCampaigns(userId: number): Promise<InferSelectModel<typeof campaignsTable>[]>;
  getCampaignById(userId: number, campaignId: number): Promise<InferSelectModel<typeof campaignsTable> | null>;
  createCampaign(userId: number, campaignData: InferInsertModel<typeof campaignsTable>): Promise<InferSelectModel<typeof campaignsTable> | null>;
  updateCampaign(userId: number, campaignId: number, campaignData: Partial<InferInsertModel<typeof campaignsTable>>): Promise<InferSelectModel<typeof campaignsTable> | null>;
  deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }>;

  getCreatives(userId: number, campaignId?: number): Promise<InferSelectModel<typeof creativesTable>[]>;
  createCreative(userId: number, creativeData: InferInsertModel<typeof creativesTable>): Promise<InferSelectModel<typeof creativesTable> | null>;
  updateCreative(userId: number, creativeId: number, creativeData: Partial<InferInsertModel<typeof creativesTable>>): Promise<InferSelectModel<typeof creativesTable> | null>;
  deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }>;

  getBudgets(userId: number, campaignId?: number): Promise<InferSelectModel<typeof budgetsTable>[]>;
  createBudget(userId: number, budgetData: InferInsertModel<typeof budgetsTable>): Promise<InferSelectModel<typeof budgetsTable> | null>;
  updateBudget(userId: number, budgetId: number, budgetData: Partial<InferInsertModel<typeof budgetsTable>>): Promise<InferSelectModel<typeof budgetsTable> | null>;
  deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }>;

  createCopy(userId: number, copyData: InferInsertModel<typeof copiesTable>): Promise<InferSelectModel<typeof copiesTable> | null>;
  getCopies(userId: number, campaignId?: number): Promise<InferSelectModel<typeof copiesTable>[]>;
  updateCopy(userId: number, copyId: number, copyData: Partial<InferInsertModel<typeof copiesTable>>): Promise<InferSelectModel<typeof copiesTable> | null>;
  deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }>;
  
  getDashboardData(userId: number): Promise<any>;

  createLandingPage(userId: number, pageData: InferInsertModel<typeof landingPagesTable>): Promise<InferSelectModel<typeof landingPagesTable> | null>;
  getLandingPages(userId: number): Promise<InferSelectModel<typeof landingPagesTable>[]>;
  getLandingPageById(userId: number, pageId: number): Promise<InferSelectModel<typeof landingPagesTable> | null>;
  getLandingPageBySlug(slug: string): Promise<InferSelectModel<typeof landingPagesTable> | null>;
  getLandingPageByStudioProjectId(studioProjectId: string): Promise<InferSelectModel<typeof landingPagesTable> | null>;
  updateLandingPage(userId: number, pageId: number, pageData: Partial<InferInsertModel<typeof landingPagesTable>>): Promise<InferSelectModel<typeof landingPagesTable> | null>;
  deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }>;

  // Chat MCP
  createChatSession(userId: number, title: string): Promise<InferSelectModel<typeof chatSessionsTable> | null>;
  getChatSessions(userId: number): Promise<InferSelectModel<typeof chatSessionsTable>[]>;
  getChatSessionById(userId: number, sessionId: number): Promise<InferSelectModel<typeof chatSessionsTable> & { messages: InferSelectModel<typeof chatMessagesTable>[] } | null>;
  addChatMessage(sessionId: number, sender: 'user' | 'mcp' | 'system', text: string, attachmentUrl?: string | null): Promise<InferSelectModel<typeof chatMessagesTable> | null>;
  updateChatSessionTitle(userId: number, sessionId: number, newTitle: string): Promise<InferSelectModel<typeof chatSessionsTable> | null>;
  deleteChatSession(userId: number, sessionId: number): Promise<{ success: boolean }>;
}


export class DatabaseStorage implements IStorage {
  async createUser(userData: InferInsertModel<typeof usersTable>): Promise<InferSelectModel<typeof usersTable> | null> {
    if (!userData.email || !userData.password || !userData.username) {
      throw new Error("Email, username, and password are required");
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const result = await db.insert(usersTable).values({ ...userData, password: hashedPassword }).returning();
    return result[0] || null;
  }

  async getUser(email: string): Promise<InferSelectModel<typeof usersTable> | null> {
    return await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) }) || null;
  }

  async getUserById(id: number): Promise<InferSelectModel<typeof usersTable> | null> {
    return await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) }) || null;
  }

  async validatePassword(email: string, pass: string): Promise<InferSelectModel<typeof usersTable> | null> {
    const user = await this.getUser(email);
    if (!user || !user.password) return null;
    const isValid = await bcrypt.compare(pass, user.password);
    return isValid ? user : null;
  }

  // --- Flow Methods ---
  async createFlow(userId: number, flowData: NewFlow): Promise<FlowData | null> {
    const result = await db.insert(flowsTable).values({ ...flowData, userId }).returning();
    return result[0] || null;
  }

  async getFlows(userId: number, campaignIdParam?: string | null): Promise<FlowData[]> {
    const conditions = [eq(flowsTable.userId, userId)];
    if (campaignIdParam) {
      if (campaignIdParam === 'null') {
        conditions.push(isNull(flowsTable.campaignId));
      } else {
        const numericCampaignId = parseInt(campaignIdParam, 10);
        if (!isNaN(numericCampaignId)) {
          conditions.push(eq(flowsTable.campaignId, numericCampaignId));
        }
      }
    }
    return db.query.flowsTable.findMany({
      where: and(...conditions),
      orderBy: [desc(flowsTable.updatedAt)],
    });
  }

  async getFlowById(userId: number, flowId: number): Promise<FlowData | null> {
    return await db.query.flowsTable.findFirst({
      where: and(eq(flowsTable.id, flowId), eq(flowsTable.userId, userId)),
    }) || null;
  }

  async updateFlow(userId: number, flowId: number, flowData: Partial<Omit<NewFlow, 'userId' | 'id'>>): Promise<FlowData | null> {
    // Garantir que 'elements' seja tratado como JSON, se necessário (Drizzle geralmente lida com isso para colunas jsonb)
    const dataToUpdate = { ...flowData, updatedAt: new Date() };

    const result = await db.update(flowsTable)
      .set(dataToUpdate)
      .where(and(eq(flowsTable.id, flowId), eq(flowsTable.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteFlow(userId: number, flowId: number): Promise<{ success: boolean; message?: string }> {
    const result = await db.delete(flowsTable)
      .where(and(eq(flowsTable.id, flowId), eq(flowsTable.userId, userId)))
      .returning({ id: flowsTable.id });
    if (result.length > 0) {
      return { success: true };
    }
    return { success: false, message: "Fluxo não encontrado ou usuário não autorizado." };
  }

  // --- Campaign Methods ---
  async getCampaigns(userId: number): Promise<InferSelectModel<typeof campaignsTable>[]> {
    return db.query.campaignsTable.findMany({
      where: eq(campaignsTable.userId, userId),
      orderBy: [desc(campaignsTable.updatedAt)],
    });
  }

  async getCampaignById(userId: number, campaignId: number): Promise<InferSelectModel<typeof campaignsTable> | null> {
    return db.query.campaignsTable.findFirst({
      where: and(eq(campaignsTable.id, campaignId), eq(campaignsTable.userId, userId)),
    }) || null;
  }

  async createCampaign(userId: number, campaignData: InferInsertModel<typeof campaignsTable>): Promise<InferSelectModel<typeof campaignsTable> | null> {
    const result = await db.insert(campaignsTable).values({ ...campaignData, userId }).returning();
    return result[0] || null;
  }

  async updateCampaign(userId: number, campaignId: number, campaignData: Partial<InferInsertModel<typeof campaignsTable>>): Promise<InferSelectModel<typeof campaignsTable> | null> {
    const result = await db.update(campaignsTable)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteCampaign(userId: number, campaignId: number): Promise<{ success: boolean }> {
    const result = await db.delete(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.userId, userId)))
      .returning({ id: campaignsTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Creative Methods ---
  async getCreatives(userId: number, campaignId?: number): Promise<InferSelectModel<typeof creativesTable>[]> {
    const conditions = [eq(creativesTable.userId, userId)];
    if (campaignId) {
      conditions.push(eq(creativesTable.campaignId, campaignId));
    }
    return db.query.creativesTable.findMany({
      where: and(...conditions),
      orderBy: [desc(creativesTable.updatedAt)],
    });
  }
  async createCreative(userId: number, creativeData: InferInsertModel<typeof creativesTable>): Promise<InferSelectModel<typeof creativesTable> | null> {
    const result = await db.insert(creativesTable).values({ ...creativeData, userId }).returning();
    return result[0] || null;
  }
  async updateCreative(userId: number, creativeId: number, creativeData: Partial<InferInsertModel<typeof creativesTable>>): Promise<InferSelectModel<typeof creativesTable> | null> {
    const result = await db.update(creativesTable)
      .set({ ...creativeData, updatedAt: new Date() })
      .where(and(eq(creativesTable.id, creativeId), eq(creativesTable.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteCreative(userId: number, creativeId: number): Promise<{ success: boolean }> {
    const result = await db.delete(creativesTable)
      .where(and(eq(creativesTable.id, creativeId), eq(creativesTable.userId, userId)))
      .returning({ id: creativesTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Budget Methods ---
  async getBudgets(userId: number, campaignId?: number): Promise<InferSelectModel<typeof budgetsTable>[]> {
    const conditions = [eq(budgetsTable.userId, userId)];
    if (campaignId) {
      conditions.push(eq(budgetsTable.campaignId, campaignId));
    }
    return db.query.budgetsTable.findMany({ where: and(...conditions) });
  }
  async createBudget(userId: number, budgetData: InferInsertModel<typeof budgetsTable>): Promise<InferSelectModel<typeof budgetsTable> | null> {
    const result = await db.insert(budgetsTable).values({ ...budgetData, userId }).returning();
    return result[0] || null;
  }
  async updateBudget(userId: number, budgetId: number, budgetData: Partial<InferInsertModel<typeof budgetsTable>>): Promise<InferSelectModel<typeof budgetsTable> | null> {
    const result = await db.update(budgetsTable)
      .set(budgetData)
      .where(and(eq(budgetsTable.id, budgetId), eq(budgetsTable.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteBudget(userId: number, budgetId: number): Promise<{ success: boolean }> {
    const result = await db.delete(budgetsTable)
      .where(and(eq(budgetsTable.id, budgetId), eq(budgetsTable.userId, userId)))
      .returning({ id: budgetsTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
  
  // --- Copy Methods ---
  async createCopy(userId: number, copyData: InferInsertModel<typeof copiesTable>): Promise<InferSelectModel<typeof copiesTable> | null> {
    const result = await db.insert(copiesTable).values({ ...copyData, userId }).returning();
    return result[0] || null;
  }
  async getCopies(userId: number, campaignId?: number): Promise<InferSelectModel<typeof copiesTable>[]> {
    const conditions = [eq(copiesTable.userId, userId)];
    if (campaignId) {
      conditions.push(eq(copiesTable.campaignId, campaignId));
    }
    return db.query.copiesTable.findMany({ where: and(...conditions) });
  }
  async updateCopy(userId: number, copyId: number, copyData: Partial<InferInsertModel<typeof copiesTable>>): Promise<InferSelectModel<typeof copiesTable> | null> {
    const result = await db.update(copiesTable)
      .set(copyData)
      .where(and(eq(copiesTable.id, copyId), eq(copiesTable.userId, userId)))
      .returning();
    return result[0] || null;
  }
  async deleteCopy(userId: number, copyId: number): Promise<{ success: boolean }> {
    const result = await db.delete(copiesTable)
      .where(and(eq(copiesTable.id, copyId), eq(copiesTable.userId, userId)))
      .returning({ id: copiesTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // --- Dashboard Data ---
  async getDashboardData(userId: number): Promise<any> {
    // Implementar lógica real para buscar dados agregados
    // Exemplo (simulado):
    const activeCampaigns = await db.query.campaignsTable.findMany({
      where: and(eq(campaignsTable.userId, userId), eq(campaignsTable.status, 'active'))
    });
    // ... outras métricas ...
    return {
      metrics: {
        activeCampaigns: activeCampaigns.length,
        totalSpent: 0, // Calcular
        totalCostPeriod: 0, // Calcular
        conversions: 0, // Calcular
        avgROI: 0, // Calcular
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
      },
      recentCampaigns: await db.query.campaignsTable.findMany({
        where: eq(campaignsTable.userId, userId),
        orderBy: [desc(campaignsTable.createdAt)],
        limit: 5,
      }),
      performanceChartData: { labels: [], datasets: [] }, // Popular com dados reais
      channelDistributionData: { labels: [], datasets: [] },
      conversionByMonthData: { labels: [], datasets: [] },
      roiByPlatformData: { labels: [], datasets: [] },
    };
  }
  // --- Landing Page Methods ---
  async createLandingPage(userId: number, pageData: InferInsertModel<typeof landingPagesTable>): Promise<InferSelectModel<typeof landingPagesTable> | null> {
    const result = await db.insert(landingPagesTable).values({ ...pageData, userId }).returning();
    return result[0] || null;
  }

  async getLandingPages(userId: number): Promise<InferSelectModel<typeof landingPagesTable>[]> {
    return db.query.landingPagesTable.findMany({
      where: eq(landingPagesTable.userId, userId),
      orderBy: [desc(landingPagesTable.updatedAt)],
    });
  }

  async getLandingPageById(userId: number, pageId: number): Promise<InferSelectModel<typeof landingPagesTable> | null> {
    return db.query.landingPagesTable.findFirst({
      where: and(eq(landingPagesTable.id, pageId), eq(landingPagesTable.userId, userId)),
    }) || null;
  }

  async getLandingPageBySlug(slug: string): Promise<InferSelectModel<typeof landingPagesTable> | null> {
    return db.query.landingPagesTable.findFirst({
      where: eq(landingPagesTable.slug, slug),
    }) || null;
  }
  
  async getLandingPageByStudioProjectId(studioProjectId: string): Promise<InferSelectModel<typeof landingPagesTable> | null> {
    return db.query.landingPagesTable.findFirst({
        where: eq(landingPagesTable.studioProjectId, studioProjectId),
    }) || null;
  }


  async updateLandingPage(userId: number, pageId: number, pageData: Partial<InferInsertModel<typeof landingPagesTable>>): Promise<InferSelectModel<typeof landingPagesTable> | null> {
    const result = await db.update(landingPagesTable)
      .set({ ...pageData, updatedAt: new Date() })
      .where(and(eq(landingPagesTable.id, pageId), eq(landingPagesTable.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteLandingPage(userId: number, pageId: number): Promise<{ success: boolean }> {
    const result = await db.delete(landingPagesTable)
      .where(and(eq(landingPagesTable.id, pageId), eq(landingPagesTable.userId, userId)))
      .returning({ id: landingPagesTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }

  // Chat MCP Methods
  async createChatSession(userId: number, title: string): Promise<InferSelectModel<typeof chatSessionsTable> | null> {
    const result = await db.insert(chatSessionsTable).values({ userId, title }).returning();
    return result[0] || null;
  }

  async getChatSessions(userId: number): Promise<InferSelectModel<typeof chatSessionsTable>[]> {
    return db.query.chatSessionsTable.findMany({
      where: eq(chatSessionsTable.userId, userId),
      orderBy: [desc(chatSessionsTable.updatedAt)],
    });
  }

  async getChatSessionById(userId: number, sessionId: number): Promise<InferSelectModel<typeof chatSessionsTable> & { messages: InferSelectModel<typeof chatMessagesTable>[] } | null> {
    return db.query.chatSessionsTable.findFirst({
      where: and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, userId)),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.timestamp)],
        },
      },
    }) || null;
  }

  async addChatMessage(sessionId: number, sender: 'user' | 'mcp' | 'system', text: string, attachmentUrl?: string | null): Promise<InferSelectModel<typeof chatMessagesTable> | null> {
    const result = await db.insert(chatMessagesTable).values({ sessionId, sender, text, attachmentUrl }).returning();
    // Atualizar o updatedAt da sessão
    await db.update(chatSessionsTable).set({ updatedAt: new Date() }).where(eq(chatSessionsTable.id, sessionId));
    return result[0] || null;
  }

  async updateChatSessionTitle(userId: number, sessionId: number, newTitle: string): Promise<InferSelectModel<typeof chatSessionsTable> | null> {
    const result = await db.update(chatSessionsTable)
      .set({ title: newTitle, updatedAt: new Date() })
      .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteChatSession(userId: number, sessionId: number): Promise<{ success: boolean }> {
    const result = await db.delete(chatSessionsTable)
      .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, userId)))
      .returning({ id: chatSessionsTable.id });
    return result.length > 0 ? { success: true } : { success: false };
  }
}

export const storage: IStorage = new DatabaseStorage();
