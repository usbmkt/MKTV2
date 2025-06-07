import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from '../shared/schema';
import { Flow, NewFlow } from '../shared/schema';

export const storage = {
  // ... (outras funções existentes como getUser, etc) ...

  // FUNÇÕES DE USUÁRIO E AUTENTICAÇÃO
  getUser: async (id: number) => {
    return db.query.users.findFirst({ where: eq(schema.users.id, id) });
  },
  getUserByEmail: async (email: string) => {
    return db.query.users.findFirst({ where: eq(schema.users.email, email) });
  },
  createUser: async (user: schema.NewUser) => {
    const [createdUser] = await db.insert(schema.users).values(user).returning();
    return createdUser;
  },

  // FUNÇÕES DE FLUXO (Flows)
  getFlows: async (userId: number) => {
    return db.query.flows.findMany({
      where: eq(schema.flows.userId, userId),
    });
  },
  getFlow: async (flowId: number, userId: number) => {
    return db.query.flows.findFirst({
      where: and(eq(schema.flows.id, flowId), eq(schema.flows.userId, userId)),
    });
  },
  createFlow: async (flow: NewFlow) => {
    const [newFlow] = await db.insert(schema.flows).values(flow).returning();
    return newFlow;
  },
  updateFlow: async (flowId: number, userId: number, flow: Partial<Flow>) => {
    const [updatedFlow] = await db
      .update(schema.flows)
      .set({ ...flow, updatedAt: new Date() })
      .where(and(eq(schema.flows.id, flowId), eq(schema.flows.userId, userId)))
      .returning();
    return updatedFlow;
  },
  deleteFlow: async (flowId: number, userId: number) => {
    await db
      .delete(schema.flows)
      .where(and(eq(schema.flows.id, flowId), eq(schema.flows.userId, userId)));
    return { success: true };
  },
  findTriggerFlow: async (userId: number, trigger: string) => {
    // Lógica para encontrar um fluxo por palavra-chave/gatilho
    // Por enquanto, retorna o primeiro fluxo encontrado para o usuário como padrão
    return db.query.flows.findFirst({
        where: and(
            eq(schema.flows.userId, userId),
            // Exemplo: eq(schema.flows.trigger, trigger)
        ),
    });
  },


  // FUNÇÕES DE ESTADO DO FLUXO DO WHATSAPP (NOVAS)
  getFlowUserState: async (userId: number, contactJid: string) => {
    return db.query.whatsappFlowUserStates.findFirst({
      where: and(
        eq(schema.whatsappFlowUserStates.userId, userId),
        eq(schema.whatsappFlowUserStates.contactJid, contactJid)
      ),
    });
  },

  createFlowUserState: async (state: schema.NewWhatsappFlowUserState) => {
    const [newState] = await db.insert(schema.whatsappFlowUserStates).values(state).returning();
    return newState;
  },

  updateFlowUserState: async (id: number, state: Partial<schema.WhatsappFlowUserState>) => {
    const [updatedState] = await db
      .update(schema.whatsappFlowUserStates)
      .set({ ...state, lastInteractionAt: new Date() })
      .where(eq(schema.whatsappFlowUserStates.id, id))
      .returning();
    return updatedState;
  },

  deleteFlowUserState: async (id: number) => {
    await db.delete(schema.whatsappFlowUserStates).where(eq(schema.whatsappFlowUserStates.id, id));
    return { success: true };
  },


  // FUNÇÕES DE CAMPANHA E COPY
  getCampaigns: async (userId: number) => {
    return db.query.campaigns.findMany({
      where: eq(schema.campaigns.userId, userId),
    });
  },

  getCampaign: async (id: number, userId: number) => {
    return db.query.campaigns.findFirst({
      where: and(eq(schema.campaigns.id, id), eq(schema.campaigns.userId, userId)),
    });
  },
  
  createCampaign: async (campaign: schema.NewCampaign) => {
    const [newCampaign] = await db.insert(schema.campaigns).values(campaign).returning();
    return newCampaign;
  },

  // CORREÇÃO: A query de getCopies estava com erro de sintaxe e lógica
  getCopies: async (userId: number, filters: { phase?: string; purpose?: string; campaignId?: number }) => {
    let query = db.select().from(schema.copies).where(eq(schema.copies.userId, userId));

    if (filters.campaignId) {
      query = query.where(eq(schema.copies.campaignId, filters.campaignId));
    }
    // As colunas 'phase' e 'purpose' não existem na tabela 'copies' conforme o schema.ts
    // Se elas forem necessárias, devem ser adicionadas ao schema.ts na tabela 'copies'
    // if (filters.phase) {
    //   query = query.where(eq(schema.copies.phase, filters.phase));
    // }
    // if (filters.purpose) {
    //   query = query.where(eq(schema.copies.purpose, filters.purpose));
    // }
    return query;
  },

  createCopy: async (copy: schema.NewCopy) => {
    const [newCopy] = await db.insert(schema.copies).values(copy).returning();
    return newCopy;
  },

  // FUNÇÕES DE CHAT (MCP)
  getChatSessions: async (userId: number) => {
    return db.query.chatSessions.findMany({
      where: eq(schema.chatSessions.userId, userId),
    });
  },

  createChatSession: async (session: schema.NewChatSession) => {
    const [newSession] = await db.insert(schema.chatSessions).values(session).returning();
    return newSession;
  },

  getChatMessages: async (sessionId: number, userId: number) => {
    // Primeiro, verifica se a sessão pertence ao usuário
    const session = await db.query.chatSessions.findFirst({
        where: and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId))
    });
    if (!session) return [];

    // CORREÇÃO: a tabela chat_messages não tem userId, a validação é pela sessão
    return db.query.chatMessages.findMany({
      where: eq(schema.chatMessages.sessionId, sessionId),
      orderBy: (messages, { asc }) => [asc(messages.timestamp)],
    });
  },

  createChatMessage: async (message: schema.NewChatMessage) => {
    const [newMessages] = await db.insert(schema.chatMessages).values(message).returning();
    return newMessages;
  },

  deleteChatSession: async (sessionId: number, userId: number) => {
    // A deleção em cascata no schema vai cuidar das mensagens
    await db
      .delete(schema.chatSessions)
      .where(and(eq(schema.chatSessions.id, sessionId), eq(schema.chatSessions.userId, userId)));
    return { success: true };
  }
};
