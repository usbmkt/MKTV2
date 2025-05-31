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

// COORDENADA 1 (mcpStore.ts): Interface MCPContext para o estado do cliente
interface MCPContext {
  lastCreatedCampaignId?: number | null;
  lastMentionedCampaignId?: number | null;
}

interface MCPResponse {
  reply: string;
  action?: 'navigate';
  payload?: string;
  sessionId: number;
  mcpContextForNextTurn?: MCPContext | null; // Contexto retornado pelo backend
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
  currentMcpContext: MCPContext | null; // COORDENADA 2 (mcpStore.ts): Estado para o contexto

  togglePanel: () => void;
  addMessage: (message: Message) => void;
  setCurrentInput: (input: string) => void;
  clearCurrentInput: () => void;
  setLoading: (loading: boolean) => void;
  setChatSessions: (sessions: ChatSession[]) => void;
  loadChatSessions: () => Promise<void>;
  startNewChat: (title?: string) => Promise<void>;
  loadSessionHistory: (sessionId: number, sessionTitle?: string) => Promise<void>;
  updateCurrentSessionTitle: (newTitle: string) => Promise<void>;
  deleteChatSession: (sessionId: number) => Promise<void>;
  setMCPContext: (context: MCPContext | null) => void; // COORDENADA 3 (mcpStore.ts): Ação para setar contexto

  navigate?: (to: string, options?: { replace?: boolean }) => void; 
  setNavigateFunction: (navigateFunc: (to: string, options?: { replace?: boolean }) => void) => void;
}

export const useMCPStore = create<MCPState>((set, get) => ({
  isPanelOpen: false,
  messages: [
    {
      id: 'initial-agent-message',
      text: 'Olá! Sou o Agente MCP, seu assistente de marketing digital. Como posso ajudar você hoje?',
      sender: 'agent',
      timestamp: new Date(),
    },
  ],
  currentInput: '',
  isLoading: false,
  currentSessionId: null,
  chatSessions: [],
  isSessionsLoading: false,
  currentMcpContext: null, // COORDENADA 4 (mcpStore.ts): Inicializa contexto como null
  navigate: undefined,

  setNavigateFunction: (navigateFunc) => set({ navigate: navigateFunc }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setCurrentInput: (input) => set({ currentInput: input }),
  clearCurrentInput: () => set({ currentInput: '' }),
  setLoading: (loading) => set({ isLoading: loading }),
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setMCPContext: (context) => set({ currentMcpContext: context }), // COORDENADA 5 (mcpStore.ts): Implementa setMCPContext

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

  startNewChat: async (title?: string) => {
    set({ isLoading: true, currentMcpContext: null }); // Limpa contexto ao iniciar novo chat
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title || 'Nova Conversa' }),
      });
      if (!response.ok) throw new Error('Falha ao iniciar novo chat.');
      const newSession: ChatSession = await response.json();
      set({
        messages: [{ id: 'initial-new-chat', text: 'Nova conversa iniciada. Como posso ajudar?', sender: 'agent', timestamp: new Date() }],
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions],
        currentMcpContext: null, // Garante que o contexto está limpo
      });
    } catch (error) { console.error('Erro novo chat:', error); }
    finally { set({ isLoading: false }); }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => {
    set({ isLoading: true, currentMcpContext: null }); // Limpa contexto ao carregar sessão
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, { headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha histórico.');
      const messagesFromDb: Message[] = (await response.json()).map((msg: any) => ({...msg, timestamp: new Date(msg.timestamp)}));
      set({
        messages: messagesFromDb.length > 0 ? messagesFromDb : [{ id: 'empty-session', text: `Sessão "${sessionTitle || ''}" carregada.`, sender: 'system', timestamp: new Date() }],
        currentSessionId: sessionId,
        currentMcpContext: null, // Garante que o contexto está limpo
      });
    } catch (error) { console.error('Erro histórico:', error); }
    finally { set({ isLoading: false }); }
  },

  updateCurrentSessionTitle: async (newTitle: string) => { /* ... (inalterado, mas garantir que não mexe no mcpContext) ... */ },
  deleteChatSession: async (sessionId: number) => { /* ... (inalterado, mas garantir que se currentSessionId é resetado, mcpContext também é) ... */
    // Dentro desta função, se currentSessionId === sessionId, então set({ currentMcpContext: null })
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Falha ao deletar sessão.');
      set((state) => ({
        chatSessions: state.chatSessions.filter((session) => session.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        currentMcpContext: state.currentSessionId === sessionId ? null : state.currentMcpContext, // Limpa contexto se deletar a atual
      }));
    } catch (error) { console.error('Erro ao deletar sessão:', error); }
  },
}));

export const sendMessageToMCP = async (text: string): Promise<void> => {
  const { addMessage, setLoading, navigate, currentSessionId, startNewChat, currentMcpContext, setMCPContext } = useMCPStore.getState(); // Pega currentMcpContext e setMCPContext
  const token = useAuthStore.getState().token;

  if (!text.trim() || !token) return;

  let sessionToUseId = currentSessionId;
  if (sessionToUseId === null) {
    await startNewChat(); // startNewChat já limpa o contexto
    sessionToUseId = useMCPStore.getState().currentSessionId;
    if (sessionToUseId === null) { return; }
  }
  
  const userMessage: Message = { id: `user-${Date.now()}`, text, sender: 'user', timestamp: new Date(), sessionId: sessionToUseId };
  addMessage(userMessage);
  setLoading(true);

  try {
    // COORDENADA 6 (mcpStore.ts): Envia currentMcpContext para o backend
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId, mcpContext: currentMcpContext }), 
    });

    setLoading(false);
    if (!response.ok) { /* ... (tratamento de erro inalterado) ... */ throw new Error("MCP API Error"); }
    const data: MCPResponse = await response.json();

    addMessage({ id: `agent-${Date.now()}`, text: data.reply, sender: 'agent', timestamp: new Date(), sessionId: data.sessionId });
    
    // COORDENADA 7 (mcpStore.ts): Atualiza o contexto do cliente com o que veio do backend
    if (data.mcpContextForNextTurn !== undefined) { // Checa se undefined para permitir que backend envie null para limpar
      setMCPContext(data.mcpContextForNextTurn);
    }


    if (data.action === 'navigate' && data.payload && navigate) {
      setTimeout(() => {
        navigate(data.payload || '/', { replace: false });
        useMCPStore.getState().togglePanel();
        // COORDENADA 8 (mcpStore.ts): Limpa contexto após navegação bem-sucedida originada pelo MCP
        if (data.payload.startsWith('/campaigns/')) { // Se foi navegação para detalhe de campanha
            setMCPContext(null); // Limpa o contexto para não ficar preso no "me leve ate la"
        }
      }, 1000); 
    }
  } catch (error) { /* ... (tratamento de erro inalterado) ... */ setLoading(false); }
};
