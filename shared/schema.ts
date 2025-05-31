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
  funnels: many(funnels),
}));

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft").notNull(),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  objectives: jsonb("objectives").$type<string[]>().default([]),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  targetAudience: text("target_audience"),
  industry: text("industry"),
  avgTicket: decimal("avg_ticket", { precision: 10, scale: 2 }),
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
  funnels: many(funnels),
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

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: timestamp("date", { withTimezone: true }).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0").notNull(),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0").notNull(),
  leads: integer("leads").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const metricRelations = relations(metrics, ({ one }) => ({
  campaign: one(campaigns, { fields: [metrics.campaignId], references: [campaigns.id] }),
  user: one(users, { fields: [metrics.userId], references: [users.id] }),
}));

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactNumber: text("contact_number").notNull(),
  contactName: text("contact_name"),
  message: text("message").notNull(),
  direction: text("direction", { enum: ["incoming", "outgoing"] }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  isRead: boolean("is_read").default(false).notNull(),
});

export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(users, { fields: [whatsappMessages.userId], references: [users.id] }),
}));

export const copies = pgTable("copies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type", { enum: ["headline", "body", "cta", "description"] }).notNull(),
  platform: text("platform"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const copyRelations = relations(copies, ({ one }) => ({
  user: one(users, { fields: [copies.userId], references: [users.id] }),
  campaign: one(campaigns, { fields: [copies.campaignId], references: [campaigns.id] }),
}));

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  type: text("type", { enum: ["budget", "performance", "approval", "system"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const alertRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
  campaign: one(campaigns, { fields: [alerts.campaignId], references: [campaigns.id] }),
}));

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }),
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  period: text("period", { enum: ["daily", "weekly", "monthly", "total"] }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const budgetRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  campaign: one(campaigns, { fields: [budgets.campaignId], references: [campaigns.id] }),
}));

export const landingPages = pgTable("landing_pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  studioProjectId: varchar("studio_project_id", { length: 255 }).unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  grapesJsData: jsonb("grapes_js_data"),
  status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(),
  publicUrl: text("public_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landingPageRelations = relations(landingPages, ({ one }) => ({
  user: one(users, {
    fields: [landingPages.userId],
    references: [users.id],
  }),
}));

export const chatSessions = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Nova Conversa'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  sender: chatSenderEnum('sender').notNull(),
  text: text('text').notNull(),
  attachmentUrl: text('attachment_url'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }),
}));

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
  order: integer("order").notNull().default(0),
  config: jsonb("config").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const funnelStageRelations = relations(funnelStages, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelStages.funnelId], references: [funnels.id] }),
}));

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email inválido."),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres."),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns, {
  name: z.string().min(1, "Nome da campanha é obrigatório."),
  budget: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)),
    z.number({ invalid_type_error: "Orçamento deve ser um número" }).nullable().optional()
  ),
  dailyBudget: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)),
    z.number({ invalid_type_error: "Orçamento diário deve ser um número" }).nullable().optional()
  ),
  avgTicket: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)),
    z.number({ invalid_type_error: "Ticket médio deve ser um número" }).nullable().optional()
  ),
  startDate: z.preprocess(
    (arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
      return undefined;
    },
    z.date().optional().nullable()
  ),
  endDate: z.preprocess(
    (arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
      return undefined;
    },
    z.date().optional().nullable()
  ),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreativeSchema = createInsertSchema(creatives, {
  name: z.string().min(1, "Nome do criativo é obrigatório."),
  type: z.enum(["image", "video", "text", "carousel"]),
  platforms: z.preprocess(
    (val) => {
      if (Array.isArray(val)) {
        return val;
      }
      if (typeof val === 'string') {
        return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      return [];
    },
    z.array(z.string()).optional()
  ),
  fileUrl: z.string().nullable().optional(),
  campaignId: z.preprocess(
    (val) => {
      if (val === "null" || val === "" || val === "NONE" || val === undefined) { // Adicionado "NONE"
        return null;
      }
      if (typeof val === 'number' || val === null) {
        return val;
      }
      if (typeof val === 'string') {
        const parsed = parseInt(val);
        return isNaN(parsed) ? null : parsed; // Retorna null se não puder parsear
      }
      return null; // Default to null
    },
    z.number().nullable().optional()
  ),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, {
  contactNumber: z.string().min(1, "Número de contato é obrigatório."),
  message: z.string().min(1, "Mensagem é obrigatória."),
}).omit({
  id: true,
  timestamp: true,
});

export const insertCopySchema = createInsertSchema(copies, {
  title: z.string().min(1, "Título da copy é obrigatório."),
  content: z.string().min(1, "Conteúdo da copy é obrigatório."),
}).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts, {
  title: z.string().min(1, "Título do alerta é obrigatório."),
  message: z.string().min(1, "Mensagem do alerta é obrigatória."),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets, {
  totalBudget: z.preprocess( 
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)),
    z.number({ required_error: "Orçamento total é obrigatório.", invalid_type_error: "Orçamento total deve ser um número." })
  ),
  spentAmount: z.preprocess( 
    (val) => (val === "" || val === null || val === undefined ? 0 : (typeof val === 'string' ? parseFloat(val) : val)), 
    z.number({ invalid_type_error: "Valor gasto deve ser um número." }).default(0)
  ),
  startDate: z.preprocess(
    (arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
      return undefined;
    },
    z.date()
  ),
  endDate: z.preprocess(
    (arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
      return undefined;
    },
    z.date().optional().nullable()
  ),
}).omit({
  id: true,
  createdAt: true,
});

export const insertLandingPageSchema = createInsertSchema(landingPages, {
  name: z.string().min(1, "Nome da landing page é obrigatório."),
  slug: z.string().min(1, "Slug é obrigatório.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (letras minúsculas, números, hífens)."),
  studioProjectId: z.string().optional().nullable(),
  grapesJsData: z.any().optional().nullable(),
  publicUrl: z.string().url("URL pública inválida").optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertFunnelSchema = createInsertSchema(funnels, {
  name: z.string().min(1, "Nome do funil é obrigatório."),
  campaignId: z.preprocess(
    (val) => {
      if (val === "null" || val === "" || val === "NONE" || val === undefined) return null;
      if (typeof val === 'number' || val === null) return val;
      if (typeof val === 'string') {
        const parsed = parseInt(val);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    },
    z.number().nullable().optional()
  ),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFunnelStageSchema = createInsertSchema(funnelStages, {
  name: z.string().min(1, "Nome da etapa é obrigatório."),
  order: z.number().int().min(0, "Ordem deve ser um inteiro não negativo.").default(0),
  config: z.record(z.any()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCreative = z.infer<typeof insertCreativeSchema>;
export type Creative = typeof creatives.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertCopy = z.infer<typeof insertCopySchema>;
export type Copy = typeof copies.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;
export type LandingPage = typeof landingPages.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertFunnel = z.infer<typeof insertFunnelSchema>;
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnelStage = z.infer<typeof insertFunnelStageSchema>;
export type FunnelStage = typeof funnelStages.$inferSelect;
