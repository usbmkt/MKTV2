// shared/whatsapp.schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';
import { users } from './schema'; // Importar users do schema principal para FKs

// Enums para WhatsApp
export const whatsappConnectionStatusEnum = pgEnum('whatsapp_connection_status', ['disconnected', 'connecting', 'connected', 'qr_code_needed', 'auth_failure', 'error', 'loading']);
export const flowTriggerTypeEnum = pgEnum('flow_trigger_type', ['keyword', 'first_message', 'button_click', 'scheduled', 'api_call', 'manual']);
export const flowStatusEnum = pgEnum('flow_status', ['draft', 'active', 'inactive', 'archived']);
export const messageTemplateCategoryEnum = pgEnum('message_template_category', ['MARKETING', 'UTILITY', 'AUTHENTICATION']);
export const messageTemplateStatusMetaEnum = pgEnum('message_template_status_meta', ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'DRAFT']);

// Tipos para FlowElements (Placeholder - idealmente viria de uma definição mais robusta, talvez de zap.ts)
export type FlowNodeData = { label: string; [key: string]: any; };
export type FlowNode = { id: string; type: string; position: { x: number; y: number }; data: FlowNodeData; };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: string; type?: string; animated?: boolean; };
export interface FlowElements { nodes: FlowNode[]; edges: FlowEdge[]; }

// --- Tabelas do WhatsApp ---
export const whatsappConnections = pgTable("whatsapp_connections", {
  id: serial("id").primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionStatus: whatsappConnectionStatusEnum('status').notNull().default('disconnected'),
  qrCodeData: text('qr_code_data'),
  sessionPath: text('session_path'),
  connectedPhoneNumber: text('connected_phone_number'),
  lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userConnIndex: uniqueIndex('whatsapp_connections_user_id_idx').on(table.userId),
}));

export const whatsappFlows = pgTable("whatsapp_flows", {
  id: serial("id").primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  triggerType: flowTriggerTypeEnum('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').$type<Record<string, any>>().default({}),
  status: flowStatusEnum('status').notNull().default('draft'),
  elements: jsonb('elements').$type<FlowElements>().default({ nodes: [], edges: [] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const whatsappFlowUserStates = pgTable("whatsapp_flow_user_states", {
  id: serial("id").primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactJid: text('contact_jid').notNull(),
  activeFlowId: integer('active_flow_id').references(() => whatsappFlows.id, { onDelete: 'set null' }),
  currentNodeId: text('current_node_id'),
  flowVariables: jsonb('flow_variables').$type<Record<string, any>>().default({}),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userContactFlowIndex: uniqueIndex('whatsapp_flow_user_contact_flow_idx').on(table.userId, table.contactJid),
}));

export const whatsappMessageTemplates = pgTable("whatsapp_message_templates", {
  id: serial("id").primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('template_name').notNull(),
  category: messageTemplateCategoryEnum('category'),
  language: text('language_code').notNull(),
  components: jsonb('components').$type<any[]>().notNull(), // Definir tipo mais específico para componentes do template
  statusMeta: messageTemplateStatusMetaEnum('meta_status').default('DRAFT'),
  metaTemplateId: text('meta_template_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTemplateNameIndex: uniqueIndex('whatsapp_template_user_name_idx').on(table.userId, table.name),
}));

// --- Relações do WhatsApp ---
export const whatsappConnectionRelations = relations(whatsappConnections, ({ one }) => ({
  user: one(users, { fields: [whatsappConnections.userId], references: [users.id] }),
}));

export const whatsappFlowRelations = relations(whatsappFlows, ({ one, many }) => ({
  user: one(users, { fields: [whatsappFlows.userId], references: [users.id] }),
  userStates: many(whatsappFlowUserStates),
  // A relação com whatsappMessages será definida no schema principal devido à dependência mútua
}));

export const whatsappFlowUserStateRelations = relations(whatsappFlowUserStates, ({ one }) => ({
  user: one(users, { fields: [whatsappFlowUserStates.userId], references: [users.id] }),
  activeFlow: one(whatsappFlows, { fields: [whatsappFlowUserStates.activeFlowId], references: [whatsappFlows.id] }),
}));

export const whatsappMessageTemplateRelations = relations(whatsappMessageTemplates, ({ one }) => ({
  user: one(users, { fields: [whatsappMessageTemplates.userId], references: [users.id] }),
}));


// --- Schemas Zod e Tipos para WhatsApp ---
export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnections, {
  connectionStatus: z.enum(whatsappConnectionStatusEnum.enumValues).default('disconnected'),
}).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const selectWhatsappConnectionSchema = createSelectSchema(whatsappConnections);
export type WhatsappConnection = z.infer<typeof selectWhatsappConnectionSchema>;
export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;

export const insertWhatsappFlowSchema = createInsertSchema(whatsappFlows, {
  name: z.string().min(1, "Nome do fluxo é obrigatório."),
  triggerType: z.enum(flowTriggerTypeEnum.enumValues),
  status: z.enum(flowStatusEnum.enumValues).default('draft'),
  elements: z.custom<FlowElements>((val) => {
    return typeof val === 'object' && val !== null && Array.isArray((val as any).nodes) && Array.isArray((val as any).edges);
  }).default({ nodes: [], edges: [] }),
  triggerConfig: z.record(z.any()).optional().default({}),
}).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const selectWhatsappFlowSchema = createSelectSchema(whatsappFlows);
export type WhatsappFlow = z.infer<typeof selectWhatsappFlowSchema>;
export type InsertWhatsappFlow = z.infer<typeof insertWhatsappFlowSchema>;

export const insertWhatsappFlowUserStateSchema = createInsertSchema(whatsappFlowUserStates, {
  contactJid: z.string().min(1, "JID do contato é obrigatório."),
  flowVariables: z.record(z.any()).optional().default({}),
}).omit({ id: true, userId: true, lastInteractionAt: true });
export const selectWhatsappFlowUserStateSchema = createSelectSchema(whatsappFlowUserStates);
export type WhatsappFlowUserState = z.infer<typeof selectWhatsappFlowUserStateSchema>;
export type InsertWhatsappFlowUserState = z.infer<typeof insertWhatsappFlowUserStateSchema>;

export const insertWhatsappMessageTemplateSchema = createInsertSchema(whatsappMessageTemplates, {
  name: z.string().min(1, "Nome do template é obrigatório."),
  language: z.string().min(2, "Código do idioma é obrigatório (ex: pt_BR)."),
  components: z.array(z.any()).min(1, "Pelo menos um componente (BODY) é obrigatório."),
  category: z.enum(messageTemplateCategoryEnum.enumValues).optional(),
  statusMeta: z.enum(messageTemplateStatusMetaEnum.enumValues).default('DRAFT').optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, userId: true });
export const selectWhatsappMessageTemplateSchema = createSelectSchema(whatsappMessageTemplates);
export type WhatsappMessageTemplate = z.infer<typeof selectWhatsappMessageTemplateSchema>;
export type InsertWhatsappMessageTemplate = z.infer<typeof insertWhatsappMessageTemplateSchema>;

// Exportar todos os schemas para serem usados no schema principal
export const whatsappSchema = {
    whatsappConnectionStatusEnum,
    flowTriggerTypeEnum,
    flowStatusEnum,
    messageTemplateCategoryEnum,
    messageTemplateStatusMetaEnum,
    whatsappConnections,
    whatsappFlows,
    whatsappFlowUserStates,
    whatsappMessageTemplates,
    whatsappConnectionRelations,
    whatsappFlowRelations,
    whatsappFlowUserStateRelations,
    whatsappMessageTemplateRelations,
    insertWhatsappConnectionSchema,
    selectWhatsappConnectionSchema,
    insertWhatsappFlowSchema,
    selectWhatsappFlowSchema,
    insertWhatsappFlowUserStateSchema,
    selectWhatsappFlowUserStateSchema,
    insertWhatsappMessageTemplateSchema,
    selectWhatsappMessageTemplateSchema,
};
