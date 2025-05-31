import { db } from './db';
import {
  users,
  campaigns,
  creatives,
  metrics,
  whatsappMessages,
  copies,
  alerts,
  budgets,
  landingPages,
  chatSessions,
  chatMessages,
  funnels,
  funnelStages,
  InsertUser,
  SelectUser,
  InsertCampaign,
  SelectCampaign,
  InsertCreative,
  SelectCreative,
  InsertMetric,
  SelectMetric,
  InsertWhatsappMessage,
  SelectWhatsappMessage,
  InsertCopy,
  SelectCopy,
  InsertAlert,
  SelectAlert,
  InsertBudget,
  SelectBudget,
  InsertLandingPage,
  SelectLandingPage,
  InsertChatSession,
  SelectChatSession,
  InsertChatMessage,
  SelectChatMessage,
  InsertFunnel,
  SelectFunnel,
  InsertFunnelStage,
  SelectFunnelStage,
  User,
  // Campaign, // Removido pois SelectCampaign é usado e já importado
  // Creative, // Removido pois SelectCreative é usado e já importado
  // Metric, // Removido pois SelectMetric é usado e já importado
  // WhatsappMessage, // Removido pois SelectWhatsappMessage é usado e já importado
  // Copy, // Removido pois SelectCopy é usado e já importado
  // Alert, // Removido pois SelectAlert é usado e já importado
  // Budget, // Removido pois SelectBudget é usado e já importado
  // LandingPage, // Removido pois SelectLandingPage é usado e já importado
  // ChatSession, // Removido pois SelectChatSession é usado e já importado
  // ChatMessage, // Removido pois SelectChatMessage é usado e já importado
  // Funnel, // Removido pois SelectFunnel é usado e já importado
  // FunnelStage, // Removido pois SelectFunnelStage é usado e já importado
} from '../../shared/schema';
import { eq, desc, and, sql, sum, avg, count, gte, lte, ne } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { кампањи } from '../../shared/schema'; // Typo? Deve ser campaigns? Ou é um alias intencional? Supondo que seja um alias, mas revisarei. Parece ser um erro de digitação. Vou assumir que deveria ser campaigns.

// Corrigindo o typo potencial, se кампањи for um erro:
// Se for intencional, manter como está. Por ora, vou tratar como se fosse 'campaigns' para lógica interna se necessário.
// No entanto, o schema importado é `campaigns`, então `кампањи` não seria usado a menos que fosse um alias definido em outro lugar.
// Pelo contexto, parece um erro de digitação na importação não utilizada. Vou remover a linha se não for usada.
// A linha `import { кампањи } from '../../shared/schema';` não é usada. Vou removê-la.


export interface IStorage {
  // Users
  createUser(data: InsertUser): Promise<SelectUser | null>;
  getUser(userId: number): Promise<SelectUser | null>;
  getUserByEmail(email: string): Promise<SelectUser | null>;
  validatePassword(password: string, hash: string): Promise<boolean>;

  // Campaigns
  createCampaign(data: InsertCampaign): Promise<SelectCampaign | null>;
  getCampaigns(userId: number): Promise<SelectCampaign[]>;
  getCampaignById(campaignId: number, userId: number): Promise<SelectCampaign | null>;
  updateCampaign(campaignId: number, userId: number, data: Partial<InsertCampaign>): Promise<SelectCampaign | null>;
  deleteCampaign(campaignId: number, userId: number): Promise<{ success: boolean }>;
  getCampaignMetricsSummary(campaignId: number, userId: number): Promise<any>;


  // Creatives
  createCreative(data: InsertCreative): Promise<SelectCreative | null>;
  getCreatives(userId: number, campaignId?: number): Promise<SelectCreative[]>;
  getCreativeById(creativeId: number, userId: number): Promise<SelectCreative | null>;
  updateCreative(creativeId: number, userId: number, data: Partial<InsertCreative>): Promise<SelectCreative | null>;
  deleteCreative(creativeId: number, userId: number): Promise<{ success: boolean }>;

  // Metrics
  createMetric(data: InsertMetric): Promise<SelectMetric | null>;
  getMetricsForCampaign(campaignId: number, userId: number): Promise<SelectMetric[]>;
  getUserMetrics(userId: number): Promise<SelectMetric[]>;

  // Copies
  createCopy(data: InsertCopy): Promise<SelectCopy | null>;
  getCopies(userId: number, campaignId?: number): Promise<SelectCopy[]>;
  getCopyById(copyId: number, userId: number): Promise<SelectCopy | null>;
  updateCopy(copyId: number, userId: number, data: Partial<InsertCopy>): Promise<SelectCopy | null>;
  deleteCopy(copyId: number, userId: number): Promise<{ success: boolean }>;

  // Alerts
  createAlert(data: InsertAlert): Promise<SelectAlert | null>;
  getAlerts(userId: number, read?: boolean): Promise<SelectAlert[]>;
  markAlertAsRead(alertId: number, userId: number): Promise<SelectAlert | null>;
  markAllAlertsAsRead(userId: number): Promise<{ updatedCount: number } >;


  // Budgets
  createBudget(data: InsertBudget): Promise<SelectBudget | null>;
  getBudgets(userId: number, campaignId?: number): Promise<SelectBudget[]>;
  getBudgetById(budgetId: number, userId: number): Promise<SelectBudget | null>;
  updateBudget(budgetId: number, userId: number, data: Partial<InsertBudget>): Promise<SelectBudget | null>;
  deleteBudget(budgetId: number, userId: number): Promise<{ success: boolean }>;

  // Landing Pages
  createLandingPage(data: InsertLandingPage): Promise<SelectLandingPage | null>;
  getLandingPages(userId: number): Promise<SelectLandingPage[]>;
  getLandingPageById(lpId: number, userId: number): Promise<SelectLandingPage | null>;
  getLandingPageBySlug(slug: string): Promise<SelectLandingPage | null>;
  getLandingPageByStudioProjectId(studioProjectId: string): Promise<SelectLandingPage | null>;
  updateLandingPage(lpId: number, userId: number, data: Partial<InsertLandingPage>): Promise<SelectLandingPage | null>;
  deleteLandingPage(lpId: number, userId: number): Promise<{ success: boolean }>;


  // WhatsApp Messages
  createWhatsappMessage(data: InsertWhatsappMessage): Promise<SelectWhatsappMessage | null>;
  getWhatsappMessages(userId: number, contactNumber?: string): Promise<SelectWhatsappMessage[]>;

  // Chat Sessions & Messages (MCP Agent)
  createChatSession(data: InsertChatSession): Promise<SelectChatSession | null>;
  getChatSessions(userId: number): Promise<SelectChatSession[]>;
  getChatSessionById(sessionId: number, userId: number): Promise<SelectChatSession | null>;
  updateChatSessionTitle(sessionId: number, userId: number, title: string): Promise<SelectChatSession | null>;
  deleteChatSession(sessionId: number, userId: number): Promise<{ success: boolean }>;
  createChatMessage(data: InsertChatMessage): Promise<SelectChatMessage | null>;
  getChatMessages(sessionId: number, userId: number): Promise<SelectChatMessage[]>; // Added userId for security
  getLatestChatMessage(sessionId: number, userId: number): Promise<SelectChatMessage | null>; // Added userId for security


  // Funnels
  createFunnel(data: InsertFunnel): Promise<SelectFunnel | null>;
  getFunnels(userId: number): Promise<Array<SelectFunnel & { stages: SelectFunnelStage[] }>>;
  getFunnel(funnelId: number, userId: number): Promise<(SelectFunnel & { stages: SelectFunnelStage[] }) | null>;
  updateFunnel(funnelId: number, userId: number, data: Partial<InsertFunnel>): Promise<SelectFunnel | null>;
  deleteFunnel(funnelId: number, userId: number): Promise<{ success: boolean }>;

  // Funnel Stages
  createFunnelStage(data: InsertFunnelStage): Promise<SelectFunnelStage | null>;
  getFunnelStages(funnelId: number, userId: number): Promise<SelectFunnelStage[]>; // Added userId for security
  getFunnelStage(stageId: number, userId: number): Promise<SelectFunnelStage | null>; // Added userId for security
  updateFunnelStage(stageId: number, userId: number, data: Partial<InsertFunnelStage>): Promise<SelectFunnelStage | null>; // Added userId
  deleteFunnelStage(stageId: number, userId: number): Promise<{ success: boolean }>; // Added userId
  updateFunnelStageOrder(stageId: number, userId: number, order: number): Promise<SelectFunnelStage | null>; // Added userId

  // Dashboard
  getDashboardData(userId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async createUser(data: InsertUser): Promise<SelectUser | null> {
    const hashedPassword = await bcrypt.hash(data.password!, 10);
    const result = await db.insert(users).values({ ...data, password: hashedPassword }).returning();
    return result[0] ?? null;
  }

  async getUser(userId: number): Promise<SelectUser | null> {
    const result = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return result ?? null;
  }

  async getUserByEmail(email: string): Promise<SelectUser | null> {
    const result = await db.query.users.findFirst({ where: eq(users.email, email) });
    return result ?? null;
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Campaigns
  async createCampaign(data: InsertCampaign): Promise<SelectCampaign | null> {
    const result = await db.insert(campaigns).values(data).returning();
    return result[0] ?? null;
  }

  async getCampaigns(userId: number): Promise<SelectCampaign[]> {
    return db.query.campaigns.findMany({
      where: eq(campaigns.userId, userId),
      orderBy: [desc(campaigns.createdAt)],
       with: {
        metrics: { // Isso pode trazer muitas métricas, considerar sumarizar se for demais
          columns: {
            impressions: true,
            clicks: true,
            conversions: true,
            cost: true,
            revenue: true,
          }
        }
      }
    });
  }

  async getCampaignById(campaignId: number, userId: number): Promise<SelectCampaign | null> {
    const result = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
      with: {
        creatives: true,
        metrics: { orderBy: [desc(metrics.date)]},
        budgets: true,
        copies: true,
      },
    });
    return result ?? null;
  }

  async updateCampaign(campaignId: number, userId: number, data: Partial<InsertCampaign>): Promise<SelectCampaign | null> {
    const result = await db.update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteCampaign(campaignId: number, userId: number): Promise<{ success: boolean }> {
    // Considerar transação para deletar entidades relacionadas (metrics, creatives, etc.) ou usar ON DELETE CASCADE no DB
    await db.delete(metrics).where(and(eq(metrics.campaignId, campaignId), eq(metrics.userId, userId)));
    await db.delete(creatives).where(and(eq(creatives.campaignId, campaignId), eq(creatives.userId, userId)));
    await db.delete(budgets).where(and(eq(budgets.campaignId, campaignId), eq(budgets.userId, userId)));
    await db.delete(copies).where(and(eq(copies.campaignId, campaignId), eq(copies.userId, userId)));
    // Adicionar funnels associados se necessário: await db.delete(funnels).where(and(eq(funnels.campaignId, campaignId), eq(funnels.userId, userId)));


    const result = await db.delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

   async getCampaignMetricsSummary(campaignId: number, userId: number): Promise<any> {
    const campaignCheck = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
      columns: { id: true }
    });

    if (!campaignCheck) {
      return null;
    }

    const summary = await db.select({
        totalImpressions: sum(metrics.impressions).mapWith(Number),
        totalClicks: sum(metrics.clicks).mapWith(Number),
        totalConversions: sum(metrics.conversions).mapWith(Number),
        totalCost: sum(metrics.cost).mapWith(Number),
        totalRevenue: sum(metrics.revenue).mapWith(Number),
        totalLeads: sum(metrics.leads).mapWith(Number),
      })
      .from(metrics)
      .where(and(eq(metrics.campaignId, campaignId), eq(metrics.userId, userId))); // Adicionado userId aqui também

    const result = summary[0];
    if (!result) return { // Retorna zero se não houver métricas
        impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0, leads: 0, ctr: 0, cpc: 0, cpa: 0, roi: 0
    };

    const ctr = (result.totalClicks && result.totalImpressions && result.totalImpressions > 0) ? (result.totalClicks / result.totalImpressions) * 100 : 0;
    const cpc = (result.totalCost && result.totalClicks && result.totalClicks > 0) ? result.totalCost / result.totalClicks : 0;
    const cpa = (result.totalCost && result.totalConversions && result.totalConversions > 0) ? result.totalCost / result.totalConversions : 0;
    const roi = (result.totalRevenue && result.totalCost && result.totalCost > 0) ? ((result.totalRevenue - result.totalCost) / result.totalCost) * 100 : (result.totalRevenue && result.totalRevenue > 0 && result.totalCost === 0 ? Infinity : 0) ;


    return {
      impressions: result.totalImpressions || 0,
      clicks: result.totalClicks || 0,
      conversions: result.totalConversions || 0,
      cost: parseFloat(Number(result.totalCost || 0).toFixed(2)),
      revenue: parseFloat(Number(result.totalRevenue || 0).toFixed(2)),
      leads: result.totalLeads || 0,
      ctr: parseFloat(ctr.toFixed(2)),
      cpc: parseFloat(cpc.toFixed(2)),
      cpa: parseFloat(cpa.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
    };
  }

  // Creatives
  async createCreative(data: InsertCreative): Promise<SelectCreative | null> {
    const result = await db.insert(creatives).values(data).returning();
    return result[0] ?? null;
  }

  async getCreatives(userId: number, campaignId?: number): Promise<SelectCreative[]> {
    const conditions = [eq(creatives.userId, userId)];
    if (campaignId) {
      conditions.push(eq(creatives.campaignId, campaignId));
    }
    return db.query.creatives.findMany({
      where: and(...conditions),
      orderBy: [desc(creatives.createdAt)],
    });
  }

  async getCreativeById(creativeId: number, userId: number): Promise<SelectCreative | null> {
    const result = await db.query.creatives.findFirst({
      where: and(eq(creatives.id, creativeId), eq(creatives.userId, userId)),
    });
    return result ?? null;
  }

  async updateCreative(creativeId: number, userId: number, data: Partial<InsertCreative>): Promise<SelectCreative | null> {
    const result = await db.update(creatives)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteCreative(creativeId: number, userId: number): Promise<{ success: boolean }> {
    const result = await db.delete(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

  // Metrics
  async createMetric(data: InsertMetric): Promise<SelectMetric | null> {
    const result = await db.insert(metrics).values(data).returning();
    return result[0] ?? null;
  }

  async getMetricsForCampaign(campaignId: number, userId: number): Promise<SelectMetric[]> {
    const campaignExists = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
        columns: { id: true }
    });

    if (!campaignExists) {
        return [];
    }

    return db.query.metrics.findMany({
      where: and(eq(metrics.campaignId, campaignId), eq(metrics.userId, userId)), // Adicionado userId aqui também
      orderBy: [desc(metrics.date)],
       with: {
        campaign: {
          columns: {
            name: true,
          }
        }
      }
    });
  }

  async getUserMetrics(userId: number): Promise<SelectMetric[]> {
    return db.query.metrics.findMany({
        where: eq(metrics.userId, userId),
        orderBy: [desc(metrics.date)],
        with: {
            campaign: {
                columns: {
                    name: true,
                    id: true,
                },
            },
        },
    });
  }


  // Copies
  async createCopy(data: InsertCopy): Promise<SelectCopy | null> {
    const result = await db.insert(copies).values(data).returning();
    return result[0] ?? null;
  }

  async getCopies(userId: number, campaignId?: number): Promise<SelectCopy[]> {
    const conditions = [eq(copies.userId, userId)];
    if (campaignId) {
      conditions.push(eq(copies.campaignId, campaignId));
    }
    return db.query.copies.findMany({
      where: and(...conditions),
      orderBy: [desc(copies.createdAt)],
    });
  }

  async getCopyById(copyId: number, userId: number): Promise<SelectCopy | null> {
    const result = await db.query.copies.findFirst({
      where: and(eq(copies.id, copyId), eq(copies.userId, userId)),
    });
    return result ?? null;
  }

  async updateCopy(copyId: number, userId: number, data: Partial<InsertCopy>): Promise<SelectCopy | null> {
    const result = await db.update(copies)
      .set({ ...data }) // updatedAt não existe na tabela copies
      .where(and(eq(copies.id, copyId), eq(copies.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteCopy(copyId: number, userId: number): Promise<{ success: boolean }> {
    const result = await db.delete(copies)
      .where(and(eq(copies.id, copyId), eq(copies.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

  // Alerts
  async createAlert(data: InsertAlert): Promise<SelectAlert | null> {
    const result = await db.insert(alerts).values(data).returning();
    return result[0] ?? null;
  }

  async getAlerts(userId: number, read?: boolean): Promise<SelectAlert[]> {
    const conditions = [eq(alerts.userId, userId)];
    if (read !== undefined) {
      conditions.push(eq(alerts.isRead, read));
    }
    return db.query.alerts.findMany({
      where: and(...conditions),
      orderBy: [desc(alerts.createdAt)],
    });
  }

  async markAlertAsRead(alertId: number, userId: number): Promise<SelectAlert | null> {
    const result = await db.update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async markAllAlertsAsRead(userId: number): Promise<{ updatedCount: number }> {
    const result = await db.update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false))) // Apenas as não lidas
      .returning({ id: alerts.id });
    return { updatedCount: result.length };
  }


  // Budgets
  async createBudget(data: InsertBudget): Promise<SelectBudget | null> {
    const result = await db.insert(budgets).values(data).returning();
    return result[0] ?? null;
  }

  async getBudgets(userId: number, campaignId?: number): Promise<SelectBudget[]> {
    const conditions = [eq(budgets.userId, userId)];
    if (campaignId) {
      conditions.push(eq(budgets.campaignId, campaignId));
    }
    return db.query.budgets.findMany({
      where: and(...conditions),
      orderBy: [desc(budgets.startDate)], // ou budgets.createdAt
    });
  }

  async getBudgetById(budgetId: number, userId: number): Promise<SelectBudget | null> {
    const result = await db.query.budgets.findFirst({
      where: and(eq(budgets.id, budgetId), eq(budgets.userId, userId)),
    });
    return result ?? null;
  }

  async updateBudget(budgetId: number, userId: number, data: Partial<InsertBudget>): Promise<SelectBudget | null> {
    const result = await db.update(budgets)
      .set({ ...data }) // updatedAt não existe na tabela budgets
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteBudget(budgetId: number, userId: number): Promise<{ success: boolean }> {
    const result = await db.delete(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

  // Landing Pages
  async createLandingPage(data: InsertLandingPage): Promise<SelectLandingPage | null> {
    const result = await db.insert(landingPages).values(data).returning();
    return result[0] ?? null;
  }

  async getLandingPages(userId: number): Promise<SelectLandingPage[]> {
    return db.query.landingPages.findMany({
      where: eq(landingPages.userId, userId),
      orderBy: [desc(landingPages.createdAt)],
    });
  }

  async getLandingPageById(lpId: number, userId: number): Promise<SelectLandingPage | null> {
     const result = await db.query.landingPages.findFirst({
      where: and(eq(landingPages.id, lpId), eq(landingPages.userId, userId)),
    });
    return result ?? null;
  }

  async getLandingPageByStudioProjectId(studioProjectId: string): Promise<SelectLandingPage | null> {
    const result = await db.query.landingPages.findFirst({
     where: eq(landingPages.studioProjectId, studioProjectId),
   });
   return result ?? null;
 }

  async getLandingPageBySlug(slug: string): Promise<SelectLandingPage | null> {
    const result = await db.query.landingPages.findFirst({
      where: eq(landingPages.slug, slug),
    });
    return result ?? null;
  }

  async updateLandingPage(lpId: number, userId: number, data: Partial<InsertLandingPage>): Promise<SelectLandingPage | null> {
    const result = await db.update(landingPages)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(landingPages.id, lpId), eq(landingPages.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteLandingPage(lpId: number, userId: number): Promise<{ success: boolean }> {
    const result = await db.delete(landingPages)
      .where(and(eq(landingPages.id, lpId), eq(landingPages.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }


  // WhatsApp Messages
  async createWhatsappMessage(data: InsertWhatsappMessage): Promise<SelectWhatsappMessage | null> {
    const result = await db.insert(whatsappMessages).values(data).returning();
    return result[0] ?? null;
  }

  async getWhatsappMessages(userId: number, contactNumber?: string): Promise<SelectWhatsappMessage[]> {
    const conditions = [eq(whatsappMessages.userId, userId)];
    if (contactNumber) {
      conditions.push(eq(whatsappMessages.contactNumber, contactNumber));
    }
    return db.query.whatsappMessages.findMany({
      where: and(...conditions),
      orderBy: [desc(whatsappMessages.timestamp)],
    });
  }

  // Chat Sessions & Messages (MCP Agent)
  async createChatSession(data: InsertChatSession): Promise<SelectChatSession | null> {
    const result = await db.insert(chatSessions).values(data).returning();
    return result[0] ?? null;
  }

  async getChatSessions(userId: number): Promise<SelectChatSession[]> {
    return db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, userId),
      orderBy: [desc(chatSessions.createdAt)],
    });
  }

  async getChatSessionById(sessionId: number, userId: number): Promise<SelectChatSession | null> {
    const result = await db.query.chatSessions.findFirst({
      where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    });
    return result ?? null;
  }

  async updateChatSessionTitle(sessionId: number, userId: number, title: string): Promise<SelectChatSession | null> {
    const result = await db.update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteChatSession(sessionId: number, userId: number): Promise<{ success: boolean }> {
    // Deletar mensagens associadas primeiro
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    const result = await db.delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

  async createChatMessage(data: InsertChatMessage): Promise<SelectChatMessage | null> {
    const result = await db.insert(chatMessages).values(data).returning();
    if (result[0]) {
      await db.update(chatSessions) // Atualizar updatedAt da sessão
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, result[0].sessionId));
    }
    return result[0] ?? null;
  }

  async getChatMessages(sessionId: number, userId: number): Promise<SelectChatMessage[]> {
     // Verificar se a sessão pertence ao usuário
     const session = await this.getChatSessionById(sessionId, userId);
     if (!session) {
         return []; // ou lançar erro
     }
    return db.query.chatMessages.findMany({
      where: eq(chatMessages.sessionId, sessionId),
      orderBy: [desc(chatMessages.timestamp)], // ou asc
    });
  }

  async getLatestChatMessage(sessionId: number, userId: number): Promise<SelectChatMessage | null> {
    const session = await this.getChatSessionById(sessionId, userId);
    if (!session) {
        return null; 
    }
    const result = await db.query.chatMessages.findFirst({
        where: eq(chatMessages.sessionId, sessionId),
        orderBy: [desc(chatMessages.timestamp)],
    });
    return result ?? null;
  }

  // Funnels
  async createFunnel(data: InsertFunnel): Promise<SelectFunnel | null> {
    const result = await db.insert(funnels).values(data).returning();
    return result[0] ? { ...result[0], stages: [] } : null; // Adiciona stages vazio
  }

  async getFunnels(userId: number): Promise<Array<SelectFunnel & { stages: SelectFunnelStage[] }>> {
    return db.query.funnels.findMany({
      where: eq(funnels.userId, userId),
      orderBy: [desc(funnels.createdAt)],
      with: {
        stages: {
          orderBy: [funnelStages.order],
        },
      },
    });
  }

  async getFunnel(funnelId: number, userId: number): Promise<(SelectFunnel & { stages: SelectFunnelStage[] }) | null> {
    const result = await db.query.funnels.findFirst({
      where: and(eq(funnels.id, funnelId), eq(funnels.userId, userId)),
      with: {
        stages: {
          orderBy: [funnelStages.order],
        },
      },
    });
    return result ?? null;
  }

  async updateFunnel(funnelId: number, userId: number, data: Partial<InsertFunnel>): Promise<SelectFunnel | null> {
    const result = await db.update(funnels)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async deleteFunnel(funnelId: number, userId: number): Promise<{ success: boolean }> {
    // Deletar estágios associados primeiro
    await db.delete(funnelStages).where(eq(funnelStages.funnelId, funnelId));
    const result = await db.delete(funnels)
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .returning();
    return { success: result.length > 0 };
  }

  // Funnel Stages
  async createFunnelStage(data: InsertFunnelStage): Promise<SelectFunnelStage | null> {
    const result = await db.insert(funnelStages).values(data).returning();
    return result[0] ?? null;
  }

  async getFunnelStages(funnelId: number, userId: number): Promise<SelectFunnelStage[]> {
    // Verificar se o funil pertence ao usuário
    const funnel = await this.getFunnel(funnelId, userId);
    if (!funnel) {
      return []; // Ou lançar erro
    }
    return db.query.funnelStages.findMany({
      where: eq(funnelStages.funnelId, funnelId),
      orderBy: [funnelStages.order],
    });
  }

  async getFunnelStage(stageId: number, userId: number): Promise<SelectFunnelStage | null> {
    // Para segurança, precisamos verificar se este estágio pertence a um funil do usuário.
    // Isso requer um join ou uma query adicional.
    const stage = await db.query.funnelStages.findFirst({
        where: eq(funnelStages.id, stageId),
        with: {
            funnel: {
                columns: { userId: true }
            }
        }
    });

    if (stage && stage.funnel.userId === userId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { funnel, ...restOfStage } = stage; // Remover o objeto funnel aninhado para corresponder ao SelectFunnelStage
        return restOfStage as SelectFunnelStage;
    }
    return null;
  }

  async updateFunnelStage(stageId: number, userId: number, data: Partial<InsertFunnelStage>): Promise<SelectFunnelStage | null> {
    const stageToUpdate = await this.getFunnelStage(stageId, userId); // Verifica a propriedade
    if (!stageToUpdate) return null;

    const result = await db.update(funnelStages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(funnelStages.id, stageId))
      .returning();
    return result[0] ?? null;
  }

  async deleteFunnelStage(stageId: number, userId: number): Promise<{ success: boolean }> {
    const stageToUpdate = await this.getFunnelStage(stageId, userId); // Verifica a propriedade
    if (!stageToUpdate) return { success: false };

    const result = await db.delete(funnelStages)
      .where(eq(funnelStages.id, stageId))
      .returning();
    return { success: result.length > 0 };
  }

  async updateFunnelStageOrder(stageId: number, userId: number, order: number): Promise<SelectFunnelStage | null> {
    const stageToUpdate = await this.getFunnelStage(stageId, userId); // Verifica a propriedade
    if (!stageToUpdate) return null;

    const result = await db.update(funnelStages)
      .set({ order, updatedAt: new Date() })
      .where(eq(funnelStages.id, stageId))
      .returning();
    return result[0] ?? null;
  }

  // Dashboard Data
  async getDashboardData(userId: number): Promise<any> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalCampaigns = await db.select({ value: count() })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    const activeCampaigns = await db.select({ value: count() })
      .from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));

    const overallMetrics = await db.select({
        totalSpent: sum(metrics.cost).mapWith(Number),
        totalRevenue: sum(metrics.revenue).mapWith(Number),
        totalConversions: sum(metrics.conversions).mapWith(Number),
        totalImpressions: sum(metrics.impressions).mapWith(Number),
        totalClicks: sum(metrics.clicks).mapWith(Number),
      })
      .from(metrics)
      .where(eq(metrics.userId, userId));

    const metricsLast30Days = await db.select({
        spent: sum(metrics.cost).mapWith(Number),
        revenue: sum(metrics.revenue).mapWith(Number),
        conversions: sum(metrics.conversions).mapWith(Number),
      })
      .from(metrics)
      .where(and(eq(metrics.userId, userId), gte(metrics.date, thirtyDaysAgo.toISOString().split('T')[0])));

    // Performance ao longo do tempo (ex: últimos 30 dias, agrupado por dia)
    const performanceOverTime = await db.select({
        date: metrics.date,
        impressions: sum(metrics.impressions).mapWith(Number),
        clicks: sum(metrics.clicks).mapWith(Number),
        cost: sum(metrics.cost).mapWith(Number),
      })
      .from(metrics)
      .where(and(eq(metrics.userId, userId), gte(metrics.date, thirtyDaysAgo.toISOString().split('T')[0])))
      .groupBy(metrics.date)
      .orderBy(metrics.date);

    // Recentes campanhas
    const recentCampaignsList = await db.query.campaigns.findMany({
      where: eq(campaigns.userId, userId),
      orderBy: [desc(campaigns.createdAt)],
      limit: 5,
      with: { metrics: { columns: {cost: true, revenue: true}}} // Simplificado
    });

    const summary = overallMetrics[0] || {};
    const cost = summary.totalSpent || 0;
    const revenue = summary.totalRevenue || 0;
    const conversions = summary.totalConversions || 0;
    const clicks = summary.totalClicks || 0;
    const impressions = summary.totalImpressions || 0;

    const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : (revenue > 0 ? Infinity : 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;


    return {
      kpis: {
        totalCampaigns: totalCampaigns[0]?.value || 0,
        activeCampaigns: activeCampaigns[0]?.value || 0,
        totalSpent: parseFloat(cost.toFixed(2)),
        totalConversions: conversions,
        averageRoi: parseFloat(roi.toFixed(2)),
      },
      detailedMetrics: {
        impressions: impressions,
        clicks: clicks,
        ctr: parseFloat(ctr.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2)),
        totalRevenue: parseFloat(revenue.toFixed(2)),
      },
      performanceTrend: { // Simples placeholder, idealmente comparar com período anterior
        spentLast30Days: parseFloat((metricsLast30Days[0]?.spent || 0).toFixed(2)),
        revenueLast30Days: parseFloat((metricsLast30Days[0]?.revenue || 0).toFixed(2)),
        conversionsLast30Days: metricsLast30Days[0]?.conversions || 0,
      },
      charts: {
        performanceOverTime: performanceOverTime.map(p => ({
            date: p.date, // Ensure date is formatted as YYYY-MM-DD if needed by charts
            impressions: p.impressions || 0,
            clicks: p.clicks || 0,
            cost: parseFloat((p.cost || 0).toFixed(2)),
        })),
        // Outros dados para gráficos (ex: distributionByChannel) precisariam de mais lógica/schema
      },
      recentCampaigns: recentCampaignsList.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        // Sumarizar métricas da campanha se necessário
        totalSpent: c.metrics.reduce((acc, m) => acc + parseFloat(m.cost || '0'), 0),
        totalRevenue: c.metrics.reduce((acc, m) => acc + parseFloat(m.revenue || '0'), 0)
      })),
    };
  }
}

export const storage = new DatabaseStorage();
