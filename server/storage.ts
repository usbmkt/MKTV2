// server/storage.ts
import { db } from './db';
import {
  users, campaigns, creatives, metrics, whatsappMessages, copies, alerts, budgets, landingPages,
  chatSessions, chatMessages, funnels, funnelStages, launchPhaseEnum,
  // Importando os tipos de schema do WhatsApp explicitamente se forem usados diretamente aqui
  // Caso contrário, eles são usados através do schema principal
  whatsappConnections, whatsappFlows, whatsappFlowUserStates, whatsappMessageTemplates,
  whatsappConnectionStatusEnum, flowTriggerTypeEnum, flowStatusEnum,
  messageTemplateCategoryEnum, messageTemplateStatusMetaEnum,
  type User, type InsertUser, type Campaign, type InsertCampaign,
  type Creative, type InsertCreative, type Metric, type InsertMetric,
  type WhatsappMessage, type InsertWhatsappMessage, type Copy, type InsertCopy,
  type Alert, type InsertAlert, type Budget, type InsertBudget,
  type LandingPage, type InsertLandingPage,
  type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage,
  type Funnel, type InsertFunnel, type FunnelStage, type InsertFunnelStage,
  // Tipos do WhatsApp
  type WhatsappConnection, type InsertWhatsappConnection,
  type WhatsappFlow, type InsertWhatsappFlow,
  type WhatsappFlowUserState, type InsertWhatsappFlowUserState,
  type WhatsappMessageTemplate, type InsertWhatsappMessageTemplate
} from '../shared/schema'; // O schema principal já reexporta tudo de whatsapp.schema

import { eq, count, sum, sql, desc, and, or, gte, lte, isNull, asc, ilike } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

// Funções de simulação e convertBudgetData mantidas como no seu original
const chartColors = { palette: [ 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)', 'rgba(200, 200, 200, 1)' ], background: [ 'rgba(75, 192, 192, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(255, 206, 86, 0.2)', 'rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64, 0.2)', 'rgba(200, 200, 200, 0.2)' ] };
function generateSimulatedLineChartData(label: string, startValue: number, countNum: number, maxFluctuation: number, color: string): { labels: string[], datasets: { label: string, data: number[], borderColor: string, backgroundColor: string, fill: boolean, tension: number }[] } { const dataPoints: number[] = []; const labels: string[] = []; let currentValue = startValue; for (let i = 0; i < countNum; i++) { labels.push(`Dia ${i + 1}`); dataPoints.push(Math.round(currentValue)); currentValue += (Math.random() * maxFluctuation * 2) - maxFluctuation; if (currentValue < 0) currentValue = 0; } return { labels: labels, datasets: [ { label: label, data: dataPoints, borderColor: color, backgroundColor: color.replace('1)', '0.2)'), fill: true, tension: 0.4, }, ], }; }
function generateSimulatedBarChartData(label: string, categories: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { label: string, data: number[], backgroundColor: string[] }[] } { const dataPoints: number[] = categories.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation)); return { labels: categories, datasets: [ { label: label, data: dataPoints, backgroundColor: colors, }, ], }; }
function generateSimulatedDoughnutChartData(chartLabels: string[], baseValue: number, maxFluctuation: number, colors: string[]): { labels: string[], datasets: { data: number[], backgroundColor: string[], borderWidth: number }[] } { const dataPoints: number[] = chartLabels.map(() => Math.round(baseValue + (Math.random() * maxFluctuation * 2) - maxFluctuation)); return { labels: chartLabels, datasets: [ { data: dataPoints, backgroundColor: colors.map(color => color.replace('1)', '0.8)')), borderWidth: 0, }, ], }; }
function convertBudgetData(data: any) { const converted = { ...data }; if (typeof converted.totalBudget === 'number') { converted.totalBudget = String(converted.totalBudget); } if (typeof converted.spentAmount === 'number') { converted.spentAmount = String(converted.spentAmount); } if (typeof converted.budget === 'number') { converted.budget = String(converted.budget); } if (typeof converted.dailyBudget === 'number') { converted.dailyBudget = String(converted.dailyBudget); } if (typeof converted.avgTicket === 'number') { converted.avgTicket = String(converted.avgTicket); } return converted; }

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
  
  getCreatives(userId: number, campaignId?: number | null): Promise<Creative[]>;
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
  
  getCopies(userId: number, campaignId?: number | null, phase?: string, purposeKey?: string, searchTerm?: string): Promise<Copy[]>;
  createCopy(copy: InsertCopy): Promise<Copy>;
  updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'id' | 'createdAt'>>, userId: number): Promise<Copy | undefined>;
  deleteCopy(id: number, userId: number): Promise<boolean>;
  
  getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]>;
  createAlert(alertData: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: number, userId: number): Promise<boolean>;
  
  getBudgets(userId: number, campaignId?: number | null): Promise<Budget[]>;
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
  
  getFunnels(userId: number, campaignId?: number | null): Promise<Funnel[]>;
  getFunnel(id: number, userId: number): Promise<Funnel | undefined>;
  createFunnel(funnelData: InsertFunnel): Promise<Funnel>;
  updateFunnel(id: number, funnelData: Partial<Omit<InsertFunnel, 'userId' | 'campaignId'>>, userId: number): Promise<Funnel | undefined>;
  deleteFunnel(id: number, userId: number): Promise<boolean>;
  
  getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]>;
  createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStage>;
  updateFunnelStage(id: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>, userId: number): Promise<FunnelStage | undefined>;
  deleteFunnelStage(id: number, userId: number): Promise<boolean>;

  // Funções para WhatsApp
  getWhatsappConnection(userId: number): Promise<WhatsappConnection | undefined>;
  createWhatsappConnection(data: { userId: number } & Partial<Omit<InsertWhatsappConnection, 'userId'>>): Promise<WhatsappConnection>;
  updateWhatsappConnection(userId: number, data: Partial<Omit<InsertWhatsappConnection, 'userId'>>): Promise<WhatsappConnection | undefined>;
  deleteWhatsappConnection(userId: number): Promise<boolean>;

  getWhatsappFlows(userId: number): Promise<WhatsappFlow[]>;
  getWhatsappFlow(id: number, userId: number): Promise<WhatsappFlow | undefined>;
  createWhatsappFlow(data: { userId: number } & InsertWhatsappFlow): Promise<WhatsappFlow>;
  updateWhatsappFlow(id: number, userId: number, data: Partial<InsertWhatsappFlow>): Promise<WhatsappFlow | undefined>;
  deleteWhatsappFlow(id: number, userId: number): Promise<boolean>;

  getWhatsappFlowUserState(userId: number, contactJid: string): Promise<WhatsappFlowUserState | undefined>;
  createOrUpdateWhatsappFlowUserState(data: { userId: number } & InsertWhatsappFlowUserState): Promise<WhatsappFlowUserState>;
  
  getWhatsappMessageTemplates(userId: number): Promise<WhatsappMessageTemplate[]>;
  getWhatsappMessageTemplate(id: number, userId: number): Promise<WhatsappMessageTemplate | undefined>;
  getWhatsappMessageTemplateByName(name: string, userId: number): Promise<WhatsappMessageTemplate | undefined>;
  createWhatsappMessageTemplate(data: { userId: number } & InsertWhatsappMessageTemplate): Promise<WhatsappMessageTemplate>;
  updateWhatsappMessageTemplate(id: number, userId: number, data: Partial<InsertWhatsappMessageTemplate>): Promise<WhatsappMessageTemplate | undefined>;
  deleteWhatsappMessageTemplate(id: number, userId: number): Promise<boolean>;
}

// Definindo os campos para seleção explícita para a tabela users
const userFieldsForSelection = {
  id: users.id,
  username: users.username,
  email: users.email,
  password: users.password,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    console.log(`[STORAGE_GETUSER_V5] Buscando usuário por ID: ${id}`);
    if (isNaN(id) || id <= 0) {
        console.warn("[STORAGE_GETUSER_V5] ID inválido fornecido:", id);
        return undefined;
    }
    try {
      const result = await db
        .select(userFieldsForSelection)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error(`[STORAGE_GETUSER_V5] Erro ao buscar usuário por ID ${id}:`, error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log(`[STORAGE_GETUSERBYUSERNAME_V5] Buscando usuário por username: ${username}`);
    if (!username || typeof username !== 'string' || username.trim() === '') {
      console.warn("[STORAGE_GETUSERBYUSERNAME_V5] Tentativa de buscar usuário com username inválido ou ausente.");
      return undefined;
    }
    try {
      const result = await db
        .select(userFieldsForSelection)
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error(`[STORAGE_GETUSERBYUSERNAME_V5] Erro ao buscar usuário por username ${username}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`[STORAGE_GETUSERBYEMAIL_V5] Buscando usuário por email: ${email}`);
    if (!email || typeof email !== 'string' || email.trim() === '') {
      console.warn("[STORAGE_GETUSERBYEMAIL_V5] Tentativa de buscar usuário com email inválido ou ausente:", email);
      return undefined;
    }
    try {
      const result = await db
        .select(userFieldsForSelection)
        .from(users)
        .where(eq(users.email, email.trim()))
        .limit(1);
      console.log(`[STORAGE_GETUSERBYEMAIL_V5] Resultado para ${email}:`, result[0] ? `Usuário ID ${result[0].id}` : 'Não encontrado');
      return result[0];
    } catch (error) {
      console.error(`[STORAGE_GETUSERBYEMAIL_V5] Erro ao buscar usuário por email ${email}:`, error);
      throw error;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Verificação explícita da senha antes do hash
    if (!userData.password || typeof userData.password !== 'string' || userData.password.trim().length < 6) {
      console.error('[STORAGE_CREATEUSER_ERROR] Senha inválida ou ausente recebida em userData:', JSON.stringify(userData));
      // Lançar um erro mais específico para ser pego pelo error handler da rota
      const err = new Error('A senha é obrigatória, deve ser uma string e ter no mínimo 6 caracteres.');
      (err as any).statusCode = 400; // Adiciona statusCode para melhor tratamento de erro HTTP
      throw err;
    }
    
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [newUser] = await db.insert(users).values({ ...userData, password: hashedPassword }).returning(userFieldsForSelection);
    if (!newUser) throw new Error("Falha ao criar usuário.");
    return newUser;
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    if (!password || !hashedPassword) return false;
    return bcrypt.compare(password, hashedPassword);
  }

  // --- Métodos de Campaign (mantidos como antes) ---
  async getCampaigns(userId: number, limit?: number): Promise<Campaign[]> {
    let query = db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
    if (limit) { return query.limit(limit); }
    return query;
  }
  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId))).limit(1);
    return campaign;
  }
  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const dataToInsert = { ...campaignData }; 
    const [newCampaign] = await db.insert(campaigns).values(dataToInsert).returning();
    if (!newCampaign) throw new Error("Falha ao criar campanha.");
    return newCampaign;
  }
  async updateCampaign(id: number, campaignData: Partial<Omit<InsertCampaign, 'userId'>>, userId: number): Promise<Campaign | undefined> {
    const dataToUpdate = { ...campaignData, updatedAt: new Date() };
    const [updatedCampaign] = await db.update(campaigns).set(dataToUpdate).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId))).returning();
    return updatedCampaign;
  }
  async deleteCampaign(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getCreatives(userId: number, campaignId?: number | null): Promise<Creative[]> {
    const conditions = [eq(creatives.userId, userId)];
    if (campaignId !== undefined) {
      conditions.push(campaignId === null ? isNull(creatives.campaignId) : eq(creatives.campaignId, campaignId));
    }
    return db.select().from(creatives).where(and(...conditions)).orderBy(desc(creatives.createdAt));
  }
  async getCreative(id: number, userId: number): Promise<Creative | undefined> {
    const [creative] = await db.select().from(creatives).where(and(eq(creatives.id, id), eq(creatives.userId, userId))).limit(1);
    return creative;
  }
  async createCreative(creativeData: InsertCreative): Promise<Creative> {
    const [newCreative] = await db.insert(creatives).values(creativeData).returning();
    if (!newCreative) throw new Error("Falha ao criar criativo.");
    return newCreative;
  }
  async updateCreative(id: number, creativeData: Partial<Omit<InsertCreative, 'userId'>>, userId: number): Promise<Creative | undefined> {
    const [updatedCreative] = await db.update(creatives).set({ ...creativeData, updatedAt: new Date() }).where(and(eq(creatives.id, id), eq(creatives.userId, userId))).returning();
    return updatedCreative;
  }
  async deleteCreative(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(creatives).where(and(eq(creatives.id, id), eq(creatives.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getMetricsForCampaign(campaignId: number, userId: number): Promise<Metric[]> {
    const campaignExists = await db.select({id: campaigns.id}).from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))).limit(1);
    if (!campaignExists.length) { throw new Error("Campanha não encontrada ou não pertence ao usuário."); }
    return db.select().from(metrics).where(eq(metrics.campaignId, campaignId)).orderBy(desc(metrics.date));
  }
  async createMetric(metricData: InsertMetric): Promise<Metric> {
    const [newMetric] = await db.insert(metrics).values(metricData).returning();
    if (!newMetric) throw new Error("Falha ao criar métrica.");
    return newMetric;
  }

  async getMessages(userId: number, contactNumber?: string): Promise<WhatsappMessage[]> {
    const conditions = [eq(whatsappMessages.userId, userId)];
    if (contactNumber) { conditions.push(eq(whatsappMessages.contactNumber, contactNumber)); }
    return db.select().from(whatsappMessages).where(and(...conditions)).orderBy(desc(whatsappMessages.timestamp));
  }
  async createMessage(messageData: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(messageData).returning();
    if (!newMessage) throw new Error("Falha ao criar mensagem.");
    return newMessage;
  }
  async markMessageAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(whatsappMessages).set({ isRead: true }).where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId), eq(whatsappMessages.isRead, false)));
    return (result.rowCount ?? 0) > 0;
  }
  async getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]> {
    const allMessages = await db.select().from(whatsappMessages).where(eq(whatsappMessages.userId, userId)).orderBy(desc(whatsappMessages.timestamp));
    const contactsMap = new Map<string, { contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }>();
    for (const msg of allMessages) {
      if (!contactsMap.has(msg.contactNumber)) { contactsMap.set(msg.contactNumber, { contactNumber: msg.contactNumber, contactName: msg.contactName || null, lastMessage: msg.message, timestamp: new Date(msg.timestamp), unreadCount: 0, }); }
      const contact = contactsMap.get(msg.contactNumber)!;
      if (!msg.isRead && msg.direction === 'incoming') { contact.unreadCount++; }
    }
    return Array.from(contactsMap.values()).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getCopies(userId: number, campaignId?: number | null, phase?: string, purposeKey?: string, searchTerm?: string): Promise<Copy[]> {
    const conditions: any[] = [eq(copies.userId, userId)];
    if (campaignId !== undefined) { conditions.push(campaignId === null ? isNull(copies.campaignId) : eq(copies.campaignId, campaignId)); }
    if (phase && phase !== 'all') { conditions.push(eq(copies.launchPhase, phase as typeof launchPhaseEnum.enumValues[number]));}
    if (purposeKey && purposeKey !== 'all') { conditions.push(eq(copies.purposeKey, purposeKey)); }
    if (searchTerm && searchTerm.trim() !== '') { const searchPattern = `%${searchTerm.toLowerCase()}%`; conditions.push(or(ilike(copies.title, searchPattern), ilike(copies.content, searchPattern))); }
    return db.select().from(copies).where(and(...conditions)).orderBy(desc(copies.createdAt));
  }
  async createCopy(copyData: InsertCopy): Promise<Copy> {
    const [newCopy] = await db.insert(copies).values(copyData).returning(); 
    if (!newCopy) throw new Error("Falha ao salvar a copy no banco de dados.");
    return newCopy;
  }
  async updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'id' | 'createdAt'>>, userId: number): Promise<Copy | undefined> {
    const existingCopyResult = await db.select({id: copies.id}).from(copies).where(and(eq(copies.id, id), eq(copies.userId, userId))).limit(1);
    if(!existingCopyResult || existingCopyResult.length === 0) return undefined;
    const dataToUpdate: Partial<Omit<Copy, 'id' | 'userId' | 'createdAt'>> = { ...copyData, lastUpdatedAt: new Date(), };
    if (copyData.hasOwnProperty('campaignId')) { (dataToUpdate as any).campaignId = copyData.campaignId === undefined ? null : copyData.campaignId; }
    const [updatedCopy] = await db.update(copies).set(dataToUpdate).where(and(eq(copies.id, id), eq(copies.userId, userId))).returning();
    return updatedCopy;
  }
  async deleteCopy(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(copies).where(and(eq(copies.id, id), eq(copies.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]> { const conditions = [eq(alerts.userId, userId)]; if (onlyUnread) { conditions.push(eq(alerts.isRead, false)); } return db.select().from(alerts).where(and(...conditions)).orderBy(desc(alerts.createdAt)); }
  async createAlert(alertData: InsertAlert): Promise<Alert> { 
    const [newAlert] = await db.insert(alerts).values(alertData).returning(); if (!newAlert) throw new Error("Falha ao criar alerta."); return newAlert; } 
  async markAlertAsRead(id: number, userId: number): Promise<boolean> { const result = await db.update(alerts).set({ isRead: true }).where(and(eq(alerts.id, id), eq(alerts.userId, userId), eq(alerts.isRead, false))); return (result.rowCount ?? 0) > 0; }

  async getBudgets(userId: number, campaignId?: number | null): Promise<Budget[]> { const conditions = [eq(budgets.userId, userId)]; if (campaignId !== undefined) { conditions.push(campaignId === null ? isNull(budgets.campaignId) : eq(budgets.campaignId, campaignId)); } return db.select().from(budgets).where(and(...conditions)).orderBy(desc(budgets.createdAt)); }
  async createBudget(budgetData: InsertBudget): Promise<Budget> { 
    const dataToInsert = { ...budgetData }; 
    const [newBudget] = await db.insert(budgets).values(dataToInsert).returning(); if (!newBudget) throw new Error("Falha ao criar orçamento."); return newBudget; }
  async updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined> { const existingBudget = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1); if(!existingBudget || existingBudget.length === 0) { return undefined;} 
    const [updatedBudget] = await db.update(budgets).set(budgetData).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).returning(); return updatedBudget; }

  async getLandingPages(userId: number): Promise<LandingPage[]> { return db.select().from(landingPages).where(eq(landingPages.userId, userId)).orderBy(desc(landingPages.createdAt)); }
  async getLandingPage(id: number, userId: number): Promise<LandingPage | undefined> { const [lp] = await db.select().from(landingPages).where(and(eq(landingPages.id, id), eq(landingPages.userId, userId))).limit(1); return lp; }
  async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> { const [lp] = await db.select().from(landingPages).where(eq(landingPages.slug, slug)).limit(1); return lp; }
  async getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined> { const [lp] = await db.select().from(landingPages).where(and(eq(landingPages.studioProjectId, studioProjectId), eq(landingPages.userId, userId))).limit(1); return lp; }
  async createLandingPage(lpData: InsertLandingPage): Promise<LandingPage> { 
    const [newLP] = await db.insert(landingPages).values(lpData).returning(); if (!newLP) throw new Error("Falha ao criar landing page."); return newLP; }
  async updateLandingPage(id: number, lpData: Partial<Omit<InsertLandingPage, 'userId'>>, userId: number): Promise<LandingPage | undefined> { 
    const [updatedLP] = await db.update(landingPages).set({ ...lpData, updatedAt: new Date() }).where(and(eq(landingPages.id, id), eq(landingPages.userId, userId))).returning(); return updatedLP; }
  async deleteLandingPage(id: number, userId: number): Promise<boolean> { const result = await db.delete(landingPages).where(and(eq(landingPages.id, id), eq(landingPages.userId, userId))); return (result.rowCount ?? 0) > 0; }
  
  async createChatSession(userId: number, title: string = 'Nova Conversa'): Promise<ChatSession> { const [newSession] = await db.insert(chatSessions).values({ userId, title, createdAt: new Date(), updatedAt: new Date() }).returning(); if (!newSession) throw new Error("Falha ao criar nova sessão de chat."); return newSession; }
  async getChatSession(sessionId: number, userId: number): Promise<ChatSession | undefined> { const [session] = await db.select().from(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).limit(1); return session; }
  async getChatSessions(userId: number): Promise<ChatSession[]> { return db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.updatedAt)); }
  async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<ChatSession | undefined> { const [updatedSession] = await db.update(chatSessions).set({ title: newTitle, updatedAt: new Date() }).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).returning(); return updatedSession; }
  async deleteChatSession(sessionId: number, userId: number): Promise<boolean> { const result = await db.delete(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))); return (result.rowCount ?? 0) > 0; } 
  async addChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> { const [newMessage] = await db.insert(chatMessages).values({ ...messageData, timestamp: new Date() }).returning(); if (!newMessage) throw new Error("Falha ao adicionar mensagem ao chat."); await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, messageData.sessionId)); return newMessage; }
  async getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]> { const sessionExists = await db.select({ id: chatSessions.id }).from(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))).limit(1); if (!sessionExists.length) { return []; } return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(asc(chatMessages.timestamp)); }

  async getFunnels(userId: number, campaignId?: number | null): Promise<Funnel[]> { const conditions: any[] = [eq(funnels.userId, userId)]; if (campaignId !== undefined) { conditions.push(campaignId === null ? isNull(funnels.campaignId) : eq(funnels.campaignId, campaignId)); } return db.query.funnels.findMany({ where: and(...conditions), with: { stages: { orderBy: [asc(funnelStages.order)], }, }, orderBy: [desc(funnels.createdAt)], }); }
  async getFunnel(id: number, userId: number): Promise<Funnel | undefined> { return db.query.funnels.findFirst({ where: and(eq(funnels.id, id), eq(funnels.userId, userId)), with: { stages: { orderBy: [asc(funnelStages.order)], }, }, }); }
  async createFunnel(funnelData: InsertFunnel): Promise<Funnel> { 
    const [newFunnel] = await db.insert(funnels).values(funnelData).returning(); if (!newFunnel) throw new Error("Falha ao criar funil."); return newFunnel; }
  async updateFunnel(id: number, funnelData: Partial<Omit<InsertFunnel, 'userId' | 'campaignId'>>, userId: number): Promise<Funnel | undefined> { const dataToSet: Partial<Funnel & { campaignId?: number | null }> = { ...funnelData, updatedAt: new Date() }; if (funnelData.hasOwnProperty('campaignId')) { (dataToSet as any).campaignId = funnelData.campaignId; } const [updatedFunnel] = await db.update(funnels).set(dataToSet).where(and(eq(funnels.id, id), eq(funnels.userId, userId))).returning(); return updatedFunnel; }
  async deleteFunnel(id: number, userId: number): Promise<boolean> { const result = await db.delete(funnels).where(and(eq(funnels.id, id), eq(funnels.userId, userId))); return (result.rowCount ?? 0) > 0; }
  async getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]> { const funnelOwner = await db.select({ id: funnels.id }).from(funnels).where(and(eq(funnels.id, funnelId), eq(funnels.userId, userId))).limit(1); if (!funnelOwner.length) { return []; } return db.select().from(funnelStages).where(eq(funnelStages.funnelId, funnelId)).orderBy(asc(funnelStages.order), desc(funnelStages.createdAt)); }
  async createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStage> { const [newStage] = await db.insert(funnelStages).values(stageData).returning(); if (!newStage) throw new Error("Falha ao criar etapa do funil."); return newStage; }
  async updateFunnelStage(id: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>, userId: number): Promise<FunnelStage | undefined> { const existingStage = await db.query.funnelStages.findFirst({ where: eq(funnelStages.id, id), with: { funnel: { columns: { userId: true } } } }); if (!existingStage || existingStage.funnel?.userId !== userId) { throw new Error("Etapa do funil não encontrada ou não pertence ao usuário."); } 
    const [updatedStage] = await db.update(funnelStages).set({ ...stageData, updatedAt: new Date() }).where(eq(funnelStages.id, id)).returning(); return updatedStage; }
  async deleteFunnelStage(id: number, userId: number): Promise<boolean> { const existingStage = await db.query.funnelStages.findFirst({ where: eq(funnelStages.id, id), with: { funnel: { columns: { userId: true } } } }); if (!existingStage || existingStage.funnel?.userId !== userId) { return false;  } const result = await db.delete(funnelStages).where(eq(funnelStages.id, id)); return (result.rowCount ?? 0) > 0; }

  async getDashboardData(userId: number, timeRange: string = '30d'): Promise<any> {
    const now = new Date();
    let startDate = new Date();
    if (timeRange === '7d') { startDate.setDate(now.getDate() - 7); } else { startDate.setDate(now.getDate() - 30); }
    const metricsTimeCondition = and( eq(metrics.userId, userId), gte(metrics.date, startDate) );
    const budgetsUserCondition = eq(budgets.userId, userId);
    const activeCampaignsResult = await db.select({ count: count() }).from(campaigns).where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    const activeCampaigns = activeCampaignsResult[0]?.count || 0;
    const totalSpentResult = await db.select({ total: sum(sql<number>`TRY_CAST(${budgets.spentAmount} AS DECIMAL)`) }).from(budgets).where(budgetsUserCondition);
    const totalSpent = totalSpentResult[0]?.total || 0;
    const totalConversionsResult = await db.select({ total: sum(metrics.conversions) }).from(metrics).where(metricsTimeCondition);
    const conversions = Number(totalConversionsResult[0]?.total || 0);
    const totalRevenueResult = await db.select({ total: sum(metrics.revenue) }).from(metrics).where(metricsTimeCondition);
    const totalRevenue = Number(totalRevenueResult[0]?.total || 0);
    const totalCostResult = await db.select({ total: sum(metrics.cost) }).from(metrics).where(metricsTimeCondition);
    const totalCost = Number(totalCostResult[0]?.total || 0);
    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;
    const totalImpressionsResult = await db.select({ total: sum(metrics.impressions) }).from(metrics).where(metricsTimeCondition);
    const impressions = Number(totalImpressionsResult[0]?.total || 0);
    const totalClicksResult = await db.select({ total: sum(metrics.clicks) }).from(metrics).where(metricsTimeCondition);
    const clicks = Number(totalClicksResult[0]?.total || 0);
    const ctr = clicks > 0 && impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 && totalCost > 0 ? parseFloat((totalCost / clicks).toFixed(2)) : 0;
    const metricsData = { activeCampaigns, totalSpent, totalCostPeriod: totalCost, conversions, avgROI, impressions, clicks, ctr, cpc };
    const campaignsChange = parseFloat((Math.random() * 20 - 10).toFixed(1));
    const spentChange = parseFloat((Math.random() * 20 - 10).toFixed(1));
    const conversionsChange = parseFloat((Math.random() * 30 - 15).toFixed(1));
    const roiChange = parseFloat((Math.random() * 10 - 5).toFixed(1));
    const trends = { campaignsChange, spentChange, conversionsChange, roiChange, };
    const recentCampaignsRaw = await db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt)).limit(3);
    const recentCampaigns = recentCampaignsRaw.map(c => ({ id: c.id, name: c.name, description: c.description || 'Nenhuma descrição', status: c.status, platforms: c.platforms || [], budget: parseFloat(String(c.budget ?? '0')) || 0, spent: parseFloat(String(c.dailyBudget ?? '0')) || 0, performance: Math.floor(Math.random() * (95 - 60 + 1)) + 60 }));
    const timeSeriesData = generateSimulatedLineChartData('Desempenho Geral', 1000, timeRange === '30d' ? 30 : 7, 50, chartColors.palette[0]);
    const channelPerformanceData = generateSimulatedDoughnutChartData(['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 20, 10, chartColors.palette);
    const conversionData = generateSimulatedLineChartData('Conversões', 200, timeRange === '30d' ? 30 : 7, 30, chartColors.palette[1]);
    const roiData = generateSimulatedBarChartData('ROI (%)', ['Meta Ads', 'Google Ads', 'LinkedIn', 'TikTok'], 250, 100, chartColors.palette);
    const alertCountResult = await db.select({ count: count() }).from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)));
    const alertCountNum = alertCountResult[0]?.count || 0;
    return { metrics: metricsData, recentCampaigns, alertCount: alertCountNum, trends, timeSeriesData, channelPerformanceData, conversionData, roiData, };
  }

  // --- Métodos para WhatsApp ---
  async getWhatsappConnection(userId: number): Promise<WhatsappConnection | undefined> {
    const [connection] = await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId)).limit(1);
    return connection;
  }

  async createWhatsappConnection(data: { userId: number } & Partial<Omit<InsertWhatsappConnection, 'userId'>>): Promise<WhatsappConnection> {
    const [newConnection] = await db.insert(whatsappConnections).values({ ...data, userId: data.userId }).returning();
    if (!newConnection) throw new Error("Falha ao criar conexão WhatsApp.");
    return newConnection;
  }

  async updateWhatsappConnection(userId: number, data: Partial<Omit<InsertWhatsappConnection, 'userId'>>): Promise<WhatsappConnection | undefined> {
    const [updatedConnection] = await db.update(whatsappConnections).set({ ...data, updatedAt: new Date() }).where(eq(whatsappConnections.userId, userId)).returning();
    return updatedConnection;
  }

  async deleteWhatsappConnection(userId: number): Promise<boolean> {
    const result = await db.delete(whatsappConnections).where(eq(whatsappConnections.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }

  async getWhatsappFlows(userId: number): Promise<WhatsappFlow[]> {
    return db.select().from(whatsappFlows).where(eq(whatsappFlows.userId, userId)).orderBy(desc(whatsappFlows.createdAt));
  }

  async getWhatsappFlow(id: number, userId: number): Promise<WhatsappFlow | undefined> {
    const [flow] = await db.select().from(whatsappFlows).where(and(eq(whatsappFlows.id, id), eq(whatsappFlows.userId, userId))).limit(1);
    return flow;
  }

  async createWhatsappFlow(data: { userId: number } & InsertWhatsappFlow): Promise<WhatsappFlow> {
    const [newFlow] = await db.insert(whatsappFlows).values({ ...data, userId: data.userId }).returning();
    if (!newFlow) throw new Error("Falha ao criar fluxo WhatsApp.");
    return newFlow;
  }
  
  async updateWhatsappFlow(id: number, userId: number, data: Partial<InsertWhatsappFlow>): Promise<WhatsappFlow | undefined> {
    const [updatedFlow] = await db.update(whatsappFlows).set({ ...data, updatedAt: new Date() }).where(and(eq(whatsappFlows.id, id), eq(whatsappFlows.userId, userId))).returning();
    return updatedFlow;
  }

  async deleteWhatsappFlow(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(whatsappFlows).where(and(eq(whatsappFlows.id, id), eq(whatsappFlows.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getWhatsappFlowUserState(userId: number, contactJid: string): Promise<WhatsappFlowUserState | undefined> {
    const [state] = await db.select().from(whatsappFlowUserStates).where(and(eq(whatsappFlowUserStates.userId, userId), eq(whatsappFlowUserStates.contactJid, contactJid))).limit(1);
    return state;
  }

  async createOrUpdateWhatsappFlowUserState(data: { userId: number } & InsertWhatsappFlowUserState): Promise<WhatsappFlowUserState> {
    const { userId, contactJid, ...restOfData } = data;
    const existingState = await this.getWhatsappFlowUserState(userId, contactJid);
    if (existingState) {
      const [updatedState] = await db.update(whatsappFlowUserStates)
        .set({ ...restOfData, lastInteractionAt: new Date() })
        .where(and(eq(whatsappFlowUserStates.userId, userId), eq(whatsappFlowUserStates.contactJid, contactJid)))
        .returning();
      if (!updatedState) throw new Error("Falha ao atualizar estado do usuário no fluxo WhatsApp.");
      return updatedState;
    } else {
      const [newState] = await db.insert(whatsappFlowUserStates)
        .values({ ...data, userId: data.userId, lastInteractionAt: new Date() })
        .returning();
      if (!newState) throw new Error("Falha ao criar estado do usuário no fluxo WhatsApp.");
      return newState;
    }
  }

  async getWhatsappMessageTemplates(userId: number): Promise<WhatsappMessageTemplate[]> {
    return db.select().from(whatsappMessageTemplates).where(eq(whatsappMessageTemplates.userId, userId)).orderBy(desc(whatsappMessageTemplates.createdAt));
  }

  async getWhatsappMessageTemplate(id: number, userId: number): Promise<WhatsappMessageTemplate | undefined> {
     const [template] = await db.select().from(whatsappMessageTemplates).where(and(eq(whatsappMessageTemplates.id, id), eq(whatsappMessageTemplates.userId, userId))).limit(1);
    return template;
  }
  
  async getWhatsappMessageTemplateByName(name: string, userId: number): Promise<WhatsappMessageTemplate | undefined> {
     const [template] = await db.select().from(whatsappMessageTemplates).where(and(eq(whatsappMessageTemplates.name, name), eq(whatsappMessageTemplates.userId, userId))).limit(1);
    return template;
  }

  async createWhatsappMessageTemplate(data: { userId: number } & InsertWhatsappMessageTemplate): Promise<WhatsappMessageTemplate> {
    const [newTemplate] = await db.insert(whatsappMessageTemplates).values({ ...data, userId: data.userId }).returning();
    if (!newTemplate) throw new Error("Falha ao criar template de mensagem WhatsApp.");
    return newTemplate;
  }

  async updateWhatsappMessageTemplate(id: number, userId: number, data: Partial<InsertWhatsappMessageTemplate>): Promise<WhatsappMessageTemplate | undefined> {
    const [updatedTemplate] = await db.update(whatsappMessageTemplates).set({ ...data, updatedAt: new Date() }).where(and(eq(whatsappMessageTemplates.id, id), eq(whatsappMessageTemplates.userId, userId))).returning();
    return updatedTemplate;
  }

  async deleteWhatsappMessageTemplate(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(whatsappMessageTemplates).where(and(eq(whatsappMessageTemplates.id, id), eq(whatsappMessageTemplates.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

}

export const storage = new DatabaseStorage();
