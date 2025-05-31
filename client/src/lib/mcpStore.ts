// client/src/lib/mcpStore.ts
import { create } from 'zustand';
import { useAuthStore } from './auth';
import { useLocation } from 'wouter';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  sessionId?: number;
}

interface MCPContext {
  lastCreatedCampaignId?: number | null;
  lastMentionedCampaignId?: number | null;
}

interface MCPResponse {
  reply: string;
  action?: 'navigate';
  payload?: string;
  sessionId: number;
  mcpContextForNextTurn?: MCPContext | null;
}

export interface ChatSession {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MCPState {
  isPanelOpen: boolean;
  messages: Message[];
  currentInput: string;
  isLoading: boolean;
  currentSessionId: number | null;
  chatSessions: ChatSession[];
  isSessionsLoading: boolean;
  currentMcpContext: MCPContext | null;

  togglePanel: () => void;
  addMessage: (message: Message) => void;
  setCurrentInput: (input: string) => void;
  clearCurrentInput: () => void;
  setLoading: (loading: boolean) => void;
  setChatSessions: (sessions: ChatSession[]) => void;
  loadChatSessions: () => Promise<void>;
  startNewChat: (title?: string) => Promise<number | null>;
  loadSessionHistory: (sessionId: number, sessionTitle?: string) => Promise<void>;
  updateCurrentSessionTitle: (newTitle: string) => Promise<void>;
  deleteChatSession: (sessionId: number) => Promise<void>;
  setMCPContext: (context: MCPContext | null) => void;

  navigate?: (to: string, options?: { replace?: boolean }) => void; 
  setNavigateFunction: (navigateFunc: (to: string, options?: { replace?: boolean }) => void) => void;
}

const initialAgentMessageDefault: Message = {
  id: 'initial-agent-message-default',
  text: 'Olá! Sou o Agente MCP, seu assistente de marketing digital. Como posso ajudar você hoje?',
  sender: 'agent',
  timestamp: new Date(),
};

export const useMCPStore = create<MCPState>((set, get) => ({
  isPanelOpen: false,
  messages: [initialAgentMessageDefault],
  currentInput: '',
  isLoading: false,
  currentSessionId: null,
  chatSessions: [],
  isSessionsLoading: false,
  currentMcpContext: null,
  navigate: undefined,

  setNavigateFunction: (navigateFunc) => set({ navigate: navigateFunc }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  addMessage: (message) => {
    console.log('[mcpStore] addMessage chamada com:', JSON.stringify(message)); // Log para addMessage
    set((state) => {
      const newMessages = [...state.messages, message];
      console.log('[mcpStore] Novo estado de messages após addMessage:', JSON.stringify(newMessages.map(m=>m.text))); // Log do novo array de mensagens
      return { messages: newMessages };
    });
  },
  setCurrentInput: (input) => {
    // COORDENADA 1 (mcpStore.ts): Log em setCurrentInput
    console.log('[mcpStore] setCurrentInput chamado com:', input);
    set({ currentInput: input });
  },
  clearCurrentInput: () => {
    console.log('[mcpStore] clearCurrentInput chamado.');
    set({ currentInput: '' });
  },
  setLoading: (loading) => {
    console.log('[mcpStore] setLoading chamada com:', loading);
    set({ isLoading: loading });
  },
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setMCPContext: (context) => {
    console.log('[mcpStore] setMCPContext chamada com:', context);
    set({ currentMcpContext: context });
  },

  loadChatSessions: async () => {
    set({ isSessionsLoading: true });
    const token = useAuthStore.getState().token;
    if (!token) { set({ isSessionsLoading: false }); return; }
    try {
      const response = await fetch('/api/chat/sessions', { headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha ao carregar sessões.');
      const sessions: ChatSession[] = await response.json();
      set({ chatSessions: sessions });
    } catch (error) { console.error('Erro ao carregar sessões:', error); }
    finally { set({ isSessionsLoading: false }); }
  },

  startNewChat: async (title?: string): Promise<number | null> => {
    console.log('[mcpStore] startNewChat iniciado.');
    set({ isLoading: true, currentMcpContext: null });
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ isLoading: false });
      const errorMsg = {...initialAgentMessageDefault, id: `error-auth-new-chat-${Date.now()}`, text: 'Autenticação necessária para iniciar novo chat.', sender: 'system' as 'system'};
      get().addMessage(errorMsg); // Usa addMessage para consistência de log
      return null;
    }
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title || 'Nova Conversa' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao iniciar novo chat no servidor.');
      }
      const newSession: ChatSession = await response.json();
      const agentWelcomeMessage = { ...initialAgentMessageDefault, id: `agent-welcome-${newSession.id}`, sessionId: newSession.id, text: "Nova conversa iniciada. Como posso lhe ajudar?" };
      set({ // Limpa messages e define a nova mensagem inicial
        messages: [agentWelcomeMessage], 
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions.filter(s => s.id !== newSession.id)],
        currentMcpContext: null,
      });
      console.log('[mcpStore] startNewChat bem-sucedido, ID da sessão:', newSession.id);
      return newSession.id;
    } catch (error: any) {
      console.error('[mcpStore] Erro ao iniciar novo chat:', error);
      const errorMsg = {...initialAgentMessageDefault, id: `error-start-chat-${Date.now()}`, text: `Erro ao iniciar nova conversa: ${error.message}`, sender: 'system' as 'system'};
      set({ messages: [errorMsg] });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => { /* ... (inalterado da última versão, mas pode adicionar logs se necessário) ... */ },
  updateCurrentSessionTitle: async (newTitle: string) => { /* ... (inalterado) ... */ },
  deleteChatSession: async (sessionId: number) => { /* ... (inalterado) ... */ },
}));

export const sendMessageToMCP = async (text: string): Promise<void> => {
  const store = useMCPStore.getState();
  const { addMessage, setLoading, navigate, currentMcpContext, setMCPContext } = store;
  let { currentSessionId, startNewChat } = store;
  const token = useAuthStore.getState().token;

  console.log(`[sendMessageToMCP] INICIADO. Texto: "${text}", Sessão Atual: ${currentSessionId}, Contexto Atual: ${JSON.stringify(currentMcpContext)}`);

  if (!text.trim()) {
    console.warn('[sendMessageToMCP] Texto vazio, retornando.');
    return;
  }
  if (!token) {
    console.warn('[sendMessageToMCP] Sem token de autenticação.');
    addMessage({ id: `error-no-token-${Date.now()}`, text: 'Você precisa estar logado para enviar mensagens.', sender: 'system', timestamp: new Date() });
    return;
  }

  let sessionToUseId = currentSessionId;

  if (sessionToUseId === null) {
    console.log('[sendMessageToMCP] Nenhuma sessão ativa, chamando startNewChat...');
    setLoading(true); // Indica que estamos fazendo algo (criando sessão)
    sessionToUseId = await startNewChat(); 
    if (sessionToUseId === null) {
      console.error('[sendMessageToMCP] Falha ao obter ID da nova sessão de startNewChat. Saindo.');
      // startNewChat já deve ter lidado com isLoading e mensagem de erro.
      return; 
    }
    console.log('[sendMessageToMCP] Nova sessão criada/obtida, ID:', sessionToUseId);
  }
  
  const userMessage: Message = { 
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text, 
    sender: 'user', 
    timestamp: new Date(), 
    sessionId: sessionToUseId 
  };
  
  console.log('[sendMessageToMCP] Chamando addMessage para mensagem do usuário:', JSON.stringify(userMessage));
  addMessage(userMessage); // Adiciona a mensagem do usuário
  
  console.log('[sendMessageToMCP] Chamando setLoading(true) para chamada da API /api/mcp/converse');
  setLoading(true); 

  try {
    console.log(`[sendMessageToMCP] Enviando para /api/mcp/converse. Sessão: ${sessionToUseId}, Contexto: ${JSON.stringify(currentMcpContext)}`);
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId, mcpContext: currentMcpContext }), 
    });
    console.log('[sendMessageToMCP] Resposta da API /api/mcp/converse recebida, status:', response.status);

    if (!response.ok) {
      let errorMessage = `Erro ${response.status} ao contatar o Agente MCP.`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) { console.warn("[sendMessageToMCP] Falha ao parsear erro JSON da API /api/mcp/converse", e); }
      throw new Error(errorMessage);
    }

    const data: MCPResponse = await response.json();
    console.log('[sendMessageToMCP] Dados da API /api/mcp/converse:', JSON.stringify(data));

    addMessage({ id: `agent-${Date.now()}`, text: data.reply, sender: 'agent', timestamp: new Date(), sessionId: data.sessionId });
    
    if (data.mcpContextForNextTurn !== undefined) {
      setMCPContext(data.mcpContextForNextTurn);
    }

    if (data.action === 'navigate' && data.payload && navigate) {
      console.log(`[sendMessageToMCP] Ação de navegação recebida: ${data.payload}`);
      setTimeout(() => {
        navigate(data.payload || '/', { replace: false });
        useMCPStore.getState().togglePanel();
        if (data.payload.startsWith('/campaigns/')) { 
            setMCPContext(null); // Limpa contexto após navegação para item específico
        }
      }, 1000); 
    }
  } catch (error: any) {
    console.error('[sendMessageToMCP] Erro na comunicação com /api/mcp/converse:', error);
    addMessage({
      id: `error-mcp-comm-${Date.now()}`,
      text: `Erro na comunicação com o MCP: ${error.message || 'Verifique o console.'}`,
      sender: 'system',
      timestamp: new Date(),
    });
  } finally {
    console.log('[sendMessageToMCP] Chamando setLoading(false) no finally.');
    setLoading(false);
  }
};
