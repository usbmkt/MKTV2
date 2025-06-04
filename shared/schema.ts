// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// --- Enums ---
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'completed', 'draft']);
export const chatSenderEnum = pgEnum('chat_sender', ['user', 'agent']);
// Adicionar flowStatusEnum se ainda não existir e for necessário para Flows (não Funnels)
// export const flowStatusEnum = pgEnum('flow_status', ['active', 'inactive', 'draft']);


// --- Tabelas e Relações ---
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  creatives: many(creatives),
  metrics: many(metrics),
  whatsappMessages: many(whatsappMessages),
  copies: many(copies),
  alerts: many(alerts),
  budgets: many(budgets),
  landingPages: many(landingPages),
  chatSessions: many(chatSessions),
  funnels: many(funnels), // Adicionando relação para funnels
}));

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft").notNull(),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  objectives: jsonb("objectives").$type<string[]>().default([]),
  budget: text("budget"),
  dailyBudget: text("daily_budget"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  targetAudience: text("target_audience"),
  industry: text("industry"),
  avgTicket: text("avg_ticket"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  creatives: many(creatives),
  metrics: many(metrics),
  copies: many(copies),
  alerts: many(alerts),
  budgets: many(budgets),
  funnels: many(funnels), // Adicionando relação para funnels
}));

export const creatives = pgTable("creatives", { /* ...definição existente... */ });
export const creativeRelations = relations(creatives, ({ one }) => ({ /* ...definição existente... */ }));
export const metrics = pgTable("metrics", { /* ...definição existente... */ });
export const metricRelations = relations(metrics, ({ one }) => ({ /* ...definição existente... */ }));
export const whatsappMessages = pgTable("whatsapp_messages", { /* ...definição existente... */ });
export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({ /* ...definição existente... */ }));
export const copies = pgTable("copies", { /* ...definição existente... */ });
export const copyRelations = relations(copies, ({ one }) => ({ /* ...definição existente... */ }));
export const alerts = pgTable("alerts", { /* ...definição existente... */ });
export const alertRelations = relations(alerts, ({ one }) => ({ /* ...definição existente... */ }));
export const budgets = pgTable("budgets", { /* ...definição existente... */ });
export const budgetRelations = relations(budgets, ({ one }) => ({ /* ...definição existente... */ }));
export const landingPages = pgTable("landing_pages", { /* ...definição existente... */ });
export const landingPageRelations = relations(landingPages, ({ one }) => ({ /* ...definição existente... */ }));
export const chatSessions = pgTable('chat_sessions', { /* ...definição existente... */ });
export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({ /* ...definição existente... */ }));
export const chatMessages = pgTable('chat_messages', { /* ...definição existente... */ });
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({ /* ...definição existente... */ }));


// --- Novas definições para Funis ---
export const funnels = pgTable("funnels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }), // Pode ser nulo ou associado a uma campanha
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const funnelRelations = relations(funnels, ({ one, many }) => ({
  user: one(users, { fields: [funnels.userId], references: [users.id] }),
  campaign: one(campaigns, { fields: [funnels.campaignId], references: [campaigns.id] }),
  stages: many(funnelStages),
}));

export const funnelStages = pgTable("funnel_stages", {
  id: serial("id").primaryKey(),
  funnelId: integer("funnel_id").notNull().references(() => funnels.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0), // Para definir a sequência das etapas
  config: jsonb("config").$type<Record<string, any>>(), // Configurações específicas da etapa (ex: métricas alvo, tipo de conteúdo)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const funnelStageRelations = relations(funnelStages, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelStages.funnelId], references: [funnels.id] }),
}));
// --- Fim das Novas definições para Funis ---


// --- Schemas de Inserção e Tipos Zod ---
export const insertUserSchema = createInsertSchema(users, { /* ...definição existente... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns, { /* ...definição existente... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreativeSchema = createInsertSchema(creatives, { /* ...definição existente... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMetricSchema = createInsertSchema(metrics).omit({ id: true, createdAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, { /* ...definição existente... */ }).omit({ id: true, timestamp: true });
export const insertCopySchema = createInsertSchema(copies, { /* ...definição existente... */ }).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alerts, { /* ...definição existente... */ }).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgets, { /* ...definição existente... */ }).omit({ id: true, createdAt: true });
export const insertLandingPageSchema = createInsertSchema(landingPages, { /* ...definição existente... */ }).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true });

// --- Novos Schemas Zod para Funis ---
export const insertFunnelSchema = createInsertSchema(funnels, {
  name: z.string().min(1, "Nome do funil é obrigatório."),
  campaignId: z.preprocess( // Tratar string "null" ou vazia para null numérico
    (val) => (val === "null" || val === "" ? null : typeof val === 'string' ? parseInt(val) : val),
    z.number().nullable().optional()
  ),
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true }); // userId será pego do token

export const insertFunnelStageSchema = createInsertSchema(funnelStages, {
  name: z.string().min(1, "Nome da etapa é obrigatório."),
  order: z.number().int().min(0),
  config: z.record(z.string(), z.any()).optional(), // Permite um JSONB flexível
}).omit({ id: true, funnelId: true, createdAt: true, updatedAt: true }); // funnelId será fornecido no contexto
// --- Fim dos Novos Schemas Zod para Funis ---


// --- Tipos Drizzle e Zod ---
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Creative = typeof creatives.$inferSelect;
export type InsertCreative = z.infer<typeof insertCreativeSchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type Copy = typeof copies.$inferSelect;
export type InsertCopy = z.infer<typeof insertCopySchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// --- Novos Tipos para Funis ---
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = z.infer<typeof insertFunnelSchema>;
export type FunnelStage = typeof funnelStages.$inferSelect;
export type InsertFunnelStage = z.infer<typeof insertFunnelStageSchema>;
// --- Fim dos Novos Tipos para Funis ---


// Exportação default agrupada (mantendo para o backend)
const allSchemas = {
  campaignStatusEnum, chatSenderEnum, // Adicionar flowStatusEnum se existir
  users, userRelations, campaigns, campaignRelations, creatives, creativeRelations,
  metrics, metricRelations, whatsappMessages, whatsappMessageRelations, copies, copyRelations,
  alerts, alertRelations, budgets, budgetRelations, landingPages, landingPageRelations,
  chatSessions, chatSessionRelations, chatMessages, chatMessageRelations,
  funnels, funnelRelations, funnelStages, funnelStageRelations, // Adicionando funis aqui

  insertUserSchema, insertCampaignSchema, insertCreativeSchema, insertMetricSchema,
  insertWhatsappMessageSchema, insertCopySchema, insertAlertSchema, insertBudgetSchema,
  insertLandingPageSchema, insertChatSessionSchema, insertChatMessageSchema,
  insertFunnelSchema, insertFunnelStageSchema, // Adicionando schemas zod de funis aqui
};
export default allSchemas;