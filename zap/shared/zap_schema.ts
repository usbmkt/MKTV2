// zap/shared/zap_schema.ts
import { pgTable, serial, text, integer, timestamp, jsonb, boolean, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { type FlowElementData } from '../client/src/features/types/whatsapp_flow_types';

// Enums (como definido anteriormente)
export const whatsappConnectionStatusEnum = pgEnum('whatsapp_connection_status', ['disconnected', 'connecting', 'connected', 'qr_code_needed', 'auth_failure', 'error', 'loading']);
export const whatsappFlowTriggerTypeEnum = pgEnum('whatsapp_flow_trigger_type', ['keyword', 'first_message', 'button_click', 'api_call', 'scheduled']);
export const whatsappFlowStatusEnum = pgEnum('whatsapp_flow_status', ['draft', 'active', 'inactive', 'archived']);
export const whatsappTemplateCategoryEnum = pgEnum('whatsapp_template_category', ['MARKETING', 'UTILITY', 'AUTHENTICATION']);
export const whatsappTemplateMetaStatusEnum = pgEnum('whatsapp_template_meta_status', ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED']);

// Tabela zapUsers
export const zapUsers = pgTable('zap_users', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').unique(),
  email: text('email').unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});
export const insertZapUserSchema = createInsertSchema(zapUsers);
export const selectZapUserSchema = createSelectSchema(zapUsers);
export type ZapUser = InferSelectModel<typeof zapUsers>;
export type NewZapUser = InferInsertModel<typeof zapUsers>;

// Tabela whatsappConnections
export const whatsappConnections = pgTable('zap_whatsapp_connections', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').notNull().unique(), // Ligação com o usuário do sistema principal
  connectionStatus: whatsappConnectionStatusEnum('status').notNull().default('disconnected'),
  qrCodeData: text('qr_code_data'),
  sessionData: jsonb('session_data'),
  connectedPhoneNumber: text('connected_phone_number'),
  lastConnectedAt: timestamp('last_connected_at', { mode: 'date', withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});
export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnections);
export const selectWhatsappConnectionSchema = createSelectSchema(whatsappConnections);
export type WhatsappConnection = InferSelectModel<typeof whatsappConnections>;
export type NewWhatsappConnection = InferInsertModel<typeof whatsappConnections>;

// Tabela whatsappFlows
export const whatsappFlows = pgTable('zap_whatsapp_flows', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').notNull(), //.references(() => zapUsers.mktv2UserId), // Se zapUsers for a fonte da verdade para mktv2UserId
  name: text('name').notNull(),
  description: text('description'),
  triggerType: whatsappFlowTriggerTypeEnum('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').default('{}'),
  status: whatsappFlowStatusEnum('status').notNull().default('draft'),
  elements: jsonb('elements').$type<FlowElementData>().default({ nodes: [], edges: [], viewport: { x:0, y:0, zoom:1 } }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});
export const insertWhatsappFlowSchema = createInsertSchema(whatsappFlows, {
    elements: z.custom<FlowElementData>((data) => typeof data === 'object' && data !== null && 'nodes' in data && 'edges' in data), // Validação customizada para JSONB
    triggerConfig: z.record(z.any()).optional().default({}),
});
export const selectWhatsappFlowSchema = createSelectSchema(whatsappFlows, {
    elements: z.custom<FlowElementData>((data) => typeof data === 'object' && data !== null && 'nodes' in data && 'edges' in data),
    triggerConfig: z.record(z.any()),
});
export type WhatsappFlow = InferSelectModel<typeof whatsappFlows>;
export type NewWhatsappFlow = InferInsertModel<typeof whatsappFlows>;


// Tabela whatsappFlowUserStates
export const whatsappFlowUserStates = pgTable('zap_whatsapp_flow_user_states', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').notNull(),
  contactJid: text('contact_jid').notNull(),
  activeFlowId: integer('active_flow_id').references(() => whatsappFlows.id, { onDelete: 'set null' }),
  currentNodeId: text('current_node_id'),
  flowVariables: jsonb('flow_variables').default('{}'),
  lastInteractionAt: timestamp('last_interaction_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  contactFlowUserUnique: uniqueIndex('zap_contact_flow_user_unique_idx').on(table.mktv2UserId, table.contactJid, table.activeFlowId),
}));
export const insertWhatsappFlowUserStateSchema = createInsertSchema(whatsappFlowUserStates, {
    flowVariables: z.record(z.any()).optional().default({}),
});
export const selectWhatsappFlowUserStateSchema = createSelectSchema(whatsappFlowUserStates, {
    flowVariables: z.record(z.any()),
});

// Tabela whatsappMessages
export const whatsappMessageDirectionEnum = pgEnum('whatsapp_message_direction', ['incoming', 'outgoing']);
export const whatsappMessageStatusEnum = pgEnum('whatsapp_message_status', ['pending', 'sent', 'delivered', 'read', 'played', 'failed']);
export const whatsappMessageTypeEnum = pgEnum('whatsapp_message_type', ['text', 'image', 'video', 'audio', 'document', 'sticker', 'reaction', 'location', 'contact', 'template', 'unsupported']);

export const whatsappMessages = pgTable('zap_whatsapp_messages', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').notNull(),
  baileysMessageId: text('baileys_message_id').unique(),
  contactJid: text('contact_jid').notNull(),
  flowId: integer('flow_id').references(() => whatsappFlows.id, { onDelete: 'set null' }),
  messageType: whatsappMessageTypeEnum('message_type').notNull(),
  content: jsonb('content').notNull(), // ex: { text: "Olá" }, { url: "...", caption: "..." }
  direction: whatsappMessageDirectionEnum('direction').notNull(),
  status: whatsappMessageStatusEnum('status'), // Para outgoing
  timestamp: timestamp('timestamp', { mode: 'date', withTimezone: true }).notNull(),
  isReadByZapUser: boolean('is_read_by_zap_user').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  // Adicionando campos para mensagens respondidas
  quotedMessageId: text('quoted_message_id'), // ID da mensagem original (baileysMessageId)
  quotedMessageContent: jsonb('quoted_message_content'), // Preview do conteúdo da mensagem respondida
  quotedMessageSenderJid: text('quoted_message_sender_jid'), // JID de quem enviou a mensagem original
});
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, {
    content: z.record(z.any()), // Validação mais específica pode ser adicionada
    quotedMessageContent: z.record(z.any()).optional(),
});
export const selectWhatsappMessageSchema = createSelectSchema(whatsappMessages, {
    content: z.record(z.any()),
    quotedMessageContent: z.record(z.any()).optional(),
});
export type ZapMessage = InferSelectModel<typeof whatsappMessages>;
export type NewZapMessage = InferInsertModel<typeof whatsappMessages>;


// Tabela whatsappMessageTemplates
export const whatsappMessageTemplates = pgTable('zap_whatsapp_message_templates', {
  id: serial('id').primaryKey(),
  mktv2UserId: integer('mktv2_user_id').notNull(),
  name: text('template_name').notNull(),
  category: whatsappTemplateCategoryEnum('category'),
  language: text('language_code').notNull(), // ex: 'pt_BR'
  components: jsonb('components').notNull(), // Estrutura oficial da Meta
  metaTemplateId: text('meta_template_id'),
  statusMeta: whatsappTemplateMetaStatusEnum('meta_status').default('PENDING'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameUserLangUnique: uniqueIndex('zap_template_name_user_lang_unique_idx').on(table.mktv2UserId, table.name, table.language),
}));
export const insertWhatsappMessageTemplateSchema = createInsertSchema(whatsappMessageTemplates, {
    components: z.array(z.record(z.any())), // Validação mais específica para componentes de template
});
export const selectWhatsappMessageTemplateSchema = createSelectSchema(whatsappMessageTemplates);

// Relações (opcional, mas útil para queries complexas com Drizzle)
export const zapUserRelations = relations(zapUsers, ({ many }) => ({
  connections: many(whatsappConnections, { relationName: 'userToConnections' }),
  flows: many(whatsappFlows, { relationName: 'userToFlows' }),
  messages: many(whatsappMessages, { relationName: 'userToMessages' }),
  templates: many(whatsappMessageTemplates, { relationName: 'userToTemplates' }),
}));

export const whatsappFlowsRelations = relations(whatsappFlows, ({ one, many }) => ({
  user: one(zapUsers, {
    fields: [whatsappFlows.mktv2UserId],
    references: [zapUsers.mktv2UserId], // Assumindo que mktv2UserId em zapUsers é a chave de referência
    relationName: 'flowToUser',
  }),
  userStates: many(whatsappFlowUserStates),
  messages: many(whatsappMessages),
}));

// Adicione mais relações conforme necessário