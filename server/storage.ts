import dotenv from "dotenv";
dotenv.config();

import { db } from './db';
import * as schema from '../shared/schema'; // Alteração aqui

import { eq, count, sum, sql, desc, and, or } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

// Função auxiliar para converter números para strings nos budgets (útil para INSERÇÃO/ATUALIZAÇÃO)
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

function generateSimulatedLineChartData(label: string, startValue: number, countData: number, maxFluctuation: number, color: string): { labels: string[], datasets: { label: string, data: number[], borderColor: string, backgroundColor: string, fill: boolean, tension: number }[] } {
  const data = [];
  const labels = [];
  let currentValue = startValue;
  for (let i = 0; i < countData; i++) {
    labels.push(`Dia ${i + 1}`);
    data.push(Math.round(currentValue));
    currentValue += (Math.random() * maxFluctuation * 2) - maxFluctuation;
    if (currentValue < 0) currentValue = 0;
  }
  return {
    labels: labels,
    datasets: [{
      label: label, data: data, borderColor: color, backgroundColor: color.replace('1)', '0.2)'), fill: true, tension: 0.4,
    }],
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

// Usar os tipos importados via schema.*
export interface IStorage {
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;

  getCampaigns(userId: number, limit?: number): Promise<schema.Campaign[]>;
  getCampaign(id: number, userId: number): Promise<schema.Campaign | undefined>;
  createCampaign(campaign: schema.InsertCampaign): Promise<schema.Campaign>;
  updateCampaign(id: number, campaign: Partial<Omit<schema.InsertCampaign, 'userId'>>, userId: number): Promise<schema.Campaign | undefined>;
  deleteCampaign(id: number, userId: number): Promise<boolean>;

  getCreatives(userId: number, campaignId?: number): Promise<schema.Creative[]>;
  getCreative(id: number, userId: number): Promise<schema.Creative | undefined>;
  createCreative(creative: schema.InsertCreative): Promise<schema.Creative>;
  updateCreative(id: number, creative: Partial<Omit<schema.InsertCreative, 'userId'>>, userId: number): Promise<schema.Creative | undefined>;
  deleteCreative(id: number, userId: number): Promise<boolean>;

  getMetricsForCampaign(campaignId: number, userId: number): Promise<schema.Metric[]>;
  createMetric(metricData: schema.InsertMetric): Promise<schema.Metric>;

  getMessages(userId: number, contactNumber?: string): Promise<schema.WhatsappMessage[]>; // Alteração aqui
  createMessage(messageData: schema.InsertWhatsappMessage): Promise<schema.WhatsappMessage>; // Alteração aqui
  markMessageAsRead(id: number, userId: number): Promise<boolean>;
  getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]>;

  getCopies(userId: number, campaignId?: number): Promise<schema.Copy[]>;
  createCopy(copy: schema.InsertCopy): Promise<schema.Copy>;
  deleteCopy(id: number, userId: number): Promise<boolean>;
  updateCopy(id: number, copyData: Partial<Omit<schema.InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<schema.Copy | undefined>;

  getAlerts(userId: number, onlyUnread?: boolean): Promise<schema.Alert[]>;
  createAlert(alertData: schema.InsertAlert): Promise<schema.Alert>;
  markAlertAsRead(id: number, userId: number): Promise<boolean>;

  getBudgets(userId: number, campaignId?: number): Promise<schema.Budget[]>;
  createBudget(budget: schema.InsertBudget): Promise<schema.Budget>;
  updateBudget(id: number, budgetData: Partial<Omit<schema.InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<schema.Budget | undefined>;

  getLandingPages(userId: number): Promise<schema.LandingPage[]>;
  getLandingPage(id: number, userId: number): Promise<schema.LandingPage | undefined>;
  getLandingPageBySlug(slug: string): Promise<schema.LandingPage | undefined>;
  getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<schema.LandingPage | undefined>;
  createLandingPage(lpData: schema.InsertLandingPage): Promise<schema.LandingPage>;
  updateLandingPage(id: number, lpData: Partial<Omit<schema.InsertLandingPage, 'userId'>>, userId: number): Promise<schema.LandingPage | undefined>;
  deleteLandingPage(id: number, userId: number): Promise<boolean>;

  createChatSession(userId: number, title?: string): Promise<schema.ChatSession>;
  getChatSession(sessionId: number, userId: number): Promise<schema.ChatSession | undefined>;
  getChatSessions(userId: number): Promise<schema.ChatSession[]>;
  updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<schema.ChatSession | undefined>;
  deleteChatSession(sessionId: number, userId: number): Promise<boolean>;
  addChatMessage(messageData: schema.InsertChatMessage): Promise<schema.ChatMessage>;
  getChatMessages(sessionId: number, userId: number): Promise<schema.ChatMessage[]>;

  getDashboardData(userId: number, timeRange: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<schema.User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async createUser(userData: schema.InsertUser): Promise<schema.User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [newUser] = await db.insert(schema.users).values({
      ...userData,
      password: hashedPassword,
    }).returning();
    if (!newUser) throw new Error("Falha ao criar usuário.");
    return newUser;
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async getCampaigns(userId: number, limit?: number): Promise<schema.Campaign[]> {
    let query = db.select().from(schema.campaigns)
      .where(eq(schema.campaigns.userId, userId))
      .orderBy(desc(schema.campaigns.createdAt));
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getCampaign(id: number, userId: number): Promise<schema.Campaign | undefined> {
    const [campaign] = await db.select().from(schema.campaigns)
      .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)))
      .limit(1);
    return campaign;
  }

  async createCampaign(campaignData: schema.InsertCampaign): Promise<schema.Campaign> {
    const convertedData = convertBudgetData(campaignData);
    const [newCampaign] = await db.insert(schema.campaigns).values(convertedData).returning();
    if (!newCampaign) throw new Error("Falha ao criar campanha.");
    return newCampaign;
  }

  async updateCampaign(id: number, campaignData: Partial<Omit<schema.InsertCampaign, 'userId'>>, userId: number): Promise<schema.Campaign | undefined> {
    const convertedData = convertBudgetData(campaignData);
    const [updatedCampaign] = await db.update(schema.campaigns)
      .set({ ...convertedData, updatedAt: new Date() })
      .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(schema.campaigns)
      .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getCreatives(userId: number, campaignId?: number): Promise<schema.Creative[]> {
    const conditions = [eq(schema.creatives.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(schema.creatives.campaignId, campaignId));
    }
    return db.select().from(schema.creatives).where(and(...conditions)).orderBy(desc(schema.creatives.createdAt));
  }

  async getCreative(id: number, userId: number): Promise<schema.Creative | undefined> {
    const [creative] = await db.select().from(schema.creatives)
      .where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)))
      .limit(1);
    return creative;
  }

  async createCreative(creativeData: schema.InsertCreative): Promise<schema.Creative> {
    const [newCreative] = await db.insert(schema.creatives).values(creativeData).returning();
    if (!newCreative) throw new Error("Falha ao criar criativo.");
    return newCreative;
  }

  async updateCreative(id: number, creativeData: Partial<Omit<schema.InsertCreative, 'userId'>>, userId: number): Promise<schema.Creative | undefined> {
    const [updatedCreative] = await db.update(schema.creatives)
      .set({ ...creativeData, updatedAt: new Date() })
      .where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)))
      .returning();
    return updatedCreative;
  }

  async deleteCreative(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(schema.creatives)
      .where(and(eq(schema.creatives.id, id), eq(schema.creatives.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getMetricsForCampaign(campaignId: number, userId: number): Promise<schema.Metric[]> {
    const campaign = await this.getCampaign(campaignId, userId);
    if (!campaign) {
        throw new Error("Campanha não encontrada ou não pertence ao usuário.");
    }
    return db.select().from(schema.metrics)
      .where(eq(schema.metrics.campaignId, campaignId))
      .orderBy(desc(schema.metrics.date));
  }

  async createMetric(metricData: schema.InsertMetric): Promise<schema.Metric> {
    const [newMetric] = await db.insert(schema.metrics).values(metricData).returning();
    if (!newMetric) throw new Error("Falha ao criar métrica.");
    return newMetric;
  }

  async getMessages(userId: number, contactNumber?: string): Promise<schema.WhatsappMessage[]> { // Alteração aqui
    const conditions = [eq(schema.whatsappMessages.userId, userId)]; // Alteração aqui
    if (contactNumber) {
      conditions.push(eq(schema.whatsappMessages.contactNumber, contactNumber)); // Alteração aqui
    }
    return db.select().from(schema.whatsappMessages).where(and(...conditions)).orderBy(desc(schema.whatsappMessages.timestamp)); // Alteração aqui
  }

  async createMessage(messageData: schema.InsertWhatsappMessage): Promise<schema.WhatsappMessage> { // Alteração aqui
    const [newMessage] = await db.insert(schema.whatsappMessages).values(messageData).returning(); // Alteração aqui
    if (!newMessage) throw new Error("Falha ao criar mensagem.");
    return newMessage;
  }

  async markMessageAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(schema.whatsappMessages) // Alteração aqui
      .set({ isRead: true })
      .where(and(eq(schema.whatsappMessages.id, id), eq(schema.whatsappMessages.userId, userId), eq(schema.whatsappMessages.isRead, false))); // Alteração aqui
    return (result.rowCount ?? 0) > 0;
  }

  async getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]> {
    const allMessages = await db.select().from(schema.whatsappMessages) // Alteração aqui
      .where(eq(schema.whatsappMessages.userId, userId)) // Alteração aqui
      .orderBy(desc(schema.whatsappMessages.timestamp)); // Alteração aqui

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

  async getCopies(userId: number, campaignId?: number): Promise<schema.Copy[]> {
    const conditions = [eq(schema.copies.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(schema.copies.campaignId, campaignId));
    }
    return db.select().from(schema.copies).where(and(...conditions)).orderBy(desc(schema.copies.createdAt));
  }

  async createCopy(copyData: schema.InsertCopy): Promise<schema.Copy> {
    const [newCopy] = await db.insert(schema.copies).values(copyData).returning();
    if (!newCopy) throw new Error("Falha ao criar copy.");
    return newCopy;
  }

  async updateCopy(id: number, copyData: Partial<Omit<schema.InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<schema.Copy | undefined> {
    const existingCopy = await db.select().from(schema.copies).where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId))).limit(1);
    if(!existingCopy || existingCopy.length === 0) {
        return undefined;
    }
    const [updatedCopy] = await db.update(schema.copies)
      .set(copyData)
      .where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId)))
      .returning();
    return updatedCopy;
  }

  async deleteCopy(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(schema.copies)
      .where(and(eq(schema.copies.id, id), eq(schema.copies.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAlerts(userId: number, onlyUnread?: boolean): Promise<schema.Alert[]> {
    const conditions = [eq(schema.alerts.userId, userId)];
    if (onlyUnread) {
      conditions.push(eq(schema.alerts.isRead, false));
    }
    return db.select().from(schema.alerts).where(and(...conditions)).orderBy(desc(schema.alerts.createdAt));
  }

  async createAlert(alertData: schema.InsertAlert): Promise<schema.Alert> {
    const [newAlert] = await db.insert(schema.alerts).values(alertData).returning();
    if (!newAlert) throw new Error("Falha ao criar alerta.");
    return newAlert;
  }

  async markAlertAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(schema.alerts)
      .set({ isRead: true })
      .where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId), eq(schema.alerts.isRead, false)));
    return (result.rowCount ?? 0) > 0;
  }

  async getBudgets(userId: number, campaignId?: number): Promise<schema.Budget[]> {
    const conditions = [eq(schema.budgets.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(eq(schema.budgets.campaignId, campaignId));
    }
    return db.select().from(schema.budgets).where(and(...conditions)).orderBy(desc(schema.budgets.createdAt));
  }

  async createBudget(budgetData: schema.InsertBudget): Promise<schema.Budget> {
    const convertedData = convertBudgetData(budgetData);
    const [newBudget] = await db.insert(schema.budgets).values(convertedData).returning();
    if (!newBudget) throw new Error("Falha ao criar orçamento.");
    return newBudget;
  }

  async updateBudget(id: number, budgetData: Partial<Omit<schema.InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<schema.Budget | undefined> {
     const existingBudget = await db.select().from(schema.budgets).where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId))).limit(1);
    if(!existingBudget || existingBudget.length === 0) {
        return undefined;
    }
    const convertedData = convertBudgetData(budgetData);
    const [updatedBudget] = await db.update(schema.budgets)
      .set(convertedData)
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)))
      .returning();
    return updatedBudget;
  }

  async getLandingPages(userId: number): Promise<schema.LandingPage[]> {
    return db.select().from(schema.landingPages)
      .where(eq(schema.landingPages.userId, userId))
      .orderBy(desc(schema.landingPages.createdAt));
  }

  async getLandingPage(id: number, userId: number): Promise<schema.LandingPage | undefined> {
    const [lp] = await db.select().from(schema.landingPages)
      .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId)))
      .limit(1);
    return lp;
  }

  async getLandingPageBySlug(slug: string): Promise<schema.LandingPage | undefined> {
    const [lp] = await db.select().from(schema.landingPages)
      .where(eq(schema.landingPages.slug, slug))
      .limit(1);
    return lp;
  }

  async getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<schema.LandingPage | undefined> {
    const [lp] = await db.select().from(schema.landingPages)
      .where(and(eq(schema.landingPages.studioProjectId, studioProjectId), eq(schema.landingPages.userId, userId)))
      .limit(1);
    return lp;
  }

  async createLandingPage(lpData: schema.InsertLandingPage): Promise<schema.LandingPage> {
    const [newLP] = await db.insert(schema.landingPages).values(lpData).returning();
    if (!newLP) throw new Error("Falha ao criar landing page.");
    return newLP;
  }

  async updateLandingPage(id: number, lpData: Partial<Omit<schema.InsertLandingPage, 'userId'>>, userId: number): Promise<schema.LandingPage | undefined> {
    const [updatedLP] = await db.update(schema.landingPages)
      .set({ ...lpData, updatedAt: new Date() })
      .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId)))
      .returning();
    return updatedLP;
  }

  async deleteLandingPage(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(schema.landingPages)
      .where(and(eq(schema.landingPages.id, id), eq(schema.landingPages.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async createChatSession(userId: number, title: string = 'Nova Conversa'): Promise<schema.ChatSession> {
    const [newSession] = await db.insert(schema.chatSessions).values({ userId, title, createdAt: new Date(), updatedAt: new Date() }).returning();
    if (!newSession) throw new Error("Falha ao criar nova sessão de chat.");
    return newSession;
  }

  async getChatSession(sessionId: number, userId: number): Promise<schema.ChatSession | undefined> {
    const [session] = await db.select().from(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).limit(1);
    return session;
  }

  async getChatSessions(userId: number): Promise<schema.ChatSession[]> {
    return db.select().from(schema.chatSessions).where(eq(schema.chatSessions.userId, userId)).orderBy(desc(schema.chatSessions.updatedAt));
  }

  async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<schema.ChatSession | undefined> {
    const [updatedSession] = await db.update(schema.chatSessions).set({ title: newTitle, updatedAt: new Date() }).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning();
    return updatedSession;
  }

  async deleteChatSession(sessionId: number, userId: number): Promise<boolean> {
    const [deletedSession] = await db.delete(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).returning();
    return !!deletedSession;
  }

  async addChatMessage(messageData: schema.InsertChatMessage): Promise<schema.ChatMessage> {
    const [newMessage] = await db.insert(schema.chatMessages).values({ ...messageData, timestamp: new Date() }).returning();
    if (!newMessage) throw new Error("Falha ao adicionar mensagem ao chat.");
    await db.update(schema.chatSessions).set({ updatedAt: new Date() }).where(eq(schema.chatSessions.id, messageData.sessionId));
    return newMessage;
  }

  async getChatMessages(sessionId: number, userId: number): Promise<schema.ChatMessage[]> {
    const sessionExists = await db.select({ id: schema.chatSessions.id }).from(schema.chatSessions).where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))).limit(1);
    if (!sessionExists.length) {
      return [];
    }
    return db.select().from(schema.chatMessages).where(eq(schema.chatMessages.sessionId, sessionId)).orderBy(schema.chatMessages.timestamp);
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
        eq(schema.metrics.userId, userId),
        sql`${schema.metrics.date} >= ${startDate}`
    );

    const budgetsUserCondition = eq(schema.budgets.userId, userId);

    const activeCampaignsResult = await db.select({ count: count() }).from(schema.campaigns)
      .where(and(eq(schema.campaigns.userId, userId), eq(schema.campaigns.status, 'active')));
    const activeCampaigns = activeCampaignsResult[0]?.count || 0;

    const totalSpentResult = await db.select({
        total: sum(sql<number>`CAST(${schema.budgets.spentAmount} AS DECIMAL)`)
    }).from(schema.budgets).where(budgetsUserCondition);
    const totalSpent = parseFloat(totalSpentResult[0]?.total || '0') || 0;

    const totalConversionsResult = await db.select({ total: sum(schema.metrics.conversions) })
      .from(schema.metrics).where(metricsTimeCondition);
    const conversions = parseFloat(totalConversionsResult[0]?.total || '0') || 0;

    const totalRevenueResult = await db.select({ total: sum(schema.metrics.revenue) })
      .from(schema.metrics).where(metricsTimeCondition);
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total || '0') || 0;

    const totalCostResult = await db.select({ total: sum(schema.metrics.cost) })
      .from(schema.metrics).where(metricsTimeCondition);
    const totalCost = parseFloat(totalCostResult[0]?.total || '0') || 0;

    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;

    const totalImpressionsResult = await db.select({ total: sum(schema.metrics.impressions) })
      .from(schema.metrics).where(metricsTimeCondition);
    const impressions = parseFloat(totalImpressionsResult[0]?.total || '0') || 0;

    const totalClicksResult = await db.select({ total: sum(schema.metrics.clicks) })
      .from(schema.metrics).where(metricsTimeCondition);
    const clicks = parseFloat(totalClicksResult[0]?.total || '0') || 0;

    const ctr = clicks > 0 && impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 && totalCost > 0 ? parseFloat((totalCost / clicks).toFixed(2)) : 0;

    const metricsData = {
      activeCampaigns: activeCampaigns, totalSpent: totalSpent, conversions: conversions,
      avgROI: avgROI, impressions: impressions, clicks: clicks, ctr: ctr, cpc: cpc
    };

    const campaignsChange = parseFloat((Math.random() * 20 - 10).toFixed(1));
    const spentChange = parseFloat((Math.random() * 20 - 10).toFixed(1));
    const conversionsChange = parseFloat((Math.random() * 30 - 15).toFixed(1));
    const roiChange = parseFloat((Math.random() * 10 - 5).toFixed(1));
    const trends = { campaignsChange, spentChange, conversionsChange, roiChange };

    const recentCampaignsRaw = await db.select().from(schema.campaigns)
      .where(eq(schema.campaigns.userId, userId))
      .orderBy(desc(schema.campaigns.createdAt))
      .limit(3);

    const recentCampaigns = recentCampaignsRaw.map(c => ({
      id: c.id, name: c.name, description: c.description || 'Nenhuma descrição',
      status: c.status, platforms: c.platforms || [],
      budget: parseFloat(c.budget || '0') || 0,
      spent: parseFloat(c.dailyBudget || '0') || 0,
      performance: Math.floor(Math.random() * (95 - 60 + 1)) + 60
    }));

    const timeSeriesData = generateSimulatedLineChartData('Desempenho Geral', 1000, timeRange === '30d' ? 30 : 7, 50, chartColors.palette[0]);
    const channelPerformanceData = generateSimulatedDoughnutChartData(['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 20, 10, chartColors.palette);
    const conversionData = generateSimulatedLineChartData('Conversões', 200, timeRange === '30d' ? 30 : 7, 30, chartColors.palette[1]);
    const roiData = generateSimulatedBarChartData('ROI (%)', ['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 250, 100, chartColors.palette);

    return {
      metrics: metricsData, recentCampaigns: recentCampaigns,
      alertCount: (await db.select({ count: count() }).from(schema.alerts).where(and(eq(schema.alerts.userId, userId), eq(schema.alerts.isRead, false))))[0]?.count || 0,
      trends: trends, timeSeriesData: timeSeriesData, channelPerformanceData: channelPerformanceData,
      conversionData: conversionData, roiData: roiData,
    };
  }
}

export const storage = new DatabaseStorage();
