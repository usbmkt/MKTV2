// server/mcp_handler.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from './storage.js';
import { config } from "./config.js";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);

export async function handleMCPConversation(
    userId: number,
    message: string,
    sessionId?: number,
    attachmentUrl?: string
) {
    let currentSessionId = sessionId;

    // Se não há sessão, cria uma nova
    if (!currentSessionId) {
        const newSession = await storage.createChatSession(userId, message.substring(0, 30));
        currentSessionId = newSession.id;
    }

    // Salva a mensagem do usuário
    await storage.createChatMessage({
        sessionId: currentSessionId,
        sender: 'user',
        text: message,
        userId: userId, // <-- CORREÇÃO: Adicionado userId
        attachmentUrl: attachmentUrl || null,
    });

    // Pega o histórico para dar contexto à IA
    const history = await storage.getChatMessages(currentSessionId, userId);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const chat = model.startChat({
        history: history.map(msg => ({
            role: msg.sender as 'user' | 'model', // 'model' é o esperado pelo Gemini
            parts: [{ text: msg.text || '' }]
        })),
    });

    // Envia a mensagem para a IA e obtém a resposta
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    // Salva a resposta do agente (IA)
    const modelMessage = await storage.createChatMessage({
        sessionId: currentSessionId,
        sender: 'agent',
        text: text,
        userId: userId, // <-- CORREÇÃO: Adicionado userId
    });

    return {
        response: text,
        sessionId: currentSessionId,
        userMessage: { sender: 'user', text: message },
        modelMessage: modelMessage,
    };
}
