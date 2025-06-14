import { db } from './db'; // Assumindo que db.ts existe e exporta a instância de drizzle
import {
  users, campaigns, creatives, metrics, whatsappMessages, copies, alerts, budgets, landingPages,
  chatSessions, chatMessages,
  type User, type InsertUser, type Campaign, type InsertCampaign,
  type Creative, type InsertCreative, type Metric, type InsertMetric,
  type WhatsappMessage, type InsertWhatsappMessage, type Copy, type InsertCopy,
  type Alert, type InsertAlert, type Budget, type InsertBudget,
  type LandingPage, type InsertLandingPage,
  type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage
} from '../shared/schema'; // Importe suas tabelas e tipos
import { eq, count, sum, sql, desc, and, or } from 'drizzle-orm'; // Importe sum do drizzle-orm
import * as bcrypt from 'bcrypt'; // Use * as para importar bcrypt
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config'; // Certifique-se que JWT_SECRET é importado e existe

// Assumindo que chartColors é importado do frontend ou definido globalmente
// Para o backend, podemos simular ou usar uma paleta fixa
const chartColors = {
  palette: [
    'rgba(75, 192, 192, 1)', // Verde-água
    'rgba(255, 99, 132, 1)', // Vermelho
    'rgba(54, 162, 235, 1)', // Azul
    'rgba(255, 206, 86, 1)', // Amarelo
    'rgba(153, 102, 255, 1)',// Roxo
    'rgba(255, 159, 64, 1)', // Laranja
    'rgba(200, 200, 200, 1)' // Cinza
  ],
  background: [
    'rgba(75, 192, 192, 0.2)',
    'rgba(255, 99, 132, 0.2)',
    'rgba(54, 162, 235, 0.2)',
    'rgba(255, 206, 86, 0.2)',
    'rgba(153, 102, 255, 0.2)',
    'rgba(255, 159, 64, 0.2)',
    'rgba(200, 200, 200, 0.2)'
  ]
};

// Função auxiliar para gerar dados de gráfico de linha simulados
function generateSimulatedLineChartData(label: string, startValue: number, count: number, maxFluctuation: number, color: string): { labels: string[], datasets: { label: string, data: number[], borderColor: string, backgroundColor: string, fill: boolean, tension: number }[] } {
  const data = [];
  const labels = [];
  let currentValue = startValue;

  for (let i = 0; i < count; i++) {
    labels.push(`Dia ${i + 1}`); // Ou mês, semana, etc.
    data.push(Math.round(currentValue));
    currentValue += (Math.random() * maxFluctuation * 2) - maxFluctuation;
    if (currentValue < 0) currentValue = 0; // Evita valores negativos
  }

  return {
    labels: labels,
    datasets: [
      {
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.2)'), // Cor de fundo com opacidade
        fill: true,
        tension: 0.4,
      },
    ],
  };
}

// Função auxiliar para gerar dados de gráfico de barra simulados
function generateSimulatedBarChartData(label: string, categories: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { label: string, data: number[], backgroundColor: string[] }[] } {
  const data = categories.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation));
  return {
    labels: categories,
    datasets: [
      {
        label: label,
        data: data,
        backgroundColor: colors,
      },
    ],
  };
}

// Função auxiliar para gerar dados de gráfico de rosca simulados
function generateSimulatedDoughnutChartData(labels: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { data: number[], backgroundColor: string[], borderWidth: number }[] } {
  const data = labels.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation));
  return {
    labels: labels,
    datasets: [
      {
        data: data,
        backgroundColor: colors.map(color => color.replace('1)', '0.8)')), // Fundo com opacidade para Doughnut
        borderWidth: 0,
      },
    ],
  };
}


export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;

  getCampaigns(userId: number, limit?: number): Promise<Campaign[]>;
  getCampaign(id: number, userId: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Omit<InsertCampaign, 'userId'>>, userId: number): Promise<Campaign | undefined>;
  deleteCampaign(id: number, userId: number): Promise<boolean>;

  getCreatives(userId: number, campaignId?: number): Promise<Creative[]>;
  getCreative(id: number, userId: number): Promise<Creative | undefined>;
  createCreative(creative: InsertCreative): Promise<Creative>;
  updateCreative(id: number, creative: Partial<Omit<InsertCreative, 'userId'>>, userId: number): Promise<Creative | undefined>;
  deleteCreative(id: number, userId: number): Promise<boolean>;

  getMetricsForCampaign(campaignId: number, userId: number): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;

  getMessages(userId: number, contactNumber?: string): Promise<WhatsappMessage[]>;
  createMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  markMessageAsRead(id: number, userId: number): Promise<boolean>;
  getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]>;

  getCopies(userId: number, campaignId?: number): Promise<Copy[]>;
  createCopy(copy: InsertCopy): Promise<Copy>;
  deleteCopy(id: number, userId: number): Promise<boolean>; // userId agora é number
  updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<Copy | undefined>;

  getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: number, userId: number): Promise<boolean>;

  getBudgets(userId: number, campaignId?: number): Promise<Budget[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined>;

  getLandingPages(userId: number): Promise<LandingPage[]>;
  getLandingPage(id: number, userId: number): Promise<LandingPage | undefined>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | undefined>;
  getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined>; // Adicionado userId
  createLandingPage(lpData: InsertLandingPage): Promise<LandingPage>;
  updateLandingPage(id: number, lpData: Partial<Omit<InsertLandingPage, 'userId'>>, userId: number): Promise<LandingPage | undefined>;
  deleteLandingPage(id: number, userId: number): Promise<boolean>;

  createChatSession(userId: number, title?: string): Promise<ChatSession>;
  getChatSession(sessionId: number, userId: number): Promise<ChatSession | undefined>;
  getChatSessions(userId: number): Promise<ChatSession[]>;
  updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<ChatSession | undefined>;
  deleteChatSession(sessionId: number, userId: number): Promise<boolean>;
  addChatMessage(messageData: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]>;

  getDashboardData(userId: number, timeRange: string): Promise<any>; // Definir o tipo de retorno mais detalhado no frontend
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [newUser] = await db.insert(users).values({
      ...userData,
      password: hashedPassword,
    }).returning();
    if (!newUser) throw new Error("Falha ao criar usuário.");
    return newUser;
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async getCampaigns(userId: number, limit?: number): Promise<Campaign[]> {
    let query = db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }

  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .limit(1);
    return campaign;
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaignData).returning();
    if (!newCampaign) throw new Error("Falha ao criar campanha.");
    return newCampaign;
  }

  async updateCampaign(id: number, campaignData: Partial<Omit<InsertCampaign, 'userId'>>, userId: number): Promise<Campaign | undefined> {
    const [updatedCampaign] = await db.update(campaigns)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
    return result.rowCount > 0;
  }

  async getCreatives(userId: number, campaignId?: number): Promise<Creative[]> {
    const conditions = [eq(creatives.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(creatives.campaignId, campaignId));
    }
    return db.select().from(creatives).where(and(...conditions)).orderBy(desc(creatives.createdAt));
  }

  async getCreative(id: number, userId: number): Promise<Creative | undefined> {
    const [creative] = await db.select().from(creatives)
      .where(and(eq(creatives.id, id), eq(creatives.userId, userId)))
      .limit(1);
    return creative;
  }

  async createCreative(creativeData: InsertCreative): Promise<Creative> {
    const [newCreative] = await db.insert(creatives).values(creativeData).returning();
    if (!newCreative) throw new Error("Falha ao criar criativo.");
    return newCreative;
  }

  async updateCreative(id: number, creativeData: Partial<Omit<InsertCreative, 'userId'>>, userId: number): Promise<Creative | undefined> {
    const [updatedCreative] = await db.update(creatives)
      .set({ ...creativeData, updatedAt: new Date() })
      .where(and(eq(creatives.id, id), eq(creatives.userId, userId)))
      .returning();
    return updatedCreative;
  }

  async deleteCreative(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(creatives)
      .where(and(eq(creatives.id, id), eq(creatives.userId, userId)));
    return result.rowCount > 0;
  }

  async getMetricsForCampaign(campaignId: number, userId: number): Promise<Metric[]> {
    const campaign = await this.getCampaign(campaignId, userId);
    if (!campaign) {
        throw new Error("Campanha não encontrada ou não pertence ao usuário.");
    }
    return db.select().from(metrics)
      .where(eq(metrics.campaignId, campaignId))
      .orderBy(desc(metrics.date));
  }

  async createMetric(metricData: InsertMetric): Promise<Metric> {
    const [newMetric] = await db.insert(metrics).values(metricData).returning();
    if (!newMetric) throw new Error("Falha ao criar métrica.");
    return newMetric;
  }

  async getMessages(userId: number, contactNumber?: string): Promise<WhatsappMessage[]> {
    const conditions = [eq(whatsappMessages.userId, userId)];
    if (contactNumber) {
      conditions.push(eq(whatsappMessages.contactNumber, contactNumber));
    }
    return db.select().from(whatsappMessages).where(and(...conditions)).orderBy(desc(whatsappMessages.timestamp));
  }

  async createMessage(messageData: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(messageData).returning();
    if (!newMessage) throw new Error("Falha ao criar mensagem.");
    return newMessage;
  }

  async markMessageAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(whatsappMessages)
      .set({ isRead: true })
      .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId)));
    return result.rowCount > 0;
  }

  async getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]> {
    const allMessages = await db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.userId, userId))
      .orderBy(desc(whatsappMessages.timestamp));

    const contactsMap = new Map<string, { contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }>();

    for (const msg of allMessages) {
      if (!contactsMap.has(msg.contactNumber)) {
        contactsMap.set(msg.contactNumber, {
          contactNumber: msg.contactNumber,
          contactName: msg.contactName || null,
          lastMessage: msg.message,
          timestamp: new Date(msg.timestamp),
          unreadCount: 0,
        });
      }
      const contact = contactsMap.get(msg.contactNumber)!;
      if (!msg.isRead && msg.direction === 'incoming') {
        contact.unreadCount++;
      }
    }
    return Array.from(contactsMap.values()).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getCopies(userId: number, campaignId?: number): Promise<Copy[]> {
    const conditions = [eq(copies.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(copies.campaignId, campaignId));
    }
    return db.select().from(copies).where(and(...conditions)).orderBy(desc(copies.createdAt));
  }

  async createCopy(copyData: InsertCopy): Promise<Copy> {
    const [newCopy] = await db.insert(copies).values(copyData).returning();
    if (!newCopy) throw new Error("Falha ao criar copy.");
    return newCopy;
  }

  async updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<Copy | undefined> {
    const existingCopy = await db.select().from(copies).where(and(eq(copies.id, id), eq(copies.userId, userId))).limit(1);
    if(!existingCopy || existingCopy.length === 0) {
        return undefined;
    }
    const [updatedCopy] = await db.update(copies)
      .set(copyData)
      .where(and(eq(copies.id, id), eq(copies.userId, userId)))
      .returning();
    return updatedCopy;
  }

  async deleteCopy(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(copies)
      .where(and(eq(copies.id, id), eq(copies.userId, userId)));
    return result.rowCount > 0;
  }

  async getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]> {
    const conditions = [eq(alerts.userId, userId)];
    if (onlyUnread) {
      conditions.push(eq(alerts.isRead, false));
    }
    return db.select().from(alerts).where(and(...conditions)).orderBy(desc(alerts.createdAt));
  }

  async createAlert(alertData: InsertAlert): Promise<Alert> {
    const [newAlert] = await db.insert(alerts).values(alertData).returning();
    if (!newAlert) throw new Error("Falha ao criar alerta.");
    return newAlert;
  }

  async markAlertAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId), eq(alerts.isRead, false)));
    return result.rowCount > 0;
  }

  async getBudgets(userId: number, campaignId?: number): Promise<Budget[]> {
    const conditions = [eq(budgets.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(budgets.campaignId, campaignId));
    }
    return db.select().from(budgets).where(and(...conditions)).orderBy(desc(budgets.createdAt));
  }

  async createBudget(budgetData: InsertBudget): Promise<Budget> {
    const [newBudget] = await db.insert(budgets).values(budgetData).returning();
    if (!newBudget) throw new Error("Falha ao criar orçamento.");
    return newBudget;
  }

  async updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined> {
     const existingBudget = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1);
    if(!existingBudget || existingBudget.length === 0) {
        return undefined;
    }
    const [updatedBudget] = await db.update(budgets)
      .set(budgetData)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return updatedBudget;
  }

  async getLandingPages(userId: number): Promise<LandingPage[]> {
    return db.select().from(landingPages)
      .where(eq(landingPages.userId, userId))
      .orderBy(desc(landingPages.createdAt));
  }

  async getLandingPage(id: number, userId: number): Promise<LandingPage | undefined> {
    const [lp] = await db.select().from(landingPages)
      .where(and(eq(landingPages.id, id), eq(landingPages.userId, userId)))
      .limit(1);
    return lp;
  }

  async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> {
    const [lp] = await db.select().from(landingPages)
      .where(eq(landingPages.slug, slug))
      .limit(1);
    return lp;
  }

  async getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined> {
    const [lp] = await db.select().from(landingPages)
      .where(and(eq(landingPages.studioProjectId, studioProjectId), eq(landingPages.userId, userId))) // Adicionado userId na query
      .limit(1);
    return lp;
  }

  async createLandingPage(lpData: InsertLandingPage): Promise<LandingPage> {
    const [newLP] = await db.insert(landingPages).values(lpData).returning();
    if (!newLP) throw new Error("Falha ao criar landing page.");
    return newLP;
  }

  async updateLandingPage(id: number, lpData: Partial<Omit<InsertLandingPage, 'userId'>>, userId: number): Promise<LandingPage | undefined> {
    const [updatedLP] = await db.update(landingPages)
      .set({ ...lpData, updatedAt: new Date() })
      .where(and(eq(landingPages.id, id), eq(landingPages.userId, userId)))
      .returning();
    return updatedLP;
  }

  async deleteLandingPage(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(landingPages)
      .where(and(eq(landingPages.id, id), eq(landingPages.userId, userId)));
    return result.rowCount > 0;
  }

  async createChatSession(userId: number, title: string = 'Nova Conversa'): Promise<ChatSession> {
    const [newSession] = await db.insert(chatSessions).values({ userId, title, createdAt: new Date(), updatedAt: new Date() }).returning();
    if (!newSession) throw new Error("Falha ao criar nova sessão de chat.");
    return newSession;
  }

  async getChatSession(sessionId: number, userId: number): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).limit(1);
    return session;
  }

  async getChatSessions(userId: number): Promise<ChatSession[]> {
    return db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.updatedAt));
  }

  async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<ChatSession | undefined> {
    const [updatedSession] = await db.update(chatSessions).set({ title: newTitle, updatedAt: new Date() }).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).returning();
    return updatedSession;
  }

  async deleteChatSession(sessionId: number, userId: number): Promise<boolean> {
    const [deletedSession] = await db.delete(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).returning();
    return !!deletedSession;
  }

  async addChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values({ ...messageData, timestamp: new Date() }).returning();
    if (!newMessage) throw new Error("Falha ao adicionar mensagem ao chat.");
    // Atualiza o timestamp da sessão para que as sessões mais recentes apareçam no topo
    await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, messageData.sessionId));
    return newMessage;
  }

  async getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]> {
    const sessionExists = await db.select({ id: chatSessions.id }).from(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).limit(1);
    if (!sessionExists.length) {
      return [];
    }
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.timestamp);
  }

  // --- Funções para o Dashboard ---
  async getDashboardData(userId: number, timeRange: string = '30d') {
    // 1. Métricas Principais (KPIs)
    const activeCampaignsResult = await db.select({ count: count() }).from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    const activeCampaigns = activeCampaignsResult[0]?.count || 0;

    const totalSpentResult = await db.select({ total: sum(budgets.spentAmount) })
      .from(budgets)
      .where(eq(budgets.userId, userId));
    const totalSpent = parseFloat(totalSpentResult[0]?.total || '0') || 0;

    const totalConversionsResult = await db.select({ total: sum(metrics.conversions) })
      .from(metrics)
      .where(eq(metrics.userId, userId));
    const conversions = parseFloat(totalConversionsResult[0]?.total || '0') || 0;

    const totalRevenueResult = await db.select({ total: sum(metrics.revenue) })
      .from(metrics)
      .where(eq(metrics.userId, userId));
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total || '0') || 0;

    const totalCostResult = await db.select({ total: sum(metrics.cost) })
      .from(metrics)
      .where(eq(metrics.userId, userId));
    const totalCost = parseFloat(totalCostResult[0]?.total || '0') || 0;

    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;

    const totalImpressionsResult = await db.select({ total: sum(metrics.impressions) })
      .from(metrics)
      .where(eq(metrics.userId, userId));
    const impressions = parseFloat(totalImpressionsResult[0]?.total || '0') || 0;

    const totalClicksResult = await db.select({ total: sum(metrics.clicks) })
      .from(metrics)
      .where(eq(metrics.userId, userId));
    const clicks = parseFloat(totalClicksResult[0]?.total || '0') || 0;

    const ctr = clicks > 0 && impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 && totalSpent > 0 ? parseFloat((totalSpent / clicks).toFixed(2)) : 0;

    const metricsData = {
      activeCampaigns: activeCampaigns,
      totalSpent: totalSpent,
      conversions: conversions,
      avgROI: avgROI,
      impressions: impressions,
      clicks: clicks,
      ctr: ctr,
      cpc: cpc
    };

    // 2. Tendências (simuladas, pois histórico real é complexo de gerar sem dados)
    const campaignsChange = parseFloat((Math.random() * 20 - 10).toFixed(1)); // +/- 10%
    const spentChange = parseFloat((Math.random() * 20 - 10).toFixed(1)); // +/- 10%
    const conversionsChange = parseFloat((Math.random() * 30 - 15).toFixed(1)); // +/- 15%
    const roiChange = parseFloat((Math.random() * 10 - 5).toFixed(1)); // +/- 5%

    const trends = {
      campaignsChange,
      spentChange,
      conversionsChange,
      roiChange,
    };

    // 3. Campanhas Recentes
    const recentCampaignsRaw = await db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt))
      .limit(3);

    const recentCampaigns = recentCampaignsRaw.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || 'Nenhuma descrição',
      status: c.status,
      platforms: c.platforms || [], // Já é JSONB, então deve ser array
      budget: parseFloat(c.budget ? c.budget.toString() : '0') || 0, // Converter Decimal para Number
      spent: parseFloat(c.dailyBudget ? c.dailyBudget.toString() : '0') || 0, // Usando dailyBudget como "spent" para o mock
      performance: Math.floor(Math.random() * (95 - 60 + 1)) + 60 // Performance aleatória entre 60-95%
    }));

    // 4. Dados para os Gráficos (ainda simulados, mas a partir do backend)
    const timeSeriesData = generateSimulatedLineChartData('Desempenho Geral', 1000, timeRange === '30d' ? 30 : 7, 50, chartColors.palette[0]);
    const channelPerformanceData = generateSimulatedDoughnutChartData(['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 20, 10, chartColors.palette);
    const conversionData = generateSimulatedLineChartData('Conversões', 200, timeRange === '30d' ? 30 : 7, 30, chartColors.palette[1]);
    const roiData = generateSimulatedBarChartData('ROI (%)', ['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 250, 100, chartColors.palette);

    return {
      metrics: metricsData,
      recentCampaigns: recentCampaigns,
      alertCount: (await db.select({ count: count() }).from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.isRead, false))))[0]?.count || 0,
      trends: trends,
      timeSeriesData: timeSeriesData,
      channelPerformanceData: channelPerformanceData,
      conversionData: conversionData,
      roiData: roiData,
    };
  }
}

export const storage = new DatabaseStorage();
