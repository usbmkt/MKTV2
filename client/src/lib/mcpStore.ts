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
  setCurrentInput: (input: string) => void; // Modificado para logar
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
    set((state) => ({ messages: [...state.messages, message] }));
  },
  // COORDENADA 1 (mcpStore.ts): Adicionar log em setCurrentInput
  setCurrentInput: (input) => {
    console.log('[mcpStore] setCurrentInput chamado com:', input);
    set({ currentInput: input });
  },
  clearCurrentInput: () => set({ currentInput: '' }),
  setLoading: (loading) => set({ isLoading: loading }),
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setMCPContext: (context) => set({ currentMcpContext: context }),

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
    set({ isLoading: true, currentMcpContext: null });
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ isLoading: false });
      const currentMessages = get().messages;
      const errorMsg = {...initialAgentMessageDefault, id: `error-auth-new-chat-${Date.now()}`, text: 'Autenticação necessária para iniciar novo chat.', sender: 'system' as 'system'};
      set({messages: currentMessages.length > 0 ? [...currentMessages, errorMsg] : [errorMsg]});
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
      set({
        messages: [agentWelcomeMessage],
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions.filter(s => s.id !== newSession.id)],
        currentMcpContext: null,
      });
      return newSession.id;
    } catch (error: any) {
      console.error('Erro ao iniciar novo chat:', error);
      const errorMsg = {...initialAgentMessageDefault, id: `error-start-chat-${Date.now()}`, text: `Erro ao iniciar nova conversa: ${error.message}`, sender: 'system' as 'system'};
      set({ messages: [errorMsg] });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => {
    set({ isLoading: true, currentMcpContext: null, messages: [] });
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, { headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha ao carregar histórico.');
      const messagesFromDb: Message[] = (await response.json()).map((msg: any) => ({...msg, id: String(msg.id), timestamp: new Date(msg.timestamp)}));
      set({
        messages: messagesFromDb.length > 0 ? messagesFromDb : [{ ...initialAgentMessageDefault, id: 'empty-session', text: `Sessão "${sessionTitle || ''}" carregada.`, sender: 'system', sessionId }],
        currentSessionId: sessionId,
      });
    } catch (error) { 
      console.error('Erro ao carregar histórico:', error);
      const errorMsg = {...initialAgentMessageDefault, id: `error-load-hist-${Date.now()}`, text: `Erro ao carregar histórico: ${(error as Error).message}`, sender: 'system' as 'system'};
      set({ messages: [errorMsg] });
    }
    finally { set({ isLoading: false }); }
  },
  
  updateCurrentSessionTitle: async (newTitle: string) => {
    const { currentSessionId } = get();
    const token = useAuthStore.getState().token;
    if (!currentSessionId || !newTitle.trim() || !token) return;
    try {
      const response = await fetch(`/api/chat/sessions/${currentSessionId}/title`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Falha ao atualizar título.');
      const updatedSession: ChatSession = await response.json();
      set((state) => ({ chatSessions: state.chatSessions.map(s => s.id === updatedSession.id ? updatedSession : s) }));
    } catch (error) { console.error('Erro ao atualizar título:', error); }
  },

  deleteChatSession: async (sessionId: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha ao deletar sessão.');
      set((state) => {
        const isDeletingCurrent = state.currentSessionId === sessionId;
        return {
          chatSessions: state.chatSessions.filter((session) => session.id !== sessionId),
          currentSessionId: isDeletingCurrent ? null : state.currentSessionId,
          currentMcpContext: isDeletingCurrent ? null : state.currentMcpContext,
          messages: isDeletingCurrent ? [initialAgentMessageDefault] : state.messages,
        };
      });
       if (get().currentSessionId === null && get().chatSessions.length === 0) {
         get().startNewChat();
       }
    } catch (error) { console.error('Erro ao deletar sessão:', error); }
  },
}));

export const sendMessageToMCP = async (text: string): Promise<void> => {
  const store = useMCPStore.getState();
  const { addMessage, setLoading, navigate, currentMcpContext, setMCPContext } = store;
  let { currentSessionId, startNewChat } = store;
  const token = useAuthStore.getState().token;

  // Logs que eu tinha adicionado na versão anterior para sendMessageToMCP (removidos para este teste focado)
  // Manterei apenas os logs relevantes para o problema atual.

  if (!text.trim()) return;
  if (!token) {
    addMessage({ id: `error-no-token-${Date.now()}`, text: 'Você precisa estar logado.', sender: 'system', timestamp: new Date() });
    return;
  }

  let sessionToUseId = currentSessionId;

  if (sessionToUseId === null) {
    setLoading(true);
    sessionToUseId = await startNewChat(); 
    if (sessionToUseId === null) {
      // startNewChat já lida com isLoading e mensagem de erro no chat
      return; 
    }
  }
  
  const userMessage: Message = { 
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text, 
    sender: 'user', 
    timestamp: new Date(), 
    sessionId: sessionToUseId 
  };
  
  addMessage(userMessage);
  setLoading(true); 

  try {
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId, mcpContext: currentMcpContext }), 
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao contatar o Agente MCP.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
    }

    const data: MCPResponse = await response.json();
    addMessage({ id: `agent-${Date.now()}`, text: data.reply, sender: 'agent', timestamp: new Date(), sessionId: data.sessionId });
    
    if (data.mcpContextForNextTurn !== undefined) {
      setMCPContext(data.mcpContextForNextTurn);
    }

    if (data.action === 'navigate' && data.payload && navigate) {
      setTimeout(() => {
        navigate(data.payload || '/', { replace: false });
        useMCPStore.getState().togglePanel();
        if (data.payload.startsWith('/campaigns/')) { 
            setMCPContext(null);
        }
      }, 1000); 
    }
  } catch (error: any) {
    addMessage({
      id: `error-mcp-comm-${Date.now()}`,
      text: `Erro na comunicação com o MCP: ${error.message || 'Verifique o console.'}`,
      sender: 'system',
      timestamp: new Date(),
    });
  } finally {
      setLoading(false);
  }
};
