import dotenv from "dotenv";
// Não é estritamente necessário carregar dotenv aqui se já está no index.ts ou no migrate-deploy.ts,
// mas não causa problema.
dotenv.config();

import { db } from './db'; // Assumindo que db.ts existe e exporta a instância de drizzle
import {
  users, campaigns, creatives, metrics, whatsappMessages, copies, alerts, budgets, landingPages,
  chatSessions, chatMessages, funnels, funnelStages, // Adicionado funnels e funnelStages
  type User, type InsertUser, type Campaign, type InsertCampaign,
  type Creative, type InsertCreative, type Metric, type InsertMetric,
  type WhatsappMessage, type InsertWhatsappMessage, type Copy, type InsertCopy,
  type Alert, type InsertAlert, type Budget, type InsertBudget,
  type LandingPage, type InsertLandingPage,
  type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage,
  type Funnel, type InsertFunnel, type FunnelStage, type InsertFunnelStage // Adicionado tipos de Funil
} from '../shared/schema';

import { eq, count, sum, sql, desc, and, or, asc } from 'drizzle-orm';

import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

function convertBudgetData(data: any): any {
  const converted = { ...data };
  if (typeof converted.totalBudget === 'number') {
    converted.totalBudget = String(converted.totalBudget);
  }
  if (typeof converted.spentAmount === 'number') {
    converted.spentAmount = String(converted.spentAmount);
  }
  if (typeof converted.budget === 'number') {
    converted.budget = String(converted.budget);
  }
  if (typeof converted.dailyBudget === 'number') {
    converted.dailyBudget = String(converted.dailyBudget);
  }
  if (typeof converted.avgTicket === 'number') {
    converted.avgTicket = String(converted.avgTicket);
  }
  return converted;
}

const chartColors = {
  palette: [
    'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
    'rgba(200, 200, 200, 1)'
  ],
  background: [
    'rgba(75, 192, 192, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)',
    'rgba(255, 206, 86, 0.2)', 'rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64, 0.2)',
    'rgba(200, 200, 200, 0.2)'
  ]
};

function generateSimulatedLineChartData(label: string, startValue: number, count: number, maxFluctuation: number, color: string): { labels: string[], datasets: { label: string, data: number[], borderColor: string, backgroundColor: string, fill: boolean, tension: number }[] } {
  const data = [];
  const labels = [];
  let currentValue = startValue;
  for (let i = 0; i < count; i++) {
    labels.push(`Dia ${i + 1}`);
    data.push(Math.round(currentValue));
    currentValue += (Math.random() * maxFluctuation * 2) - maxFluctuation;
    if (currentValue < 0) currentValue = 0;
  }
  return {
    labels: labels,
    datasets: [{ label: label, data: data, borderColor: color, backgroundColor: color.replace('1)', '0.2)'), fill: true, tension: 0.4 }],
  };
}

function generateSimulatedBarChartData(label: string, categories: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { label: string, data: number[], backgroundColor: string[] }[] } {
  const data = categories.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation));
  return {
    labels: categories,
    datasets: [{ label: label, data: data, backgroundColor: colors }],
  };
}

function generateSimulatedDoughnutChartData(labels: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { data: number[], backgroundColor: string[], borderWidth: number }[] } {
  const data = labels.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation));
  return {
    labels: labels,
    datasets: [{ data: data, backgroundColor: colors.map(color => color.replace('1)', '0.8)')), borderWidth: 0 }],
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
  createMetric(metricData: InsertMetric): Promise<Metric>;

  getMessages(userId: number, contactNumber?: string): Promise<WhatsappMessage[]>;
  createMessage(messageData: InsertWhatsappMessage): Promise<WhatsappMessage>;
  markMessageAsRead(id: number, userId: number): Promise<boolean>;
  getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]>;

  getCopies(userId: number, campaignId?: number): Promise<Copy[]>;
  createCopy(copy: InsertCopy): Promise<Copy>;
  deleteCopy(id: number, userId: number): Promise<boolean>;
  updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<Copy | undefined>;

  getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]>;
  createAlert(alertData: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: number, userId: number): Promise<boolean>;

  getBudgets(userId: number, campaignId?: number): Promise<Budget[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined>;

  getLandingPages(userId: number): Promise<LandingPage[]>;
  getLandingPage(id: number, userId: number): Promise<LandingPage | undefined>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | undefined>;
  getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined>;
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
  
  getDashboardData(userId: number, timeRange: string): Promise<any>;

  // Métodos para Funis
  createFunnel(funnelData: InsertFunnel): Promise<Funnel>;
  getFunnels(userId: number): Promise<Funnel[]>;
  getFunnelWithStages(funnelId: number, userId: number): Promise<(Funnel & { stages: FunnelStage[] }) | undefined>;
  updateFunnel(funnelId: number, funnelData: Partial<InsertFunnel>, userId: number): Promise<Funnel | undefined>;
  deleteFunnel(funnelId: number, userId: number): Promise<boolean>;
  
  // Métodos para Etapas do Funil
  createFunnelStage(stageData: InsertFunnelStage, userId: number): Promise<FunnelStage | undefined>; // userId para verificar permissão no funil pai
  getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]>;
  updateFunnelStage(stageId: number, stageData: Partial<InsertFunnelStage>, userId: number): Promise<FunnelStage | undefined>;
  deleteFunnelStage(stageId: number, userId: number): Promise<boolean>;
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
      return query.limit(limit);
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
    const convertedData = convertBudgetData(campaignData);
    const [newCampaign] = await db.insert(campaigns).values(convertedData).returning();
    if (!newCampaign) throw new Error("Falha ao criar campanha.");
    return newCampaign;
  }

  async updateCampaign(id: number, campaignData: Partial<Omit<InsertCampaign, 'userId'>>, userId: number): Promise<Campaign | undefined> {
    const convertedData = convertBudgetData(campaignData);
    const [updatedCampaign] = await db.update(campaigns)
      .set({ ...convertedData, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
    return (result.rowCount ?? 0) > 0;
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
    return (result.rowCount ?? 0) > 0;
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
      .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId), eq(whatsappMessages.isRead, false)));
    return (result.rowCount ?? 0) > 0;
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
    return (result.rowCount ?? 0) > 0;
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
    return (result.rowCount ?? 0) > 0;
  }

  async getBudgets(userId: number, campaignId?: number): Promise<Budget[]> {
    const conditions = [eq(budgets.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(budgets.campaignId, campaignId));
    }
    return db.select().from(budgets).where(and(...conditions)).orderBy(desc(budgets.createdAt));
  }

  async createBudget(budgetData: InsertBudget): Promise<Budget> {
    const convertedData = convertBudgetData(budgetData);
    const [newBudget] = await db.insert(budgets).values(convertedData).returning();
    if (!newBudget) throw new Error("Falha ao criar orçamento.");
    return newBudget;
  }

  async updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined> {
     const existingBudget = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1);
    if(!existingBudget || existingBudget.length === 0) {
        return undefined;
    }
    const convertedData = convertBudgetData(budgetData);
    const [updatedBudget] = await db.update(budgets)
      .set(convertedData)
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
      .where(and(eq(landingPages.studioProjectId, studioProjectId), eq(landingPages.userId, userId)))
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
    return (result.rowCount ?? 0) > 0;
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
  
  async getDashboardData(userId: number, timeRange: string = '30d') {
    const now = new Date();
    let startDate = new Date();
    if (timeRange === '7d') {
        startDate.setDate(now.getDate() - 7);
    } else { 
        startDate.setDate(now.getDate() - 30);
    }

    const metricsTimeCondition = and(
        eq(metrics.userId, userId),
        sql`${metrics.date} >= ${startDate}`
    );
    const budgetsUserCondition = eq(budgets.userId, userId);

    const activeCampaignsResult = await db.select({ count: count() }).from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    const activeCampaigns = activeCampaignsResult[0]?.count || 0;

    const totalSpentResult = await db.select({
        total: sum(sql<number>`CAST(${budgets.spentAmount} AS DECIMAL)`)
    })
      .from(budgets)
      .where(budgetsUserCondition);
    const totalSpent = parseFloat(totalSpentResult[0]?.total || '0') || 0;

    const totalConversionsResult = await db.select({ total: sum(metrics.conversions) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const conversions = parseFloat(totalConversionsResult[0]?.total || '0') || 0;

    const totalRevenueResult = await db.select({ total: sum(metrics.revenue) })
      .from(metrics)
      .where(metricsTimeCondition);
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total || '0') || 0;

    const totalCostResult = await db.select({ total: sum(metrics.cost) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const totalCost = parseFloat(totalCostResult[0]?.total || '0') || 0;

    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;

    const totalImpressionsResult = await db.select({ total: sum(metrics.impressions) })
      .from(metrics)
      .where(metricsTimeCondition);
    const impressions = parseFloat(totalImpressionsResult[0]?.total || '0') || 0;

    const totalClicksResult = await db.select({ total: sum(metrics.clicks) })
      .from(metrics)
      .where(metricsTimeCondition);
    const clicks = parseFloat(totalClicksResult[0]?.total || '0') || 0;

    const ctr = clicks > 0 && impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 && totalCost > 0 ? parseFloat((totalCost / clicks).toFixed(2)) : 0;

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

    const campaignsChange = parseFloat((Math.random() * 20 - 10).toFixed(1)); 
    const spentChange = parseFloat((Math.random() * 20 - 10).toFixed(1)); 
    const conversionsChange = parseFloat((Math.random() * 30 - 15).toFixed(1));
    const roiChange = parseFloat((Math.random() * 10 - 5).toFixed(1)); 

    const trends = { campaignsChange, spentChange, conversionsChange, roiChange };

    const recentCampaignsRaw = await db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt))
      .limit(3);

    const recentCampaigns = recentCampaignsRaw.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || 'Nenhuma descrição',
      status: c.status,
      platforms: c.platforms || [], 
      budget: parseFloat(c.budget || '0') || 0,
      spent: parseFloat(c.dailyBudget || '0') || 0, 
      performance: Math.floor(Math.random() * (95 - 60 + 1)) + 60
    }));

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

  // --- Métodos para Funis ---
  async createFunnel(funnelData: InsertFunnel): Promise<Funnel> {
    const [newFunnel] = await db.insert(funnels).values(funnelData).returning();
    if (!newFunnel) throw new Error("Falha ao criar funil.");
    return newFunnel;
  }

  async getFunnels(userId: number): Promise<Funnel[]> {
    return db.select().from(funnels).where(eq(funnels.userId, userId)).orderBy(desc(funnels.createdAt));
  }

  async getFunnelWithStages(funnelId: number, userId: number): Promise<(Funnel & { stages: FunnelStage[] }) | undefined> {
    const [funnelResult] = await db.select().from(funnels)
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .limit(1);

    if (!funnelResult) return undefined;

    const stagesResult = await db.select().from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(asc(funnelStages.order)); // Ordenar etapas pela coluna 'order'

    return { ...funnelResult, stages: stagesResult };
  }
  
  async updateFunnel(funnelId: number, funnelData: Partial<InsertFunnel>, userId: number): Promise<Funnel | undefined> {
    const [updatedFunnel] = await db.update(funnels)
      .set({ ...funnelData, updatedAt: new Date() })
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .returning();
    return updatedFunnel;
  }

  async deleteFunnel(funnelId: number, userId: number): Promise<boolean> {
    const result = await db.delete(funnels)
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // --- Métodos para Etapas do Funil ---
  async createFunnelStage(stageData: InsertFunnelStage, userId: number): Promise<FunnelStage | undefined> {
    // Verificar se o funil pai pertence ao usuário
    const funnel = await db.select({ id: funnels.id, userId: funnels.userId }).from(funnels)
        .where(eq(funnels.id, stageData.funnelId!)) // funnelId é notNull na tabela, mas opcional em InsertFunnelStage por agora
        .limit(1);
    if (!funnel[0] || funnel[0].userId !== userId) {
      throw new Error("Funil não encontrado ou não pertence ao usuário.");
    }

    const [newStage] = await db.insert(funnelStages).values(stageData).returning();
    if (!newStage) throw new Error("Falha ao criar etapa do funil.");
    return newStage;
  }

  async getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]> {
    const funnel = await db.select({ id: funnels.id, userId: funnels.userId }).from(funnels)
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .limit(1);
    if (!funnel[0]) {
      throw new Error("Funil não encontrado ou não pertence ao usuário.");
    }
    return db.select().from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(asc(funnelStages.order));
  }

  async updateFunnelStage(stageId: number, stageData: Partial<InsertFunnelStage>, userId: number): Promise<FunnelStage | undefined> {
    // Para atualizar, primeiro pegamos a etapa para verificar o funil pai
    const [existingStage] = await db.select({ funnelId: funnelStages.funnelId }).from(funnelStages)
      .where(eq(funnelStages.id, stageId))
      .limit(1);

    if (!existingStage) throw new Error("Etapa do funil não encontrada.");

    // Verificar permissão no funil pai
    const funnel = await db.select({ id: funnels.id, userId: funnels.userId }).from(funnels)
      .where(and(eq(funnels.id, existingStage.funnelId), eq(funnels.userId, userId)))
      .limit(1);
    if (!funnel[0]) {
      throw new Error("Você não tem permissão para atualizar esta etapa do funil.");
    }
    
    const [updatedStage] = await db.update(funnelStages)
      .set({ ...stageData, updatedAt: new Date() })
      .where(eq(funnelStages.id, stageId))
      .returning();
    return updatedStage;
  }

  async deleteFunnelStage(stageId: number, userId: number): Promise<boolean> {
     // Para deletar, primeiro pegamos a etapa para verificar o funil pai
    const [existingStage] = await db.select({ funnelId: funnelStages.funnelId }).from(funnelStages)
      .where(eq(funnelStages.id, stageId))
      .limit(1);

    if (!existingStage) return false; // Ou throw new Error("Etapa do funil não encontrada.");

    // Verificar permissão no funil pai
    const funnel = await db.select({ id: funnels.id, userId: funnels.userId }).from(funnels)
      .where(and(eq(funnels.id, existingStage.funnelId), eq(funnels.userId, userId)))
      .limit(1);

    if (!funnel[0]) {
      throw new Error("Você não tem permissão para excluir esta etapa do funil.");
    }

    const result = await db.delete(funnelStages)
      .where(eq(funnelStages.id, stageId));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
