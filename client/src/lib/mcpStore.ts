import { create } from 'zustand';
import { useAuthStore } from './auth';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  sessionId?: number; 
  role?: 'user' | 'agent' | 'system'; // Adicionado para compatibilidade com dados do backend
}

interface MCPResponse {
  reply: string;
  action?: 'navigate';
  payload?: string;
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
  navigate: undefined,

  setNavigateFunction: (navigateFunc) => set({ navigate: navigateFunc }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setCurrentInput: (input) => set({ currentInput: input }),
  clearCurrentInput: () => set({ currentInput: '' }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  
  loadChatSessions: async () => {
    set({ isSessionsLoading: true });
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ isSessionsLoading: false });
      return;
    }
    try {
      const response = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Falha ao carregar sessões de chat.');
      const sessions: ChatSession[] = await response.json();
      set({ chatSessions: sessions });
    } catch (error) {
      console.error('Erro ao carregar sessões de chat:', error);
    } finally {
      set({ isSessionsLoading: false });
    }
  },

  startNewChat: async (title?: string) => {
    set({ isLoading: true });
    const token = useAuthStore.getState().token;
    if (!token) {
        set({ isLoading: false });
        return;
    }
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title || 'Nova Conversa' }),
      });
      if (!response.ok) throw new Error('Falha ao iniciar novo chat.');
      const newSession: ChatSession = await response.json();
      set({
        messages: [
          {
            id: 'initial-agent-message-new',
            text: 'Olá! Sou o Agente MCP. Uma nova conversa foi iniciada. Como posso ajudar?',
            sender: 'agent',
            timestamp: new Date(),
          },
        ],
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions], 
      });
    } catch (error) {
      console.error('Erro ao iniciar novo chat:', error);
      get().addMessage({
        id: `error-new-chat-${Date.now()}`,
        text: 'Erro ao iniciar uma nova conversa. Tente novamente.',
        sender: 'system',
        timestamp: new Date(),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => {
    set({ isLoading: true });
    const token = useAuthStore.getState().token;
    if (!token) {
        set({ isLoading: false });
        return;
    }
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Falha ao carregar histórico da sessão.');
      const messagesFromBackend: Message[] = await response.json();
      
      // ✅ CORREÇÃO: Mapeia a propriedade 'role' do backend para 'sender' no frontend
      const formattedMessages: Message[] = messagesFromBackend.map(msg => ({
        id: String(msg.id),
        text: msg.text,
        sender: msg.role as ('user' | 'agent' | 'system'), // Usa 'role' do backend
        timestamp: new Date(msg.timestamp),
        sessionId: msg.sessionId,
      }));

      set({
        messages: formattedMessages.length > 0 ? formattedMessages : [{ id: 'empty-session', text: `Sessão "${sessionTitle || 'Sem Título'}" carregada. Comece a conversar!`, sender: 'system', timestamp: new Date() }],
        currentSessionId: sessionId,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erro ao carregar histórico da sessão:', error);
      get().addMessage({
        id: `error-load-history-${Date.now()}`,
        text: 'Erro ao carregar histórico da conversa.',
        sender: 'system',
        timestamp: new Date(),
      });
      set({ isLoading: false });
    }
  },
  
  updateCurrentSessionTitle: async (newTitle: string) => {
    const { currentSessionId } = get();
    const token = useAuthStore.getState().token;
    if (!currentSessionId || !newTitle.trim() || !token) return;
    try {
      const response = await fetch(`/api/chat/sessions/${currentSessionId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Falha ao atualizar título da sessão.');
      const updatedSession: ChatSession = await response.json();
      set((state) => ({
        chatSessions: state.chatSessions.map(
          (session) => (session.id === updatedSession.id ? updatedSession : session)
        ),
      }));
      get().addMessage({
        id: `system-title-update-${Date.now()}`,
        text: `Título da sessão atualizado para "${newTitle}".`,
        sender: 'system',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Erro ao atualizar título da sessão:', error);
      get().addMessage({
        id: `error-update-title-${Date.now()}`,
        text: 'Erro ao atualizar o título da conversa.',
        sender: 'system',
        timestamp: new Date(),
      });
    }
  },

  deleteChatSession: async (sessionId: number) => {
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
      }));
      get().addMessage({
        id: `system-delete-session-${Date.now()}`,
        text: `Sessão #${sessionId} foi excluída.`,
        sender: 'system',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Erro ao deletar sessão:', error);
      get().addMessage({
        id: `error-delete-session-${Date.now()}`,
        text: 'Erro ao excluir a conversa.',
        sender: 'system',
        timestamp: new Date(),
      });
    }
  }
}));
