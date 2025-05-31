// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Enum para o status da campanha
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'completed', 'draft']);

// Enum para o tipo de mensagem no chat do MCP
export const chatSenderEnum = pgEnum('chat_sender', ['user', 'agent']);


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
  funnels: many(funnels), // Relacionamento com funis
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
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  creatives: many(creatives),
  metrics: many(metrics),
  copies: many(copies),
  alerts: many(alerts),
  budgets: many(budgets),
  funnels: many(funnels), // Relacionamento com funis
}));

export const creatives = pgTable("creatives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  type: text("type", { enum: ["image", "video", "text", "carousel"] }).notNull(),
  fileUrl: text("file_url"),
  content: text("content"),
  status: text("status", { enum: ["approved", "pending", "rejected"] }).default("pending").notNull(),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creativeRelations = relations(creatives, ({ one }) => ({
  user: one(users, { fields: [creatives.userId], references: [users.id] }),
  campaign: one(campaigns, { fields: [creatives.campaignId], references: [campaigns.id] }),
}));

export const metrics = pgTable("metrics", { /* ... como antes ... */ });
export const metricRelations = relations(metrics, ({ one }) => ({ /* ... como antes ... */ }));
export const whatsappMessages = pgTable("whatsapp_messages", { /* ... como antes ... */ });
export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({ /* ... como antes ... */ }));
export const copies = pgTable("copies", { /* ... como antes ... */ });
export const copyRelations = relations(copies, ({ one }) => ({ /* ... como antes ... */ }));
export const alerts = pgTable("alerts", { /* ... como antes ... */ });
export const alertRelations = relations(alerts, ({ one }) => ({ /* ... como antes ... */ }));
export const budgets = pgTable("budgets", { /* ... como antes ... */ });
export const budgetRelations = relations(budgets, ({ one }) => ({ /* ... como antes ... */ }));
export const landingPages = pgTable("landing_pages", { /* ... como antes ... */ });
export const landingPageRelations = relations(landingPages, ({ one }) => ({ /* ... como antes ... */ }));
export const chatSessions = pgTable('chat_sessions', { /* ... como antes ... */ });
export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({ /* ... como antes ... */ }));
export const chatMessages = pgTable('chat_messages', { /* ... como antes ... */ });
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({ /* ... como antes ... */ }));

// Tabelas para Funis (ESSENCIAL QUE ESTEJAM AQUI)
export const funnels = pgTable("funnels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }), 
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
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const funnelStageRelations = relations(funnelStages, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelStages.funnelId], references: [funnels.id] }),
}));

// Schemas de Inserção e Tipos (garantir que os para funis estão aqui)
// ... (todos os insertSchemas e types como na resposta 47) ...
export const insertUserSchema = createInsertSchema(users, { /* ... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns, { /* ... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreativeSchema = createInsertSchema(creatives, { /* ... */ }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMetricSchema = createInsertSchema(metrics).omit({ id: true, createdAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, { /* ... */ }).omit({ id: true, timestamp: true });
export const insertCopySchema = createInsertSchema(copies, { /* ... */ }).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alerts, { /* ... */ }).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgets, { /* ... */ }).omit({ id: true, createdAt: true });
export const insertLandingPageSchema = createInsertSchema(landingPages, { /* ... */ }).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true });
export const insertFunnelSchema = createInsertSchema(funnels, { name: z.string().min(1, "Nome do funil é obrigatório."), campaignId: z.preprocess( (val) => (val === "" || val === null || val === undefined ? null : parseInt(String(val))), z.number().nullable().optional() ), }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFunnelStageSchema = createInsertSchema(funnelStages, { name: z.string().min(1, "Nome da etapa é obrigatório."), order: z.number().min(0, "Ordem deve ser um número positivo."), }).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos
export type InsertUser = z.infer<typeof insertUserSchema>; export type User = typeof users.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>; export type Campaign = typeof campaigns.$inferSelect;
export type InsertCreative = z.infer<typeof insertCreativeSchema>; export type Creative = typeof creatives.$inferSelect;
// ... (todos os outros tipos)
export type InsertFunnel = z.infer<typeof insertFunnelSchema>; export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnelStage = z.infer<typeof insertFunnelStageSchema>; export type FunnelStage = typeof funnelStages.$inferSelect;
