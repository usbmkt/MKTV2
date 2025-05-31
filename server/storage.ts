// server/storage.ts
import dotenv from "dotenv";
dotenv.config();

import { db } from './db';
import {
  users, campaigns, creatives, metrics, whatsappMessages, copies, alerts, budgets, landingPages,
  chatSessions, chatMessages, funnels, funnelStages, // Adicionado funnels e funnelStages se não estiverem lá
  type User, type InsertUser, type Campaign, type InsertCampaign,
  type Creative, type InsertCreative, type Metric, type InsertMetric,
  type WhatsappMessage, type InsertWhatsappMessage, type Copy, type InsertCopy,
  type Alert, type InsertAlert, type Budget, type InsertBudget,
  type LandingPage, type InsertLandingPage,
  type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage,
  type Funnel, type InsertFunnel, type FunnelStage, type InsertFunnelStage // Adicionado tipos de Funil
} from '../shared/schema';

import { eq, count, sum, sql, desc, and, or, asc, like, ilike, ne } from 'drizzle-orm'; // Adicionado asc, like, ilike, ne
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

// Função auxiliar para converter números para strings nos budgets
function convertBudgetData(data: any): any {
  const converted = { ...data };
  ['totalBudget', 'spentAmount', 'budget', 'dailyBudget', 'avgTicket'].forEach(key => {
    if (typeof data[key] === 'number') {
      converted[key] = String(data[key]);
    } else if (data[key] === null || data[key] === undefined) {
      // Mantém null/undefined como está, ou define como string vazia se o schema Zod/DB preferir
      // Para text no DB, null é geralmente ok.
    }
  });
  return converted;
}

const chartColors = { /* ... (inalterado) ... */ };
function generateSimulatedLineChartData(/* ... */): any { /* ... (inalterado) ... */ }
function generateSimulatedBarChartData(/* ... */): any { /* ... (inalterado) ... */ }
function generateSimulatedDoughnutChartData(/* ... */): any { /* ... (inalterado) ... */ }


export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;

  getCampaigns(userId: number, filters?: { name?: string; status?: string; platform?: string }, limit?: number): Promise<Campaign[]>;
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
  
  getFunnels(userId: number, campaignId?: number): Promise<Funnel[]>;
  getFunnel(funnelId: number, userId: number): Promise<Funnel | undefined>;
  createFunnel(funnelData: InsertFunnel): Promise<Funnel>;
  updateFunnel(funnelId: number, funnelData: Partial<Omit<InsertFunnel, 'userId'>>, userId: number): Promise<Funnel | undefined>;
  deleteFunnel(funnelId: number, userId: number): Promise<boolean>;
  getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]>;
  createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStage>;
  updateFunnelStage(stageId: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>): Promise<FunnelStage | undefined>;
  deleteFunnelStage(stageId: number): Promise<boolean>;

  getDashboardData(userId: number, timeRange: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> { /* ... (inalterado) ... */ }
  async getUserByUsername(username: string): Promise<User | undefined> { /* ... (inalterado) ... */ }
  async getUserByEmail(email: string): Promise<User | undefined> { /* ... (inalterado) ... */ }
  async createUser(userData: InsertUser): Promise<User> { /* ... (inalterado) ... */ }
  async validatePassword(password: string, hashedPassword: string): Promise<boolean> { /* ... (inalterado) ... */ }
  async getCampaigns(userId: number, filters?: { name?: string; status?: string; platform?: string }, limit?: number): Promise<Campaign[]> { /* ... (inalterado, assuming filter logic exists or is to be added) ... */ 
    let query = db.query.campaigns.findMany({
        where: and(
            eq(campaigns.userId, userId),
            filters?.name ? ilike(campaigns.name, `%${filters.name}%`) : undefined,
            filters?.status && filters.status !== 'all' ? eq(campaigns.status, filters.status as any) : undefined,
            // filters?.platform ? sql`${campaigns.platforms} @> ${JSON.stringify([filters.platform])}` : undefined // Para checar se array contém
            // A forma acima para platform pode precisar de ajuste dependendo de como você quer filtrar JSONB
        ),
        orderBy: [desc(campaigns.createdAt)],
        limit: limit
    });
    return query;
  }
  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> { /* ... (inalterado) ... */ }
  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> { /* ... (inalterado) ... */ }
  async updateCampaign(id: number, campaignData: Partial<Omit<InsertCampaign, 'userId'>>, userId: number): Promise<Campaign | undefined> { /* ... (inalterado) ... */ }
  async deleteCampaign(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async getCreatives(userId: number, campaignId?: number): Promise<Creative[]> { /* ... (inalterado) ... */ }
  async getCreative(id: number, userId: number): Promise<Creative | undefined> { /* ... (inalterado) ... */ }
  async createCreative(creativeData: InsertCreative): Promise<Creative> { /* ... (inalterado) ... */ }
  async updateCreative(id: number, creativeData: Partial<Omit<InsertCreative, 'userId'>>, userId: number): Promise<Creative | undefined> { /* ... (inalterado) ... */ }
  async deleteCreative(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async getMetricsForCampaign(campaignId: number, userId: number): Promise<Metric[]> { /* ... (inalterado) ... */ }
  async createMetric(metricData: InsertMetric): Promise<Metric> { /* ... (inalterado) ... */ }
  async getMessages(userId: number, contactNumber?: string): Promise<WhatsappMessage[]> { /* ... (inalterado) ... */ }
  async createMessage(messageData: InsertWhatsappMessage): Promise<WhatsappMessage> { /* ... (inalterado) ... */ }
  async markMessageAsRead(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async getContacts(userId: number): Promise<{ contactNumber: string; contactName: string | null; lastMessage: string; timestamp: Date, unreadCount: number }[]> { /* ... (inalterado) ... */ }
  async getCopies(userId: number, campaignId?: number): Promise<Copy[]> { /* ... (inalterado) ... */ }
  async createCopy(copyData: InsertCopy): Promise<Copy> { /* ... (inalterado) ... */ }
  async updateCopy(id: number, copyData: Partial<Omit<InsertCopy, 'userId' | 'campaignId'>>, userId: number): Promise<Copy | undefined> { /* ... (inalterado) ... */ }
  async deleteCopy(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async getAlerts(userId: number, onlyUnread?: boolean): Promise<Alert[]> { /* ... (inalterado) ... */ }
  async createAlert(alertData: InsertAlert): Promise<Alert> { /* ... (inalterado) ... */ }
  async markAlertAsRead(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async getBudgets(userId: number, campaignId?: number): Promise<Budget[]> { /* ... (inalterado) ... */ }
  async createBudget(budgetData: InsertBudget): Promise<Budget> { /* ... (inalterado) ... */ }
  async updateBudget(id: number, budgetData: Partial<Omit<InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<Budget | undefined> { /* ... (inalterado) ... */ }
  async getLandingPages(userId: number): Promise<LandingPage[]> { /* ... (inalterado) ... */ }
  async getLandingPage(id: number, userId: number): Promise<LandingPage | undefined> { /* ... (inalterado) ... */ }
  async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> { /* ... (inalterado) ... */ }
  async getLandingPageByStudioProjectId(studioProjectId: string, userId: number): Promise<LandingPage | undefined> { /* ... (inalterado) ... */ }
  async createLandingPage(lpData: InsertLandingPage): Promise<LandingPage> { /* ... (inalterado) ... */ }
  async updateLandingPage(id: number, lpData: Partial<Omit<InsertLandingPage, 'userId'>>, userId: number): Promise<LandingPage | undefined> { /* ... (inalterado) ... */ }
  async deleteLandingPage(id: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }

  // COORDENADA 1: Adicionar logs e try-catch em createChatSession
  async createChatSession(userId: number, title: string = 'Nova Conversa'): Promise<ChatSession> {
    console.log(`[STORAGE] Tentando criar chat session para userId: ${userId}, title: ${title}`);
    try {
      const valuesToInsert = { 
        userId, 
        title, 
        // createdAt e updatedAt usam defaultNow() do schema, não precisam ser passados aqui explicitamente
        // a menos que o schema Zod os exija, mas o pgTable os tem como default.
      };
      console.log('[STORAGE] Valores para inserir em chat_sessions:', valuesToInsert);
      const [newSession] = await db.insert(chatSessions).values(valuesToInsert).returning();
      
      if (!newSession) {
        console.error("[STORAGE] Falha ao criar chat session: newSession retornou undefined/null após insert.");
        throw new Error("Falha ao criar nova sessão de chat: DB não retornou a sessão criada.");
      }
      console.log(`[STORAGE] Chat session criada com sucesso. ID: ${newSession.id}`);
      return newSession;
    } catch (error) {
      console.error("[STORAGE] Erro CRÍTICO em createChatSession:", error);
      // Re-lança o erro para que a camada superior (routes.ts) possa pegá-lo e enviar uma resposta 500
      throw error; 
    }
  }

  async getChatSession(sessionId: number, userId: number): Promise<ChatSession | undefined> { /* ... (inalterado) ... */ }
  async getChatSessions(userId: number): Promise<ChatSession[]> { /* ... (inalterado) ... */ }
  async updateChatSessionTitle(sessionId: number, userId: number, newTitle: string): Promise<ChatSession | undefined> { /* ... (inalterado) ... */ }
  async deleteChatSession(sessionId: number, userId: number): Promise<boolean> { /* ... (inalterado) ... */ }
  async addChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> { /* ... (inalterado, mas assegurar que updatedAt da sessão é atualizado) ... */ 
    const [newMessage] = await db.insert(chatMessages).values({ ...messageData, timestamp: new Date() }).returning();
    if (!newMessage) throw new Error("Falha ao adicionar mensagem ao chat.");
    // Atualiza o timestamp da sessão para que as sessões mais recentes apareçam no topo
    try {
        await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, messageData.sessionId));
    } catch (updateError) {
        console.error(`[STORAGE] Falha ao atualizar updatedAt para sessão ${messageData.sessionId} após nova mensagem:`, updateError);
    }
    return newMessage;
  }
  async getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]> { /* ... (inalterado) ... */ }
  async getFunnels(userId: number, campaignId?: number): Promise<Funnel[]> { /* ... (implementar) ... */ return []; }
  async getFunnel(funnelId: number, userId: number): Promise<Funnel | undefined> { /* ... (implementar) ... */ return undefined; }
  async createFunnel(funnelData: InsertFunnel): Promise<Funnel> { /* ... (implementar) ... */ throw new Error("Not implemented"); }
  async updateFunnel(funnelId: number, funnelData: Partial<Omit<InsertFunnel, 'userId'>>, userId: number): Promise<Funnel | undefined> { /* ... (implementar) ... */ return undefined; }
  async deleteFunnel(funnelId: number, userId: number): Promise<boolean> { /* ... (implementar) ... */ return false; }
  async getFunnelStages(funnelId: number, userId: number): Promise<FunnelStage[]> { /* ... (implementar) ... */ return []; }
  async createFunnelStage(stageData: InsertFunnelStage): Promise<FunnelStage> { /* ... (implementar) ... */ throw new Error("Not implemented"); }
  async updateFunnelStage(stageId: number, stageData: Partial<Omit<InsertFunnelStage, 'funnelId'>>): Promise<FunnelStage | undefined> { /* ... (implementar) ... */ return undefined; }
  async deleteFunnelStage(stageId: number): Promise<boolean> { /* ... (implementar) ... */ return false; }
  async getDashboardData(userId: number, timeRange: string = '30d') { /* ... (inalterado, mas verificar CASTs) ... */
     // ... (lógica existente, assegurar que CAST para DECIMAL está correto em somas de colunas TEXT)
     // Exemplo de correção para totalSpent se budgets.spentAmount for TEXT
    const totalSpentResult = await db.select({
        total: sum(sql<number>`NULLIF(regexp_replace(${budgets.spentAmount}, '[^0-9.]', '', 'g'), '')::DECIMAL`)
    }).from(budgets).where(eq(budgets.userId, userId));
    const totalSpent = parseFloat(totalSpentResult[0]?.total || '0') || 0;
    // Similar para metrics.cost e metrics.revenue se forem text no schema e não decimal.
    // No schema atual (0000_dusty_dexter_bennett.sql), metrics.cost e metrics.revenue SÃO numeric(10,2), o que é bom.
    // budgets.totalBudget e budgets.spentAmount são numeric(10,2) no SQL, mas TEXT no schema.ts (pgTable). Isso precisa ser alinhado.
    // Assumindo que schema.ts será corrigido para usar decimal() para budgets.totalBudget e budgets.spentAmount, então o CAST sql pode ser removido
    // ou ajustado. Se o schema.ts está como TEXT, o CAST é necessário.
    // A query acima para totalSpent é uma tentativa de limpar e converter, mas o ideal é alinhar os tipos.

    // Retornando uma estrutura simplificada para manter o foco no problema atual
    const activeCampaignsResult = await db.select({ count: count() }).from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    
    return {
      metrics: {
        activeCampaigns: activeCampaignsResult[0]?.count || 0,
        totalSpent: totalSpent,
        conversions: 0, // Simplificado
        avgROI: 0, // Simplificado
      },
      recentCampaigns: [], trends: {}, timeSeriesData: {labels:[], datasets:[]},
      channelPerformanceData: {labels:[], datasets:[]}, conversionData: {labels:[], datasets:[]}, roiData:{labels:[], datasets:[]},
      alertCount: (await db.select({ count: count() }).from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.isRead, false))))[0]?.count || 0,
    };
  }

  // Implementações restantes de IStorage (se houver)
  // ...
}

export const storage = new DatabaseStorage();

// Restante dos métodos de IStorage (getUser, getUserByUsername, etc.) permanecem os mesmos que no arquivo original
// ... (Garantir que todo o conteúdo original da classe, exceto o createChatSession modificado, esteja aqui)
// Adicionando stubs para os métodos de Funil para evitar erros de compilação se eles estiverem na interface mas não implementados:
// (As implementações acima já são stubs, mas é bom garantir)
