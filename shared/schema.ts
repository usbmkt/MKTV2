// usbmkt/mktv2/MKTV2-mktv5/shared/schema.ts

import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'completed', 'draft']);
export const chatSenderEnum = pgEnum('chat_sender', ['user', 'agent', 'system']);
export const launchPhaseEnum = pgEnum('launch_phase', ['pre_launch', 'launch', 'post_launch']);
export const flowStatusEnum = pgEnum('flow_status', ['active', 'inactive', 'draft']);

// --- ZOD SCHEMAS for validation ---
export const launchPhaseSchema = z.enum(launchPhaseEnum.enumValues);
export type LaunchPhase = z.infer<typeof launchPhaseSchema>;

// --- INTERFACES FOR COMPLEX JSON ---
export interface BaseGeneratorFormState { product: string; audience: string; objective: 'sales' | 'leads' | 'engagement' | 'awareness'; tone: 'professional' | 'casual' | 'urgent' | 'inspirational' | 'educational' | 'empathetic' | 'divertido' | 'sofisticado';}
export interface FlowElementData { nodes: any[]; edges: any[]; }

// --- TABLES ---

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
    details: jsonb("details").$type<Record<string, any>>().default({}).notNull(),
    baseInfo: jsonb("base_info").$type<BaseGeneratorFormState | any>().default({}).notNull(),
    fullGeneratedResponse: jsonb("full_generated_response").$type<any>().default({}).notNull(),
    platform: text("platform"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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

export const funnels = pgTable("funnels", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const funnelStages = pgTable("funnel_stages", {
    id: serial("id").primaryKey(),
    funnelId: integer("funnel_id").notNull().references(() => funnels.id, { onDelete: 'cascade' }),
    name: text("name").notNull(),
    description: text("description"),
    order: integer("order").notNull().default(0),
    config: jsonb("config").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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

export const flows = pgTable("flows", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
    name: text("name").notNull(),
    status: flowStatusEnum("status").default("draft").notNull(),
    elements: jsonb("elements").$type<FlowElementData>().default({'nodes': [], 'edges': []}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const whatsappMessageTemplates = pgTable('whatsapp_message_templates', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('template_name').notNull(),
    category: text('category'),
    language: text('language_code').notNull(),
    components: jsonb('components').notNull(),
    statusMeta: text('meta_status').default('DRAFT'),
    metaTemplateId: text('meta_template_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const whatsappFlowUserStates = pgTable('whatsapp_flow_user_states', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    contactJid: text('contact_jid').notNull(),
    activeFlowId: integer('active_flow_id').references(() => flows.id, { onDelete: 'set null' }),
    currentNodeId: text('current_node_id'),
    flowVariables: jsonb('flow_variables').$type<Record<string, any>>().default('{}'),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
  }, (table) => ({
    unq: unique().on(table.userId, table.contactJid),
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

export const chatSessions = pgTable('chat_sessions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Nova Conversa'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Adicionado
    sender: chatSenderEnum('sender').notNull(),
    text: text('text').notNull(),
    attachmentUrl: text('attachment_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), // Renomeado para consistência
});

// --- RELATIONS ---
export const userRelations = relations(users, ({ many }) => ({ campaigns: many(campaigns), creatives: many(creatives), copies: many(copies), alerts: many(alerts), budgets: many(budgets), landingPages: many(landingPages), chatSessions: many(chatSessions), funnels: many(funnels), flows: many(flows), whatsappFlowUserStates: many(whatsappFlowUserStates), whatsappMessageTemplates: many(whatsappMessageTemplates), whatsappMessages: many(whatsappMessages) }));
export const campaignRelations = relations(campaigns, ({ one, many }) => ({ user: one(users, { fields: [campaigns.userId], references: [users.id] }), creatives: many(creatives), copies: many(copies), alerts: many(alerts), budgets: many(budgets), funnels: many(funnels), flows: many(flows) }));
export const creativeRelations = relations(creatives, ({ one }) => ({ user: one(users, { fields: [creatives.userId], references: [users.id] }), campaign: one(campaigns, { fields: [creatives.campaignId], references: [campaigns.id] })}));
export const copyRelations = relations(copies, ({ one }) => ({ user: one(users, { fields: [copies.userId], references: [users.id] }), campaign: one(campaigns, { fields: [copies.campaignId], references: [campaigns.id] })}));
export const alertRelations = relations(alerts, ({ one }) => ({ user: one(users, { fields: [alerts.userId], references: [users.id] }), campaign: one(campaigns, { fields: [alerts.campaignId], references: [campaigns.id] })}));
export const budgetRelations = relations(budgets, ({ one }) => ({ user: one(users, { fields: [budgets.userId], references: [users.id] }), campaign: one(campaigns, { fields: [budgets.campaignId], references: [campaigns.id] })}));
export const landingPageRelations = relations(landingPages, ({ one }) => ({ user: one(users, { fields: [landingPages.userId], references: [users.id] })}));
export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({ user: one(users, { fields: [chatSessions.userId], references: [users.id] }), messages: many(chatMessages)}));
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({ session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }), user: one(users, { fields: [chatMessages.userId], references: [users.id] })}));
export const funnelRelations = relations(funnels, ({ one, many }) => ({ user: one(users, { fields: [funnels.userId], references: [users.id] }), campaign: one(campaigns, { fields: [funnels.campaignId], references: [campaigns.id] }), stages: many(funnelStages)}));
export const funnelStageRelations = relations(funnelStages, ({ one }) => ({ funnel: one(funnels, { fields: [funnelStages.funnelId], references: [funnels.id] })}));
export const flowRelations = relations(flows, ({ one, many }) => ({ user: one(users, { fields: [flows.userId], references: [users.id] }), campaign: one(campaigns, { fields: [flows.campaignId], references: [campaigns.id] }), userStates: many(whatsappFlowUserStates) }));
export const whatsappFlowUserStateRelations = relations(whatsappFlowUserStates, ({ one }) => ({ user: one(users, { fields: [whatsappFlowUserStates.userId], references: [users.id] }), flow: one(flows, { fields: [whatsappFlowUserStates.activeFlowId], references: [flows.id] })}));
export const whatsappMessageTemplateRelations = relations(whatsappMessageTemplates, ({ one }) => ({ user: one(users, { fields: [whatsappMessageTemplates.userId], references: [users.id] })}));
export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({ user: one(users, { fields: [whatsappMessages.userId], references: [users.id] })}));


// --- INSERT SCHEMAS (ZOD) ---
export const insertUserSchema = createInsertSchema(users, { email: z.string().email("Email inválido."), username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres."), password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."), }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns, { name: z.string().min(1, "Nome da campanha é obrigatório."), budget: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Orçamento deve ser um número" }).nullable().optional() ), dailyBudget: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Orçamento diário deve ser um número" }).nullable().optional() ), avgTicket: z.preprocess( (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : (typeof val === 'number' ? val : undefined)), z.number({ invalid_type_error: "Ticket médio deve ser um número" }).nullable().optional() ), startDate: z.preprocess( (arg) => { if (typeof arg === "string" || arg instanceof Date) return new Date(arg); return undefined; }, z.date().optional().nullable() ), endDate: z.preprocess( (arg) => { if (typeof arg === "string" || arg instanceof Date) return new Date(arg); return undefined; }, z.date().optional().nullable() ), platforms: z.preprocess( (val) => { if (Array.isArray(val)) return val; if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(s => s); return []; }, z.array(z.string()).default([]) ), objectives: z.preprocess( (val) => { if (Array.isArray(val)) return val; if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(s => s); return []; }, z.array(z.string()).default([]) ), }).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertCreativeSchema = createInsertSchema(creatives, { name: z.string().min(1, "Nome do criativo é obrigatório."), type: z.enum(creatives.type.enumValues as [string, ...string[]]), status: z.enum(creatives.status.enumValues as [string, ...string[]]).optional(), platforms: z.preprocess( (val) => { if (Array.isArray(val)) { return val; } if (typeof val === 'string') { return val.split(',').map(s => s.trim()).filter(s => s.length > 0); } return []; }, z.array(z.string()).optional() ), fileUrl: z.string().nullable().optional(), thumbnailUrl: z.string().nullable().optional(), campaignId: z.preprocess( (val) => { if (val === "NONE" || val === null || val === undefined || val === "") { return null; } const parsed = parseInt(String(val)); return isNaN(parsed) ? null : parsed; }, z.number().int().positive().nullable().optional() ),}).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertCopySchema = createInsertSchema(copies, { userId: z.number().int().positive({ message: "ID do usuário é obrigatório." }), title: z.string().min(1, "Título é obrigatório."), content: z.string().min(1, "Conteúdo é obrigatório."), purposeKey: z.string().min(1, "Chave da finalidade é obrigatória."), launchPhase: z.enum(launchPhaseEnum.enumValues, { required_error: "Fase de lançamento é obrigatória." }), campaignId: z.preprocess( (val) => (val === undefined || val === null || val === "" ? null : parseInt(String(val))), z.number().int().positive().nullable().optional() ), }).omit({ id: true, createdAt: true, lastUpdatedAt: true });
export const insertFunnelSchema = createInsertSchema(funnels, { name: z.string().min(1, "O nome do funil é obrigatório."), campaignId: z.preprocess( (val) => (val === undefined || val === null || val === "" ? null : parseInt(String(val))), z.number().int().positive().nullable().optional() ), }).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertFlowSchema = createInsertSchema(flows, { name: z.string().min(1, "Nome do fluxo é obrigatório."), status: z.enum(flowStatusEnum.enumValues).default('draft'), elements: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }).optional().nullable(), campaignId: z.preprocess( (val) => (val === undefined || val === null || val === "" ? null : parseInt(String(val))), z.number().int().positive().nullable().optional() ),}).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const insertWhatsappMessageTemplateSchema = createInsertSchema(whatsappMessageTemplates, { name: z.string().min(1, "O nome do template é obrigatório"), language: z.string().min(1, "O código do idioma é obrigatório"), components: z.record(z.any()), }).omit({ id: true, createdAt: true, updatedAt: true, userId: true });

// SELECT SCHEMAS & TYPES
export const selectUserSchema = createSelectSchema(users);
export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const selectCampaignSchema = createSelectSchema(campaigns);
export type Campaign = z.infer<typeof selectCampaignSchema>;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export const selectCreativeSchema = createSelectSchema(creatives);
export type Creative = z.infer<typeof selectCreativeSchema>;
export type InsertCreative = z.infer<typeof insertCreativeSchema>;

export const selectCopySchema = createSelectSchema(copies);
export type Copy = z.infer<typeof selectCopySchema>;
export type InsertCopy = z.infer<typeof insertCopySchema>;

export const selectFunnelSchema = createSelectSchema(funnels);
export type Funnel = z.infer<typeof selectFunnelSchema>;
export type InsertFunnel = z.infer<typeof insertFunnelSchema>;

export const selectFunnelStageSchema = createSelectSchema(funnelStages);
export type FunnelStage = z.infer<typeof selectFunnelStageSchema>;

export const selectLandingPageSchema = createSelectSchema(landingPages);
export type LandingPage = z.infer<typeof selectLandingPageSchema>;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;

export const selectBudgetSchema = createSelectSchema(budgets);
export type Budget = z.infer<typeof selectBudgetSchema>;

export const selectAlertSchema = createSelectSchema(alerts);
export type Alert = z.infer<typeof selectAlertSchema>;

export const selectFlowSchema = createSelectSchema(flows);
export type Flow = z.infer<typeof selectFlowSchema>;
export type InsertFlow = z.infer<typeof insertFlowSchema>;

export const selectWhatsappMessageTemplateSchema = createSelectSchema(whatsappMessageTemplates);
export type WhatsappMessageTemplate = z.infer<typeof selectWhatsappMessageTemplateSchema>;
export type InsertWhatsappMessageTemplate = z.infer<typeof insertWhatsappMessageTemplateSchema>;

export const selectWhatsappFlowUserStateSchema = createSelectSchema(whatsappFlowUserStates);
export type WhatsappFlowUserState = z.infer<typeof selectWhatsappFlowUserStateSchema>;
export type InsertFlowUserState = z.infer<typeof insertFlowUserStateSchema>;

export const selectWhatsappMessageSchema = createSelectSchema(whatsappMessages);
export type WhatsappMessage = z.infer<typeof selectWhatsappMessageSchema>;

export const selectChatSessionSchema = createSelectSchema(chatSessions);
export type ChatSession = z.infer<typeof selectChatSessionSchema>;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export const selectChatMessageSchema = createSelectSchema(chatMessages);
export type ChatMessage = z.infer<typeof selectChatMessageSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
