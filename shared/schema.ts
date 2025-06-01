// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Importar tudo de whatsapp.schema para reexportar e para o schema agregado
import * as whatsappSchemaContents from './whatsapp.schema';

// Enums Existentes (Manter os que não são do WhatsApp)
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'completed', 'draft']);
export const chatSenderEnum = pgEnum('chat_sender', ['user', 'agent']); // MCP/Chat Geral
export const launchPhaseEnum = pgEnum('launch_phase', ['pre_launch', 'launch', 'post_launch']); // Para Copies

// --- Definições de Tipos para Copy Configurations (Existente) ---
export interface BaseGeneratorFormState { /* ... (conteúdo mantido) ... */ }
export interface FieldDefinition { /* ... (conteúdo mantido) ... */ }
export interface CopyPurposeConfig { /* ... (conteúdo mantido) ... */ }
// (Mantenha o restante das suas interfaces de CopyConfigurations aqui)
// --- Fim das Definições de Tipos para Copy Configurations ---

// --- Definições de Tabelas (Core da Aplicação) ---
export const users = pgTable("users", { /* ... (definição mantida) ... */ });
export const campaigns = pgTable("campaigns", { /* ... (definição mantida) ... */ });
export const copies = pgTable("copies", { /* ... (definição mantida) ... */ });
export const creatives = pgTable("creatives", { /* ... (definição mantida) ... */ });
export const metrics = pgTable("metrics", { /* ... (definição mantida) ... */ });

// Tabela whatsapp_messages (Core) - Modificada para referenciar whatsapp_flows
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactNumber: text("contact_number").notNull(),
  contactName: text("contact_name"),
  message: text("message").notNull(),
  direction: text("direction", { enum: ["incoming", "outgoing"] }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  flowId: integer('flow_id').references(() => whatsappSchemaContents.whatsappFlows.id, { onDelete: 'set null' }), // Corrigido para referenciar whatsapp_flows
  messageIdBaileys: text('message_id_baileys').unique(),
});

export const alerts = pgTable("alerts", { /* ... (definição mantida) ... */ });
export const budgets = pgTable("budgets", { /* ... (definição mantida) ... */ });
export const landingPages = pgTable("landing_pages", { /* ... (definição mantida) ... */ });
export const chatSessions = pgTable('chat_sessions', { /* ... (definição mantida) ... */ }); // MCP Chat Geral
export const chatMessages = pgTable('chat_messages', { /* ... (definição mantida) ... */ }); // MCP Chat Geral
export const funnels = pgTable("funnels", { /* ... (definição mantida) ... */ });
export const funnelStages = pgTable("funnel_stages", { /* ... (definição mantida) ... */ });


// --- RELAÇÕES (Combinadas) ---
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
  whatsappConnections: many(whatsappSchemaContents.whatsappConnections),
  whatsappFlows: many(whatsappSchemaContents.whatsappFlows),
  whatsappFlowUserStates: many(whatsappSchemaContents.whatsappFlowUserStates),
  whatsappMessageTemplates: many(whatsappSchemaContents.whatsappMessageTemplates),
}));

export const campaignRelations = relations(campaigns, ({ one, many }) => ({ /* ... (mantido) ... */ }));
export const creativeRelations = relations(creatives, ({ one }) => ({ /* ... (mantido) ... */ }));
export const metricRelations = relations(metrics, ({ one }) => ({ /* ... (mantido) ... */ }));
export const whatsappMessageRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(users, { fields: [whatsappMessages.userId], references: [users.id] }),
  flow: one(whatsappSchemaContents.whatsappFlows, { fields: [whatsappMessages.flowId], references: [whatsappSchemaContents.whatsappFlows.id] }),
}));
export const copyRelations = relations(copies, ({ one }) => ({ /* ... (mantido) ... */ }));
export const alertRelations = relations(alerts, ({ one }) => ({ /* ... (mantido) ... */ }));
export const budgetRelations = relations(budgets, ({ one }) => ({ /* ... (mantido) ... */ }));
export const landingPageRelations = relations(landingPages, ({ one }) => ({ /* ... (mantido) ... */ }));
export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({ /* ... (mantido) ... */ }));
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({ /* ... (mantido) ... */ }));
export const funnelRelations = relations(funnels, ({ one, many }) => ({ /* ... (mantido) ... */ }));
export const funnelStageRelations = relations(funnelStages, ({ one }) => ({ /* ... (mantido) ... */ }));

// --- SCHEMAS ZOD PARA INSERÇÃO (Core - Manter os existentes) ---
export const insertUserSchema = createInsertSchema(users, { /* ... (mantido) ... */ });
export const insertCampaignSchema = createInsertSchema(campaigns, { /* ... (mantido) ... */ });
export const insertCreativeSchema = createInsertSchema(creatives, { /* ... (mantido) ... */ });
export const insertCopySchema = createInsertSchema(copies, { /* ... (mantido) ... */ });
export const insertFunnelSchema = createInsertSchema(funnels, { /* ... (mantido) ... */ });
export const insertFunnelStageSchema = createInsertSchema(funnelStages, { /* ... (mantido) ... */ });
export const insertLandingPageSchema = createInsertSchema(landingPages, { /* ... (mantido) ... */ });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, { /* ... (com flowId e messageIdBaileys, como definido antes) ... */ });
export const insertAlertSchema = createInsertSchema(alerts, { /* ... (mantido) ... */ });
export const insertBudgetSchema = createInsertSchema(budgets, { /* ... (mantido) ... */ });
export const insertChatSessionSchema = createInsertSchema(chatSessions, { /* ... (mantido) ... */ });
export const insertChatMessageSchema = createInsertSchema(chatMessages, { /* ... (mantido) ... */ });

// --- SCHEMAS ZOD PARA SELEÇÃO (Core - Manter os existentes) ---
export const selectUserSchema = createSelectSchema(users);
export const selectCampaignSchema = createSelectSchema(campaigns);
// ... (todos os outros select schemas do core)
export const selectWhatsappMessageSchema = createSelectSchema(whatsappMessages);
// ...

// --- Tipos Inferidos (Core) ---
export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
// ... (todos os outros tipos inferidos do core)
export type WhatsappMessage = z.infer<typeof selectWhatsappMessageSchema>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
// ...

// --- Re-exportar TUDO de whatsapp.schema.ts para que possam ser importados diretamente de shared/schema ---
export * from './whatsapp.schema';

// --- CONFIGURAÇÕES DE COPY (Manter no final, se for extenso) ---
export const allCopyPurposesConfig: CopyPurposeConfig[] = [ /* ... (mantido) ... */ ];
export const aiResponseSchema = { /* ... (mantido) ... */ };
export const aiResponseValidationSchema = z.object({ /* ... */ });
export type AiResponseType = z.infer<typeof aiResponseValidationSchema>;
export const contentIdeasResponseSchema = { /* ... */ };
export const optimizeCopyResponseSchema = { /* ... */ };


// Agrupa todos os objetos de schema para exportação e uso pelo Drizzle ORM e Drizzle Kit
export const schema = {
    // Enums existentes do core
    campaignStatusEnum,
    chatSenderEnum,
    launchPhaseEnum,
    // Tabelas existentes do core
    users,
    campaigns,
    creatives,
    metrics,
    whatsappMessages, // Tabela atualizada
    copies,
    alerts,
    budgets,
    landingPages,
    chatSessions,
    chatMessages,
    funnels,
    funnelStages,
    // Relações existentes do core (o Drizzle as encontra automaticamente se bem definidas)
    userRelations,
    campaignRelations,
    creativeRelations,
    metricRelations,
    whatsappMessageRelations, // Relação atualizada
    copyRelations,
    alertRelations,
    budgetRelations,
    landingPageRelations,
    chatSessionRelations,
    chatMessageRelations,
    funnelRelations,
    funnelStageRelations,
    // Enums, Tabelas e Relações do WhatsApp (importados e espalhados de whatsapp.schema.ts)
    ...whatsappSchemaContents.whatsappSchema, // Espalha o objeto que contém as tabelas e enums do whatsapp
};

// Para garantir que drizzle-kit veja todas as tabelas e enums de ambos os arquivos
// ao usar `schema: ["./shared/schema.ts", "./shared/whatsapp.schema.ts"]` no drizzle.config.ts,
// esta exportação `schema` agregada acima pode não ser estritamente necessária para o kit se ele ler ambos os arquivos,
// mas é útil para a instância do Drizzle no `db.ts`.
// A correção chave é o `export * from './whatsapp.schema';`
