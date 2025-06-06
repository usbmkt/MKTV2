// server/mcp_handler.ts
import { storage } from "./storage.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from './config.js';
import { ChatSession } from "../shared/schema.js";
import { logger } from './logger.js';

let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    logger.info("[MCP_HANDLER_GEMINI] SDK do Gemini inicializado com sucesso.");
  } catch (error) {
    logger.error({ error }, "[MCP_HANDLER_GEMINI] Falha ao inicializar o SDK do Gemini.");
    genAI = null;
  }
} else {
  logger.warn("[MCP_HANDLER_GEMINI] Chave da API do Gemini (GEMINI_API_KEY) não configurada.");
}

export async function getSimpleAiResponse(prompt: string, systemContext?: string): Promise<string> {
  if (!genAI) {
    logger.error("[MCP_HANDLER_AI] Tentativa de usar IA sem o SDK inicializado.");
    throw new Error("O serviço de IA não está configurado no servidor.");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const fullPrompt = systemContext ? `${systemContext}\n\nPERGUNTA DO USUÁRIO: ${prompt}` : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  } catch (error: any) {
    logger.error({ error: error.message }, "[MCP_HANDLER_AI] Erro ao gerar conteúdo com a API Gemini.");
    throw new Error(`Falha na comunicação com a IA: ${error.message}`);
  }
}

interface MCPResponsePayload {
  reply: string;
  sessionId: number;
  action?: string;
  payload?: any;
}

export async function handleMCPConversation(
  userId: number,
  message: string,
  currentSessionId: number | null | undefined,
  attachmentUrl?: string | null
): Promise<MCPResponsePayload> {
  logger.info({ userId, message: message || '[Anexo]', sessionId: currentSessionId || 'Nova' }, `[MCP_HANDLER] Mensagem recebida.`);

  let activeSession: ChatSession;
  if (currentSessionId) {
    const existingSession = await storage.getChatSession(currentSessionId, userId);
    activeSession = existingSession || await storage.createChatSession(userId, `Conversa sobre "${message.substring(0, 20)}..."`);
  } else {
    activeSession = await storage.createChatSession(userId, `Conversa sobre "${message.substring(0, 20)}..."`);
  }

  await storage.addChatMessage({
    sessionId: activeSession.id,
    sender: 'user',
    text: message || (attachmentUrl ? `Anexo: ${attachmentUrl}` : 'Mensagem vazia.'),
    attachmentUrl: attachmentUrl || null,
  });

  let agentReplyText: string;
  const responsePayload: Partial<MCPResponsePayload> = { sessionId: activeSession.id };

  const systemContext = "Você é o Agente MCP. Responda em Português do Brasil, de forma concisa e útil, auxiliando em marketing digital.";
  agentReplyText = await getSimpleAiResponse(message, systemContext);

  await storage.addChatMessage({
    sessionId: activeSession.id,
    sender: 'agent',
    text: agentReplyText,
  });

  responsePayload.reply = agentReplyText;
  return responsePayload as MCPResponsePayload;
}
