// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Enums do Banco de Dados
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'completed', 'draft']);
export const chatSenderEnum = pgEnum('chat_sender', ['user', 'agent']);
export const launchPhaseEnum = pgEnum('launch_phase', ['pre_launch', 'launch', 'post_launch']); // Enum para a tabela copies

// --- Definições de Tabelas ---
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft").notNull(),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  objectives: jsonb("objectives").$type<string[]>().default([]).notNull(),
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

export const copies = pgTable("copies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  purposeKey: text("purpose_key").notNull(),
  launchPhase: launchPhaseEnum("launch_phase").notNull(),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  baseInfo: jsonb("base_info").$type<any>().default({}), // Idealmente, defina um tipo mais específico se BaseGeneratorFormState for compartilhado
  fullGeneratedResponse: jsonb("full_generated_response").$type<any>().default({}),
  platform: text("platform"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creatives = pgTable("creatives", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }), name: text("name").notNull(), type: text("type", { enum: ["image", "video", "text", "carousel"] }).notNull(), fileUrl: text("file_url"), content: text("content"), status: text("status", { enum: ["approved", "pending", "rejected"] }).default("pending").notNull(), platforms: jsonb("platforms").$type<string[]>().default([]).notNull(), thumbnailUrl: text("thumbnail_url"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),});
export const metrics = pgTable("metrics", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), date: timestamp("date", { withTimezone: true }).notNull(), impressions: integer("impressions").default(0).notNull(), clicks: integer("clicks").default(0).notNull(), conversions: integer("conversions").default(0).notNull(), cost: decimal("cost", { precision: 10, scale: 2 }).default("0").notNull(), revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0").notNull(), leads: integer("leads").default(0).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),});
export const whatsappMessages = pgTable("whatsapp_messages", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), contactNumber: text("contact_number").notNull(), contactName: text("contact_name"), message: text("message").notNull(), direction: text("direction", { enum: ["incoming", "outgoing"] }).notNull(), timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(), isRead: boolean("is_read").default(false).notNull(),});
export const alerts = pgTable("alerts", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }), type: text("type", { enum: ["budget", "performance", "approval", "system"] }).notNull(), title: text("title").notNull(), message: text("message").notNull(), isRead: boolean("is_read").default(false).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),});
export const budgets = pgTable("budgets", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }), totalBudget: decimal("total_budget", { precision: 10, scale: 2 }).notNull(), spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0").notNull(), period: text("period", { enum: ["daily", "weekly", "monthly", "total"] }).notNull(), startDate: timestamp("start_date", { withTimezone: true }).notNull(), endDate: timestamp("end_date", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),});
export const landingPages = pgTable("landing_pages", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), name: text("name").notNull(), studioProjectId: varchar("studio_project_id", { length: 255 }).unique(), slug: varchar("slug", { length: 255 }).notNull().unique(), description: text("description"), grapesJsData: jsonb("grapes_js_data"), status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(), publicUrl: text("public_url"), publishedAt: timestamp("published_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),});
export const chatSessions = pgTable('chat_sessions', { /* ... (como no seu arquivo original) ... */ id: serial('id').primaryKey(), userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), title: text('title').notNull().default('Nova Conversa'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),});
export const chatMessages = pgTable('chat_messages', { /* ... (como no seu arquivo original) ... */ id: serial('id').primaryKey(), sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }), sender: chatSenderEnum('sender').notNull(), text: text('text').notNull(), attachmentUrl: text('attachment_url'), timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),});
export const funnels = pgTable("funnels", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }), name: text("name").notNull(), description: text("description"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),});
export const funnelStages = pgTable("funnel_stages", { /* ... (como no seu arquivo original) ... */ id: serial("id").primaryKey(), funnelId: integer("funnel_id").notNull().references(() => funnels.id, { onDelete: 'cascade' }), name: text("name").notNull(), description: text("description"), order: integer("order").notNull().default(0), config: jsonb("config").$type<Record<string, any>>(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),});

// --- RELAÇÕES ---
// (Mantenha suas relações como estão, mas adicione/verifique a de 'copies')
export const userRelations = relations(users, ({ many }) => ({ campaigns: many(campaigns), creatives: many(creatives), metrics: many(metrics), whatsappMessages: many(whatsappMessages), copies: many(copies), alerts: many(alerts), budgets: many(budgets), landingPages: many(landingPages), chatSessions: many(chatSessions), funnels: many(funnels), }));
export const campaignRelations = relations(campaigns, ({ one, many }) => ({ user: one(users, { fields: [campaigns.userId], references: [users.id] }), creatives: many(creatives), metrics: many(metrics), copies: many(copies), alerts: many(alerts), budgets: many(budgets), funnels: many(funnels), }));
export const creativeRelations = relations(creatives, ({ one }) => ({ user: one(users, { fields: [creatives.userId], references: [users.id] }), campaign: one(campaigns, { fields: [creatives.campaignId], references: [campaigns.id] }), }));
export const metricRelations = relations(metrics, ({ one }) => ({ campaign: one(campaigns, { fields: [metrics.campaignId], references: [campaigns.id] }), user: one(users, { fields: [metrics.userId], references: [users.id] }), }));
export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({ user: one(users, { fields: [whatsappMessages.userId], references: [users.id] }), }));
export const copyRelations = relations(copies, ({ one }) => ({ user: one(users, { fields: [copies.userId], references: [users.id] }), campaign: one(campaigns, { fields: [copies.campaignId], references: [campaigns.id] }), }));
export const alertRelations = relations(alerts, ({ one }) => ({ user: one(users, { fields: [alerts.userId], references: [users.id] }), campaign: one(campaigns, { fields: [alerts.campaignId], references: [campaigns.id] }), }));
export const budgetRelations = relations(budgets, ({ one }) => ({ user: one(users, { fields: [budgets.userId], references: [users.id] }), campaign: one(campaigns, { fields: [budgets.campaignId], references: [campaigns.id] }), }));
export const landingPageRelations = relations(landingPages, ({ one }) => ({ user: one(users, { fields: [landingPages.userId], references: [users.id] }), }));
export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({ user: one(users, { fields: [chatSessions.userId], references: [users.id] }), messages: many(chatMessages), }));
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({ session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }), }));
export const funnelRelations = relations(funnels, ({ one, many }) => ({ user: one(users, { fields: [funnels.userId], references: [users.id] }), campaign: one(campaigns, { fields: [funnels.campaignId], references: [campaigns.id] }), stages: many(funnelStages), }));
export const funnelStageRelations = relations(funnelStages, ({ one }) => ({ funnel: one(funnels, { fields: [funnelStages.funnelId], references: [funnels.id] }), }));

// --- SCHEMAS ZOD PARA INSERÇÃO ---
export const insertUserSchema = createInsertSchema(users, { /* ... como no seu original ... */ email: z.string().email("Email inválido."), username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres."), password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),}).omit({ id: true, createdAt: true, updatedAt: true,});
export const insertCampaignSchema = createInsertSchema(campaigns, { /* ... como no seu original ... */ name: z.string().min(1, "Nome da campanha é obrigatório."), budget: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Orçamento deve ser um número" }).nullable().optional() ), dailyBudget: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Orçamento diário deve ser um número" }).nullable().optional() ), avgTicket: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Ticket médio deve ser um número" }).nullable().optional() ), startDate: z.preprocess( (arg) => { if (typeof arg === "string" || arg instanceof Date) return new Date(arg); return undefined; }, z.date().optional().nullable() ), endDate: z.preprocess( (arg) => { if (typeof arg === "string" || arg instanceof Date) return new Date(arg); return undefined; }, z.date().optional().nullable() ),}).omit({ id: true, createdAt: true, updatedAt: true,});
export const insertCreativeSchema = createInsertSchema(creatives, { /* ... como no seu original ... */ name: z.string().min(1, "Nome do criativo é obrigatório."), type: z.enum(["image", "video", "text", "carousel"]), platforms: z.preprocess( (val) => { if (Array.isArray(val)) { return val; } if (typeof val === 'string') { return val.split(',').map(s => s.trim()).filter(s => s.length > 0); } return []; }, z.array(z.string()).optional() ), fileUrl: z.string().nullable().optional(), campaignId: z.preprocess( (val) => { if (val === "null" || val === "" || val === "NONE" || val === undefined) { return null; } if (typeof val === 'number' || val === null) { return val; } if (typeof val === 'string') { const parsed = parseInt(val); return isNaN(parsed) ? null : parsed; } return null; }, z.number().nullable().optional() ),}).omit({ id: true, createdAt: true, updatedAt: true,});
// ... Manter seus outros insert schemas (Metric, WhatsappMessage, Alert, Budget, LandingPage, etc.)

// --- Insert Schema para COPIES ATUALIZADO ---
export const insertCopySchema = createInsertSchema(copies, {
  title: z.string().min(1, "Título da copy é obrigatório."),
  content: z.string().min(1, "Conteúdo (mainCopy) é obrigatório."),
  purposeKey: z.string().min(1, "Chave da finalidade é obrigatória."),
  launchPhase: z.enum(launchPhaseEnum.enumValues),
  details: z.record(z.any()).optional().nullable().default({}),
  baseInfo: z.record(z.any()).optional().nullable().default({}), // Se tiver BaseGeneratorFormState como tipo Zod, use-o aqui
  fullGeneratedResponse: z.record(z.any()).optional().nullable().default({}),
  platform: z.string().optional().nullable(),
  isFavorite: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().nullable().default([]),
  campaignId: z.preprocess(
    (val) => (val === undefined || val === null || val === "" || String(val).toUpperCase() === "NONE" ? null : parseInt(String(val))),
    z.number().int().positive().nullable().optional()
  ),
}).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true, // Omitir para que o banco ou a lógica de update o gerencie
});

// --- Select Schema para COPIES (para tipar dados lidos do banco) ---
export const selectCopySchema = createSelectSchema(copies);

// --- Tipos Inferidos (manter os seus e adicionar/ajustar para Copy) ---
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
// ... Manter seus outros tipos inferidos ...
export type Copy = z.infer<typeof selectCopySchema>;
export type InsertCopy = z.infer<typeof insertCopySchema>;
