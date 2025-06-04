import { create } from 'zustand';
import { useAuthStore } from './auth';
import { useLocation } from 'wouter'; // Para navegação
// import { Message as GeminiMessagePart } from '@google/generative-ai'; // Para tipagem do histórico do Gemini

// Definir a interface da mensagem de chat que o frontend usa
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  sessionId?: number; // Adicionar sessionId
}

// Para a resposta da API do MCP
interface MCPResponse {
  reply: string;
  action?: 'navigate';
  payload?: string;
  sessionId: number; // Agora o backend SEMPRE retorna o ID da sessão
}

// Interface para as sessões de chat salvas (do banco)
export interface ChatSession {
  id: number;
  userId: number;
  title: string;
  createdAt: string; // Ou Date, dependendo de como o backend retorna
  updatedAt: string; // Ou Date
}

interface MCPState {
  isPanelOpen: boolean;
  messages: Message[];
  currentInput: string;
  isLoading: boolean;
  currentSessionId: number | null; // ID da sessão de chat ativa
  chatSessions: ChatSession[]; // Lista de sessões salvas
  isSessionsLoading: boolean; // Estado de carregamento das sessões
  
  togglePanel: () => void;
  addMessage: (message: Message) => void;
  setCurrentInput: (input: string) => void;
  clearCurrentInput: () => void;
  setLoading: (loading: boolean) => void;
  
  // Funções para gerenciamento de histórico
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

  // --- Funções de Gerenciamento de Histórico ---
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
      // Pode adicionar uma mensagem de erro ao chat se quiser
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
        chatSessions: [newSession, ...get().chatSessions], // Adiciona a nova sessão ao topo
      });
      // A primeira mensagem da IA será adicionada ao banco quando o usuário responder
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
      const messages: Message[] = await response.json();
      
      // Formata mensagens do banco para o formato do frontend
      const formattedMessages: Message[] = messages.map(msg => ({
        id: String(msg.id), // Garante que o ID é string
        text: msg.text,
        sender: msg.sender as ('user' | 'agent' | 'system'), // Cast para tipo correto
        timestamp: new Date(msg.timestamp), // Converte string de volta para Date
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
    const { currentSessionId, chatSessions } = get();
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
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId, // Limpa se for a sessão atual
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

// Função para enviar mensagem ao backend e receber resposta
export const sendMessageToMCP = async (text: string): Promise<void> => {
  const { addMessage, setLoading, navigate, currentSessionId, startNewChat } = useMCPStore.getState();
  const token = useAuthStore.getState().token;

  if (!text.trim()) return;
  if (!token) {
    addMessage({
      id: `error-no-token-${Date.now()}`,
      text: 'Você precisa estar logado para conversar com o Agente MCP.',
      sender: 'system',
      timestamp: new Date(),
    });
    return;
  }

  // Se não houver sessão ativa, cria uma nova antes de enviar a mensagem
  let sessionToUseId = currentSessionId;
  if (sessionToUseId === null) {
    // Isso é um pouco complexo, pois startNewChat já adiciona uma mensagem inicial
    // e setta o sessionId. Podemos ter um "session zero" ou criar na primeira msg
    await startNewChat(); // Isso vai setar currentSessionId
    sessionToUseId = useMCPStore.getState().currentSessionId; // Pega o ID da nova sessão
    if (sessionToUseId === null) { // Fallback se a criação da sessão falhou
      addMessage({
        id: `error-session-creation-${Date.now()}`,
        text: 'Não foi possível iniciar uma nova sessão de chat. Tente reiniciar.',
        sender: 'system',
        timestamp: new Date(),
      });
      return;
    }
  }

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    text,
    sender: 'user',
    timestamp: new Date(),
    sessionId: sessionToUseId, // Associar mensagem à sessão
  };
  addMessage(userMessage); // Adiciona a mensagem do usuário ao chat visualmente
  setLoading(true);

  try {
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId }), // Enviar sessionId
    });

    setLoading(false);

    if (!response.ok) {
      let errorMessage = 'Erro ao contatar o Agente MCP.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) { /* silent */ }
      console.error("MCP API Error:", response.status, errorMessage);
      addMessage({
        id: `error-api-${Date.now()}`,
        text: `Erro: ${errorMessage}`,
        sender: 'system',
        timestamp: new Date(),
      });
      return;
    }

    const data: MCPResponse = await response.json();

    const agentMessage: Message = {
      id: `agent-${Date.now()}`,
      text: data.reply,
      sender: 'agent',
      timestamp: new Date(),
      sessionId: data.sessionId, // Certifica que a mensagem do agente também tem o sessionId
    };
    addMessage(agentMessage);

    if (data.action === 'navigate' && data.payload && navigate) {
      console.log(`[MCP_STORE] Navegando para: ${data.payload}`);
      setTimeout(() => {
        navigate(data.payload || '/', { replace: false });
        useMCPStore.getState().togglePanel();
      }, 1000); 
    }

  } catch (error) {
    setLoading(false);
    console.error('Falha ao enviar mensagem para o MCP:', error);
    addMessage({
      id: `error-network-${Date.now()}`,
      text: 'Falha de conexão ao tentar falar com o Agente MCP.',
      sender: 'system',
      timestamp: new Date(),
    });
  }
};
