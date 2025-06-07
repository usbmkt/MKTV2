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

    if (!currentSessionId) {
        const newSession = await storage.createChatSession(userId, message.substring(0, 30));
        currentSessionId = newSession.id;
    }

    await storage.createChatMessage({
        sessionId: currentSessionId,
        sender: 'user',
        text: message
    });

    const history = await storage.getChatMessages(currentSessionId, userId);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const chat = model.startChat({
        history: history.map(msg => ({
            role: msg.sender as 'user' | 'model',
            parts: [{ text: msg.text || '' }]
        })),
    });

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