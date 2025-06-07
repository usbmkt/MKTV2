// server/mcp_handler.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from './storage.js';
// ✅ CORREÇÃO 1: Importando a variável correta 'GEMINI_API_KEY'.
import { GEMINI_API_KEY } from "./config.js";

// ✅ CORREÇÃO 2: Tratamento para o caso da API Key não estar disponível.
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Função auxiliar para IA, caso precise em outros lugares.
export async function getSimpleAiResponse(prompt: string, systemInstruction?: string) {
    if (!genAI) {
      console.warn("[MCP_HANDLER] Tentativa de usar getSimpleAiResponse sem a GEMINI_API_KEY configurada.");
      return "O serviço de IA não está disponível no momento.";
    }
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      ...(systemInstruction && { systemInstruction }),
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

export async function handleMCPConversation(
    userId: number,
    message: string,
    sessionId?: number,
    attachmentUrl?: string
) {
    let currentSessionId = sessionId;

    if (!currentSessionId) {
        const newSession = await storage.createChatSession(userId, message.substring(0, 30));
        currentSessionId = newSession.id;
    }

    // ✅ CORREÇÃO 3: O schema de chatMessages foi alterado no banco de dados. 
    // Removido 'userId' e 'role', que não existem mais na tabela, usando 'sender' e 'sessionId'.
    await storage.createChatMessage({
        sessionId: currentSessionId,
        sender: 'user', 
        text: message,
        attachmentUrl: attachmentUrl || null
    });
    
    if (!genAI) {
      const errorMessage = "O serviço de IA (Gemini) não está configurado no servidor.";
      await storage.createChatMessage({ sessionId: currentSessionId, sender: 'agent', text: errorMessage });
      return { response: errorMessage, sessionId: currentSessionId };
    }

    const history = await storage.getChatMessages(currentSessionId, userId);
    
    // ✅ CORREÇÃO 4: O histórico para a IA deve usar 'sender' e 'text' e mapear para 'user'/'model' e 'parts'.
    const chatHistory = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text || '' }]
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const chat = model.startChat({ history: chatHistory });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    const modelMessage = await storage.createChatMessage({
        sessionId: currentSessionId,
        sender: 'agent',
        text: text
    });

    return {
        response: text,
        sessionId: currentSessionId,
        userMessage: { sender: 'user', text: message },
        modelMessage: modelMessage,
    };
}
