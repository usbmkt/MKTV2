// server/storage.ts
import dotenv from "dotenv";
dotenv.config();

import { db } from './db'; 
import {
  users, campaigns, creatives, metrics, whatsappMessages, copies, alerts, budgets, landingPages,
  chatSessions, chatMessages, funnels, funnelStages, 
  type User, type InsertUser, type Campaign, type InsertCampaign,
  type Creative, type InsertCreative, type Metric, type InsertMetric,
  type WhatsappMessage, type InsertWhatsappMessage, type Copy, type InsertCopy,
  type Alert, type InsertAlert, type Budget, type InsertBudget,
  type LandingPage, type InsertLandingPage,
  type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage,
  type Funnel as FunnelTypeFromSchema, // Renomeado para evitar conflito com a interface local Funnel
  type InsertFunnel, 
  type FunnelStage as FunnelStageTypeFromSchema, // Renomeado
  type InsertFunnelStage 
} from '../shared/schema'; 

// Adicionado asc para ordenação
import { eq, count, sum, sql, desc, and, or, gte, lte, isNull, asc } from 'drizzle-orm'; 

import * as bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config'; 

const chartColors = {
  palette: [
    'rgba(75, 192, 192, 1)', 
    'rgba(255, 99, 132, 1)', 
    'rgba(54, 162, 235, 1)', 
    'rgba(255, 206, 86, 1)', 
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)', 
    'rgba(200, 200, 200, 1)' 
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

// Interfaces para dados de Funil que incluem stages (para o retorno da API)
interface FunnelWithStages extends FunnelTypeFromSchema {
  stages: FunnelStageTypeFromSchema[];
}


function generateSimulatedLineChartData(label: string, startValue: number, countNum: number, maxFluctuation: number, color: string): { labels: string[], datasets: { label: string, data: number[], borderColor: string, backgroundColor: string, fill: boolean, tension: number }[] } {
  const data = [];
  const labels = [];
  let currentValue = startValue;

  for (let i = 0; i < countNum; i++) {
    labels.push(`Dia ${i + 1}`); 
    data.push(Math.round(currentValue));
    currentValue += (Math.random() * maxFluctuation * 2) - maxFluctuation;
    if (currentValue < 0) currentValue = 0; 
  }

  return {
    labels: labels,
    datasets: [
      {
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.2)'), 
        fill: true,
        tension: 0.4,
      },
    ],
  };
}

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

function generateSimulatedDoughnutChartData(labels: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { data: number[], backgroundColor: string[], borderWidth: number }[] } {
  const data = labels.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation));
  return {
    labels: labels,
    datasets: [
      {
        data: data,
        backgroundColor: colors.map(color => color.replace('1)', '0.8)')), 
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

  getCreatives(userId: number, campaignId?: number | null): Promise<Creative[]>; // campaignId pode ser null
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

  getCopies(userId: number, campaignId?: number | null): Promise<Copy[]>; // campaignId pode ser null
  createCopy(copy: InsertCopy): Promise<Copy>;
  deleteCopy(id: number, userId: number): Promise<boolean>; 
  updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<Copy | undefined>;

  getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]>;
  createAlert(alertData: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: number, userId: number): Promise<boolean>;

  getBudgets(userId: number, campaignId?: number | null): Promise<Budget[]>; // campaignId pode ser null
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

  // Funis
  getFunnels(userId: number, campaignId?: number | null): Promise<FunnelWithStages[]>; // campaignId pode ser null
  getFunnel(id: number, userId: number): Promise<FunnelWithStages | undefined>;
  createFunnel(funnelData: InsertFunnel): Promise<FunnelTypeFromSchema>; // Retorna o tipo base do schema
  updateFunnel(id: number, funnelData: Partial<Omit<InsertFunnel, 'userId'>>, userId: number): Promise<FunnelTypeFromSchema | undefined>;
  deleteFunnel(id: number, userId: number): Promise<boolean>;

  getFunnelStages(funnelId: number, userId: number): Promise<FunnelStageTypeFromSchema[]>; 
  createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStageTypeFromSchema>;
  updateFunnelStage(id: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>, userId: number): Promise<FunnelStageTypeFromSchema | undefined>;
  deleteFunnelStage(id: number, userId: number): Promise<boolean>;
  
  getDashboardData(userId: number, timeRange: string): Promise<any>; 
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
    return (result.rowCount ?? 0) > 0;
  }

  async getCreatives(userId: number, campaignId?: number | null): Promise<Creative[]> {
    const conditions = [eq(creatives.userId, userId)];
    if (campaignId !== undefined) { // Permite buscar por null explicitamente
        conditions.push(campaignId === null ? isNull(creatives.campaignId) : eq(creatives.campaignId, campaignId));
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
    const campaignExists = await db.select({id: campaigns.id}).from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .limit(1);
    if (!campaignExists.length) {
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

  async getCopies(userId: number, campaignId?: number | null): Promise<Copy[]> {
    const conditions = [eq(copies.userId, userId)];
    if (campaignId !== undefined) { // Permite buscar por null explicitamente
      conditions.push(campaignId === null ? isNull(copies.campaignId) : eq(copies.campaignId, campaignId));
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

  async getBudgets(userId: number, campaignId?: number | null): Promise<Budget[]> {
    const conditions = [eq(budgets.userId, userId)];
    if (campaignId !== undefined) { // Permite buscar por null explicitamente
      conditions.push(campaignId === null ? isNull(budgets.campaignId) : eq(budgets.campaignId, campaignId));
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
    const result = await db.delete(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
    return (result.rowCount ?? 0) > 0;
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
      console.warn(`Tentativa de acesso a mensagens da sessão ${sessionId} pelo usuário ${userId} falhou a verificação de propriedade.`);
      return []; 
    }
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.timestamp);
  }

  // Funis
  async getFunnels(userId: number, campaignId?: number | null): Promise<FunnelWithStages[]> {
    const conditions = [eq(funnels.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(campaignId === null ? isNull(funnels.campaignId) : eq(funnels.campaignId, campaignId));
    }
    // CORRIGIDO: Usar db.query para buscar funis com suas etapas
    const result = await db.query.funnels.findMany({
      where: and(...conditions),
      orderBy: [desc(funnels.createdAt)],
      with: {
        stages: { // Este 'stages' deve corresponder ao nome da relação em funnelRelations
          orderBy: [asc(funnelStages.order), desc(funnelStages.createdAt)]
        }
      }
    });
    return result as FunnelWithStages[]; // Fazendo um cast para o tipo esperado
  }

  async getFunnel(id: number, userId: number): Promise<FunnelWithStages | undefined> {
    // CORRIGIDO: Usar db.query para buscar um funil com suas etapas
    const funnel = await db.query.funnels.findFirst({
      where: and(eq(funnels.id, id), eq(funnels.userId, userId)),
      with: {
        stages: {
          orderBy: [asc(funnelStages.order), desc(funnelStages.createdAt)]
        }
      }
    });
    return funnel as FunnelWithStages | undefined;
  }

  async createFunnel(funnelData: InsertFunnel): Promise<FunnelTypeFromSchema> {
    const [newFunnel] = await db.insert(funnels).values(funnelData).returning();
    if (!newFunnel) throw new Error("Falha ao criar funil.");
    return newFunnel;
  }

  async updateFunnel(id: number, funnelData: Partial<Omit<InsertFunnel, 'userId'>>, userId: number): Promise<FunnelTypeFromSchema | undefined> {
    const [updatedFunnel] = await db.update(funnels)
      .set({ ...funnelData, updatedAt: new Date() })
      .where(and(eq(funnels.id, id), eq(funnels.userId, userId)))
      .returning();
    return updatedFunnel;
  }

  async deleteFunnel(id: number, userId: number): Promise<boolean> {
    // Considerar deletar stages associados ou usar onDelete: 'cascade' no schema
    const result = await db.delete(funnels)
      .where(and(eq(funnels.id, id), eq(funnels.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getFunnelStages(funnelId: number, userId: number): Promise<FunnelStageTypeFromSchema[]> {
    const funnelOwner = await db.select({ id: funnels.id }).from(funnels)
      .where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId)))
      .limit(1);
    if (!funnelOwner.length) {
      // Lançar erro ou retornar array vazio dependendo da política de erro
      throw new Error("Funil não encontrado ou não pertence ao usuário.");
    }
    return db.select().from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(asc(funnelStages.order), desc(funnelStages.createdAt)); 
  }

  async createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStageTypeFromSchema> {
    const [newStage] = await db.insert(funnelStages).values(stageData).returning();
    if (!newStage) throw new Error("Falha ao criar etapa do funil.");
    return newStage;
  }

  async updateFunnelStage(id: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>, userId: number): Promise<FunnelStageTypeFromSchema | undefined> {
    // Verificar se a etapa pertence a um funil do usuário (verificação de permissão)
    const existingStage = await db.query.funnelStages.findFirst({
        where: eq(funnelStages.id, id),
        with: {
            funnel: {
                columns: { userId: true }
            }
        }
    });

    if (!existingStage || existingStage.funnel?.userId !== userId) {
        throw new Error("Etapa do funil não encontrada ou não pertence ao usuário.");
    }

    const [updatedStage] = await db.update(funnelStages)
      .set({ ...stageData, updatedAt: new Date() })
      .where(eq(funnelStages.id, id)) 
      .returning();
    return updatedStage;
  }

  async deleteFunnelStage(id: number, userId: number): Promise<boolean> {
    const existingStage = await db.query.funnelStages.findFirst({
        where: eq(funnelStages.id, id),
        with: {
            funnel: {
                columns: { userId: true }
            }
        }
    });
    
    if (!existingStage || existingStage.funnel?.userId !== userId) {
        throw new Error("Etapa do funil não encontrada ou não pertence ao usuário para exclusão.");
    }

    const result = await db.delete(funnelStages).where(eq(funnelStages.id, id));
    return (result.rowCount ?? 0) > 0;
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
        gte(metrics.date, startDate) 
    );

    const budgetsUserCondition = eq(budgets.userId, userId);

    const activeCampaignsResult = await db.select({ count: count() }).from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    const activeCampaigns = activeCampaignsResult[0]?.count || 0;

    const totalSpentResult = await db.select({
        total: sum(budgets.spentAmount) 
    })
      .from(budgets)
      .where(budgetsUserCondition);
    const totalSpent = parseFloat(String(totalSpentResult[0]?.total || "0")) || 0;

    const totalConversionsResult = await db.select({ total: sum(metrics.conversions) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const conversions = parseFloat(String(totalConversionsResult[0]?.total || '0')) || 0;

    const totalRevenueResult = await db.select({ total: sum(metrics.revenue) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const totalRevenue = parseFloat(String(totalRevenueResult[0]?.total || '0')) || 0;

    const totalCostResult = await db.select({ total: sum(metrics.cost) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const totalCost = parseFloat(String(totalCostResult[0]?.total || '0')) || 0;

    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;

    const totalImpressionsResult = await db.select({ total: sum(metrics.impressions) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const impressions = parseFloat(String(totalImpressionsResult[0]?.total || '0')) || 0;

    const totalClicksResult = await db.select({ total: sum(metrics.clicks) })
      .from(metrics)
      .where(metricsTimeCondition); 
    const clicks = parseFloat(String(totalClicksResult[0]?.total || '0')) || 0;

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

    const trends = {
      campaignsChange,
      spentChange,
      conversionsChange,
      roiChange,
    };

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
      budget: parseFloat(String(c.budget ?? '0')) || 0, 
      spent: parseFloat(String(c.dailyBudget ?? '0')) || 0, 
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
}

export const storage = new DatabaseStorage();
