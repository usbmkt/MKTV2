// server/storage.ts
import dotenv from "dotenv";
dotenv.config();

import { db } from './db';
import * as schema from '../shared/schema'; // Mantém importação com namespace

import { eq, count, sum, sql, desc, and, or } from 'drizzle-orm'; // sql não é mais necessário para o CAST aqui
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

// A função convertBudgetData PODE SER REMOVIDA ou simplificada, pois os tipos no schema Drizzle estarão corretos.
// Se você ainda quiser converter explicitamente para string ao INSERIR/ATUALIZAR no banco (embora Drizzle deva lidar com isso),
// pode mantê-la, mas ela não é mais necessária para a SOMA.
function convertBudgetData(data: any): any {
  const converted = { ...data };
  // Se os tipos no schema Drizzle agora são 'decimal', Drizzle/pg deve lidar com a conversão de número para string numérica do DB.
  // Esta função se torna menos crítica.
  if (typeof data.totalBudget === 'number') converted.totalBudget = String(data.totalBudget);
  if (typeof data.spentAmount === 'number') converted.spentAmount = String(data.spentAmount);
  if (typeof data.budget === 'number') converted.budget = String(data.budget);
  if (typeof data.dailyBudget === 'number') converted.dailyBudget = String(data.dailyBudget);
  if (typeof data.avgTicket === 'number') converted.avgTicket = String(data.avgTicket);
  return converted;
}

// ... (funções de gráfico simulado mantidas) ...
const chartColors = { /* ... */ };
function generateSimulatedLineChartData(/* ... */) { /* ... */ }
function generateSimulatedBarChartData(/* ... */) { /* ... */ }
function generateSimulatedDoughnutChartData(/* ... */) { /* ... */ }


export interface IStorage { /* ...mantida... */ }

export class DatabaseStorage implements IStorage {
  // ... (outros métodos CRUD mantidos, mas garantir que usem os tipos corretos do schema.*)

  async createCampaign(campaignData: schema.InsertCampaign): Promise<schema.Campaign> {
    // Se convertBudgetData for mantido E os schemas Zod agora esperam numbers para budget,
    // esta conversão pode não ser mais necessária ou precisar de ajuste.
    // Drizzle deve lidar com 'decimal' no schema para 'numeric' no DB.
    // const convertedData = convertBudgetData(campaignData); // Revisar necessidade
    const [newCampaign] = await db.insert(schema.campaigns).values(campaignData as any).returning(); // as any se convertBudgetData for removido e houver incompatibilidade temporária
    if (!newCampaign) throw new Error("Falha ao criar campanha.");
    return newCampaign;
  }

  async updateCampaign(id: number, campaignData: Partial<Omit<schema.InsertCampaign, 'userId'>>, userId: number): Promise<schema.Campaign | undefined> {
    // const convertedData = convertBudgetData(campaignData); // Revisar necessidade
    const [updatedCampaign] = await db.update(schema.campaigns)
      .set({ ...(campaignData as any), updatedAt: new Date() })
      .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)))
      .returning();
    return updatedCampaign;
  }
  
  async createBudget(budgetData: schema.InsertBudget): Promise<schema.Budget> {
    // const convertedData = convertBudgetData(budgetData); // Revisar necessidade
    const [newBudget] = await db.insert(schema.budgets).values(budgetData as any).returning();
    if (!newBudget) throw new Error("Falha ao criar orçamento.");
    return newBudget;
  }

  async updateBudget(id: number, budgetData: Partial<Omit<schema.InsertBudget, 'userId' | 'campaignId'>>, userId: number): Promise<schema.Budget | undefined> {
    // ... (similar ao createBudget, revisar convertBudgetData)
    const [updatedBudget] = await db.update(schema.budgets)
        .set(budgetData as any)
        .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)))
        .returning();
    return updatedBudget;
  }


  // --- Funções para o Dashboard ---
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

    // CORREÇÃO: Remover CAST, pois schema.budgets.spentAmount agora será decimal
    const totalSpentResult = await db.select({
        total: sum(schema.budgets.spentAmount) // <-- CAST REMOVIDO
    }).from(schema.budgets).where(budgetsUserCondition);
    // O resultado de sum(decimal) já será um tipo numérico (string que pode ser parseada ou null)
    const totalSpent = parseFloat(totalSpentResult[0]?.total || '0') || 0;

    // As somas em schema.metrics já devem funcionar pois cost e revenue são decimal
    const totalConversionsResult = await db.select({ total: sum(schema.metrics.conversions) })
      .from(schema.metrics).where(metricsTimeCondition);
    const conversions = Number(totalConversionsResult[0]?.total || 0); // Usar Number para conversão

    const totalRevenueResult = await db.select({ total: sum(schema.metrics.revenue) })
      .from(schema.metrics).where(metricsTimeCondition);
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total || '0') || 0;

    const totalCostResult = await db.select({ total: sum(schema.metrics.cost) })
      .from(schema.metrics).where(metricsTimeCondition);
    const totalCost = parseFloat(totalCostResult[0]?.total || '0') || 0;

    const avgROI = totalCost > 0 ? parseFloat((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2)) : 0;

    const totalImpressionsResult = await db.select({ total: sum(schema.metrics.impressions) })
      .from(schema.metrics).where(metricsTimeCondition);
    const impressions = Number(totalImpressionsResult[0]?.total || 0);

    const totalClicksResult = await db.select({ total: sum(schema.metrics.clicks) })
      .from(schema.metrics).where(metricsTimeCondition);
    const clicks = Number(totalClicksResult[0]?.total || 0);

    const ctr = clicks > 0 && impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 && totalCost > 0 ? parseFloat((totalCost / clicks).toFixed(2)) : 0;

    const metricsData = {
      activeCampaigns, totalSpent, conversions, avgROI, impressions, clicks, ctr, cpc
    };

    // ... (resto da função getDashboardData mantido) ...
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
      // Agora budget e dailyBudget são decimal no schema, Drizzle os retornará como string.
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
  // ... (outros métodos CRUD mantidos)
}

export const storage = new DatabaseStorage();
