// server/mcp_handler.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting, ChatSession as GeminiChatSession } from "@google/generative-ai";
import { GEMINI_API_KEY } from "./config";
import { storage } from './storage'; // Assumindo que MCPHandler pode precisar do storage para salvar/ler histórico de chat

interface UserContext {
    id: number;
    email: string;
    username: string;
}

interface MCPResponse {
    reply: string;
    action?: string;
    actionData?: any;
    sessionId?: number;
    error?: string;
}

export class MCPHandler {
    private genAI: GoogleGenerativeAI | null = null;
    private activeGeminiSessions: Map<number, GeminiChatSession> = new Map();

    constructor() {
        if (GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        } else {
            console.warn("MCPHandler: Chave API do Gemini não configurada. Funcionalidades de IA generativa estarão desabilitadas.");
        }
    }

    private async getOrCreateGeminiChatSession(sessionId: number, userId: number): Promise<GeminiChatSession | null> {
        if (!this.genAI) return null;

        if (this.activeGeminiSessions.has(sessionId)) {
            return this.activeGeminiSessions.get(sessionId)!;
        }
        
        // Buscar histórico do banco de dados para esta sessão
        const sessionWithMessages = await storage.getChatSessionById(userId, sessionId);
        const geminiHistory = sessionWithMessages?.messages?.map((msg: {sender: string, text: string}) => ({
            role: msg.sender === 'user' || msg.sender === 'agent' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        })) || [];

        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const chat = model.startChat({
            history: geminiHistory,
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.7,
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });
        this.activeGeminiSessions.set(sessionId, chat);
        return chat;
    }

    public async handleConversation(
        user: UserContext, 
        message: string, 
        attachmentUrl?: string | null, 
        currentSessionId?: number | string, // Pode vir como string do frontend
        context?: any
    ): Promise<MCPResponse> {
        let sessionId: number;
        let sessionTitle = `Conversa com ${user.username}`;

        if (currentSessionId && typeof currentSessionId === 'string') {
            sessionId = parseInt(currentSessionId, 10);
            if (isNaN(sessionId)) {
                 console.warn(`MCPHandler: currentSessionId inválido '${currentSessionId}', criando nova sessão.`);
                 // Se inválido, trataremos como se não houvesse ID, para criar uma nova sessão
                 const newSession = await storage.createChatSession(user.id, sessionTitle);
                 if (!newSession) return { reply: "Desculpe, não consegui iniciar uma nova sessão de chat.", error: "Falha ao criar sessão no DB" };
                 sessionId = newSession.id;
            }
        } else if (typeof currentSessionId === 'number') {
            sessionId = currentSessionId;
        } else {
            // Criar nova sessão se nenhum ID for fornecido
            const newSession = await storage.createChatSession(user.id, sessionTitle);
            if (!newSession) return { reply: "Desculpe, não consegui iniciar uma nova sessão de chat.", error: "Falha ao criar sessão no DB" };
            sessionId = newSession.id;
        }
        
        // Verificar se a sessão (agora com ID numérico) existe e pertence ao usuário
        const existingSession = await storage.getChatSessionById(user.id, sessionId);
        if (!existingSession) {
            // Se a sessão não existe ou não pertence ao usuário, criar uma nova para este usuário.
            // Isso evita que um usuário tente usar o ID de sessão de outro.
            console.warn(`MCPHandler: Sessão ID ${sessionId} não encontrada para usuário ${user.id}. Criando nova sessão.`);
            const newSession = await storage.createChatSession(user.id, sessionTitle);
            if (!newSession) return { reply: "Desculpe, não consegui iniciar uma nova sessão de chat.", error: "Falha ao criar sessão no DB" };
            sessionId = newSession.id;
        }


        await storage.addChatMessage(sessionId, 'user', message, attachmentUrl);

        if (message.toLowerCase().includes("ajuda") || message.toLowerCase().includes("help")) {
            const reply = "Posso te ajudar com navegação no sistema, informações sobre campanhas, ou responder perguntas gerais. O que você gostaria de fazer?";
            await storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, sessionId };
        }
        if (message.toLowerCase().startsWith("navegar para ")) {
            const page = message.substring("navegar para ".length).trim().toLowerCase();
            const reply = `Ok, te levando para ${page}.`;
            await storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, action: "navigate", actionData: { path: `/${page}` }, sessionId };
        }

        if (!this.genAI) {
            const reply = "Desculpe, meu módulo de IA generativa não está configurado no momento. Como posso te ajudar com outras funcionalidades?";
            await storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, sessionId };
        }

        try {
            const geminiChat = await this.getOrCreateGeminiChatSession(sessionId, user.id);
            if(!geminiChat) {
                 const reply = "Desculpe, não consegui iniciar uma sessão com o serviço de IA.";
                await storage.addChatMessage(sessionId, 'mcp', reply, null);
                return { reply, error: "Falha ao iniciar chat com Gemini", sessionId };
            }

            const result = await geminiChat.sendMessage(message);
            const response = result.response;
            const geminiReply = response.text();
            
            await storage.addChatMessage(sessionId, 'mcp', geminiReply, null);
            return { reply: geminiReply, sessionId };

        } catch (error: any) {
            console.error("MCPHandler: Erro ao interagir com Gemini:", error);
            const reply = "Desculpe, tive um problema ao processar sua solicitação com a IA. Tente novamente mais tarde.";
            await storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, error: error.message || "Erro desconhecido na IA", sessionId };
        }
    }
}
