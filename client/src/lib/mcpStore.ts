// client/src/lib/mcpStore.ts
import { create } from 'zustand';
import { useAuthStore } from './auth';
import { queryClient } from './queryClient'; // Importar queryClient para invalidar queries
import { useLocation } from 'wouter'; // Importar para a função de navegação

// Definir a interface da mensagem de chat que o frontend usa
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  sessionId?: number; 
}

// Para a resposta da API do MCP
interface MCPResponse {
  reply: string;
  action?: 'NAVIGATE' | 'ACTION_SUCCESS_REFRESH_DATA' | 'INFO_DISPLAYED' | 'ACTION_ERROR' | string;
  payload?: {
    route?: string;
    entityType?: 'campaigns' | 'creatives' | 'funnels' | 'dashboardData' | string; // Tipos de entidade para invalidar query
    message?: string;
    data?: any; // Dados adicionais, como a entidade criada/atualizada
  };
  sessionId: number;
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

  navigate?: (to: string, options?: { replace?: boolean }) => void; 
  setNavigateFunction: (navigateFunc: (to: string, options?: { replace?: boolean }) => void) => void;
}

export const useMCPStore = create<MCPState>((set, get) => ({
  isPanelOpen: false,
  messages: [
    { id: 'initial-agent-message', text: 'Olá! Sou o Agente MCP. Como posso ajudar?', sender: 'agent', timestamp: new Date() },
  ],
  currentInput: '',
  isLoading: false,
  currentSessionId: null,
  chatSessions: [],
  isSessionsLoading: false,
  navigate: undefined,

  setNavigateFunction: (navigateFunc) => set({ navigate: navigateFunc }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setCurrentInput: (input) => set({ currentInput: input }),
  clearCurrentInput: () => set({ currentInput: '' }),
  setLoading: (loading) => set({ isLoading: loading }),
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  
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
    set({ isLoading: true });
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title || 'Nova Conversa com MCP' }),
      });
      if (!response.ok) throw new Error('Falha ao iniciar novo chat.');
      const newSession: ChatSession = await response.json();
      set({
        messages: [{ id: 'new-chat-agent-message', text: 'Nova conversa iniciada. Em que posso ajudar?', sender: 'agent', timestamp: new Date() }],
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions.filter(s => s.id !== newSession.id)], // Adiciona ou atualiza
      });
    } catch (error) {
      console.error('Erro ao iniciar novo chat:', error);
      get().addMessage({ id: `error-new-chat-${Date.now()}`, text: 'Erro ao iniciar nova conversa.', sender: 'system', timestamp: new Date() });
    } finally {
      set({ isLoading: false });
    }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => {
    set({ isLoading: true, currentSessionId: sessionId }); // Seta o ID da sessão atual imediatamente
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, { headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha ao carregar histórico.');
      const messagesFromDb: Message[] = await response.json();
      const formattedMessages: Message[] = messagesFromDb.map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) }));
      set({ messages: formattedMessages.length > 0 ? formattedMessages : [{ id: 'empty-session', text: `Sessão "${sessionTitle || 'Chat'}" carregada.`, sender: 'system', timestamp: new Date() }] });
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      get().addMessage({ id: `error-load-history-${Date.now()}`, text: 'Erro ao carregar histórico.', sender: 'system', timestamp: new Date() });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCurrentSessionTitle: async (newTitle: string) => { /* ... (como antes, da versão do turn 55) ... */ },
  deleteChatSession: async (sessionId: number) => { /* ... (como antes, da versão do turn 55) ... */ },
}));

export const sendMessageToMCP = async (text: string): Promise<void> => {
  const { addMessage, setLoading, navigate, currentSessionId, startNewChat, togglePanel, clearCurrentInput } = useMCPStore.getState();
  const token = useAuthStore.getState().token;

  if (!text.trim()) return;
  if (!token) {
    addMessage({ id: `error-no-token-${Date.now()}`, text: 'Login necessário para usar o Agente MCP.', sender: 'system', timestamp: new Date() });
    return;
  }

  let sessionToUseId = currentSessionId;
  if (sessionToUseId === null) {
    await startNewChat("Conversa com MCP"); 
    sessionToUseId = useMCPStore.getState().currentSessionId;
    if (sessionToUseId === null) {
        addMessage({ id: `error-session-${Date.now()}`, text: 'Não foi possível iniciar uma sessão de chat.', sender: 'system', timestamp: new Date()});
        return;
    }
  }
  
  clearCurrentInput(); // Limpa o input do usuário antes de enviar
  const userMessage: Message = { id: `user-${Date.now()}`, text, sender: 'user', timestamp: new Date(), sessionId: sessionToUseId };
  addMessage(userMessage);
  setLoading(true);

  try {
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId }),
    });

    setLoading(false);
    const data: MCPResponse = await response.json(); // Tenta parsear JSON mesmo se !response.ok para pegar erro do backend

    if (!response.ok) {
      const errorMessage = data.payload?.message || data.reply || 'Erro ao contatar o Agente MCP.';
      console.error("MCP API Error:", response.status, errorMessage);
      addMessage({ id: `error-api-${Date.now()}`, text: `Erro: ${errorMessage}`, sender: 'system', timestamp: new Date(), sessionId: data.sessionId });
      return;
    }

    addMessage({ id: `agent-${Date.now()}`, text: data.reply, sender: 'agent', timestamp: new Date(), sessionId: data.sessionId });

    // Lidar com novas ações
    if (data.action === 'NAVIGATE' && data.payload?.route && navigate) {
      console.log(`[MCP_STORE] Navegando para: ${data.payload.route}`);
      setTimeout(() => {
        navigate(data.payload.route, { replace: false });
        if (useMCPStore.getState().isPanelOpen) togglePanel();
      }, 700); 
    } else if (data.action === 'ACTION_SUCCESS_REFRESH_DATA' && data.payload?.entityType) {
      toast({ title: "Ação Concluída!", description: data.payload.message || data.reply });
      // Invalidar queries relevantes para forçar atualização de dados na UI
      queryClient.invalidateQueries({ queryKey: [data.payload.entityType] }); // Ex: ['campaigns'], ['creatives']
      queryClient.invalidateQueries({ queryKey: [`/${data.payload.entityType}`] }); // Tentar formato com /api/
      queryClient.invalidateQueries({ queryKey: [`/api/${data.payload.entityType}`] });
      
      // Se a ação afetar o dashboard, invalidar também
      if (['campaigns', 'creatives', 'budgets'].includes(data.payload.entityType)) {
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      }
    } else if (data.action === 'ACTION_ERROR' && data.payload?.message) {
      toast({ title: "Erro na Ação", description: data.payload.message, variant: "destructive" });
      console.error("MCP Action Error:", data.payload.message);
    }

  } catch (error: any) {
    setLoading(false);
    console.error('Falha ao enviar mensagem para o MCP:', error);
    addMessage({ id: `error-network-${Date.now()}`, text: error.message || 'Falha de conexão ao tentar falar com o Agente MCP.', sender: 'system', timestamp: new Date() });
  }
};
