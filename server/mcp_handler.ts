// server/mcp_handler.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, SafetySetting, ChatSession as GeminiChatSession } from "@google/generative-ai";
import { GEMINI_API_KEY } from "./config";
// Removida a importação de IStorage, já que o construtor não a usa mais diretamente
// import { IStorage } from "./storage"; // Verifique se é realmente necessário ou se storage pode ser passado aos métodos

interface UserContext {
    id: number;
    email: string;
    username: string;
}

interface MCPResponse {
    reply: string;
    action?: string;
    actionData?: any;
    sessionId?: number; // Para retornar a sessão atual ou nova
    error?: string;
}

// Modificado para export default
export default class MCPHandler {
    // private storage: IStorage; // Se precisar do storage, ele deve ser injetado ou os métodos do storage devem ser chamados por quem chama o MCPHandler
    private genAI: GoogleGenerativeAI | null = null;
    private activeGeminiSessions: Map<number, GeminiChatSession> = new Map(); // Para sessões de chat com Gemini

    constructor(/* storage: IStorage */) { // Removido storage do construtor para simplificar, pode ser reintroduzido se necessário
        // this.storage = storage;
        if (GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        } else {
            console.warn("MCPHandler: Chave API do Gemini não configurada. Funcionalidades de IA generativa estarão desabilitadas.");
        }
    }

    private async getOrCreateGeminiChatSession(sessionId: number, history?: any[]): Promise<GeminiChatSession | null> {
        if (!this.genAI) return null;

        if (this.activeGeminiSessions.has(sessionId)) {
            return this.activeGeminiSessions.get(sessionId)!;
        }
        
        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        // Se o histórico for fornecido e estiver no formato correto, use-o
        // O histórico de Drizzle precisa ser mapeado para o formato do Gemini: { role: "user" | "model", parts: [{ text: "" }] }
        const geminiHistory = history ? history.map((msg: {sender: string, text: string}) => ({
            role: msg.sender === 'user' || msg.sender === 'agent' ? 'user' : 'model', // 'agent' pode ser mapeado para 'user'
            parts: [{ text: msg.text }]
        })) : [];

        const chat = model.startChat({
            history: geminiHistory,
            generationConfig: {
                maxOutputTokens: 1000, // Ajuste conforme necessário
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


    public async handleConversation(user: UserContext, message: string, attachmentUrl?: string | null, currentSessionId?: number, context?: any): Promise<MCPResponse> {
        let sessionId = currentSessionId;
        let sessionTitle = `Conversa com ${user.username}`;
        let sessionMessages: any[] = [];

        // 1. Obter ou criar sessão de chat no banco de dados
        // (storage foi removido do construtor, então esta lógica precisaria ser ajustada se storage for necessário aqui)
        // if (sessionId) {
        //     const existingSession = await this.storage.getChatSessionById(user.id, sessionId);
        //     if (existingSession) {
        //         sessionMessages = existingSession.messages;
        //         sessionTitle = existingSession.title;
        //     } else {
        //         sessionId = undefined; // Sessão não encontrada, criar uma nova
        //     }
        // }
        // if (!sessionId) {
        //     const newSession = await this.storage.createChatSession(user.id, sessionTitle);
        //     if (!newSession) return { reply: "Desculpe, não consegui iniciar uma nova sessão de chat.", error: "Falha ao criar sessão no DB" };
        //     sessionId = newSession.id;
        // }
        // await this.storage.addChatMessage(sessionId, 'user', message, attachmentUrl);

        // Placeholder para sessionId se storage não estiver sendo usado aqui
        if (!sessionId) sessionId = Date.now(); 


        // 2. Lógica de Intenção (Simplificada)
        if (message.toLowerCase().includes("ajuda") || message.toLowerCase().includes("help")) {
            // await this.storage.addChatMessage(sessionId, 'mcp', "Posso te ajudar com X, Y, Z. O que você gostaria de fazer?", null);
            return { reply: "Posso te ajudar com navegação no sistema, informações sobre campanhas, ou responder perguntas gerais. O que você gostaria de fazer?", sessionId };
        }
        if (message.toLowerCase().startsWith("navegar para ")) {
            const page = message.substring("navegar para ".length).trim().toLowerCase();
            // await this.storage.addChatMessage(sessionId, 'mcp', `Ok, te levando para ${page}.`, null);
            return { reply: `Ok, te levando para ${page}.`, action: "navigate", actionData: { path: `/${page}` }, sessionId };
        }

        // 3. Interação com Gemini (se API Key estiver disponível)
        if (!this.genAI) {
            const reply = "Desculpe, meu módulo de IA generativa não está configurado no momento. Como posso te ajudar com outras funcionalidades?";
            // await this.storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, sessionId };
        }

        try {
            const geminiChat = await this.getOrCreateGeminiChatSession(sessionId, sessionMessages);
            if(!geminiChat) {
                 const reply = "Desculpe, não consegui iniciar uma sessão com o serviço de IA.";
                // await this.storage.addChatMessage(sessionId, 'mcp', reply, null);
                return { reply, error: "Falha ao iniciar chat com Gemini", sessionId };
            }

            const result = await geminiChat.sendMessage(message);
            const response = result.response;
            const geminiReply = response.text();
            
            // await this.storage.addChatMessage(sessionId, 'mcp', geminiReply, null);
            return { reply: geminiReply, sessionId };

        } catch (error: any) {
            console.error("MCPHandler: Erro ao interagir com Gemini:", error);
            const reply = "Desculpe, tive um problema ao processar sua solicitação com a IA. Tente novamente mais tarde.";
            // await this.storage.addChatMessage(sessionId, 'mcp', reply, null);
            return { reply, error: error.message || "Erro desconhecido na IA", sessionId };
        }
    }
}
