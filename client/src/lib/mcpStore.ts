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
  startNewChat: (title?: string) => Promise<void>;
  loadSessionHistory: (sessionId: number, sessionTitle?: string) => Promise<void>;
  updateCurrentSessionTitle: (newTitle: string) => Promise<void>;
  deleteChatSession: (sessionId: number) => Promise<void>;
  setMCPContext: (context: MCPContext | null) => void;

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
  currentMcpContext: null,
  navigate: undefined,

  setNavigateFunction: (navigateFunc) => set({ navigate: navigateFunc }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  addMessage: (message) => {
    console.log('[mcpStore] addMessage chamada com:', message);
    set((state) => {
      const newMessages = [...state.messages, message];
      console.log('[mcpStore] Novo estado de messages após addMessage:', newMessages);
      return { messages: newMessages };
    });
  },
  setCurrentInput: (input) => set({ currentInput: input }),
  clearCurrentInput: () => set({ currentInput: '' }),
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

  startNewChat: async (title?: string) => {
    set({ isLoading: true, currentMcpContext: null, messages: [] }); // Limpa mensagens e contexto
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
      const initialMessage = { id: 'initial-new-chat', text: 'Nova conversa. Como posso te ajudar?', sender: 'agent', timestamp: new Date(), sessionId: newSession.id };
      set({
        messages: [initialMessage],
        currentSessionId: newSession.id,
        chatSessions: [newSession, ...get().chatSessions.filter(s => s.id !== newSession.id)],
        currentMcpContext: null,
      });
    } catch (error) { console.error('Erro novo chat:', error); }
    finally { set({ isLoading: false }); }
  },

  loadSessionHistory: async (sessionId: number, sessionTitle?: string) => {
    set({ isLoading: true, currentMcpContext: null, messages: [] }); // Limpa mensagens e contexto
    const token = useAuthStore.getState().token;
    if (!token) { set({ isLoading: false }); return; }
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, { headers: { 'Authorization': `Bearer ${token}` }});
      if (!response.ok) throw new Error('Falha histórico.');
      const messagesFromDb: Message[] = (await response.json()).map((msg: any) => ({...msg, id: String(msg.id), timestamp: new Date(msg.timestamp)}));
      set({
        messages: messagesFromDb.length > 0 ? messagesFromDb : [{ id: 'empty-session', text: `Sessão "${sessionTitle || ''}" carregada.`, sender: 'system', timestamp: new Date(), sessionId }],
        currentSessionId: sessionId,
        currentMcpContext: null, 
      });
    } catch (error) { console.error('Erro histórico:', error); }
    finally { set({ isLoading: false }); }
  },
  
  updateCurrentSessionTitle: async (newTitle: string) => {
    const { currentSessionId } = get();
    const token = useAuthStore.getState().token;
    if (!currentSessionId || !newTitle.trim() || !token) return;
    try {
      const response = await fetch(`/api/chat/sessions/${currentSessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Falha ao atualizar título.');
      const updatedSession: ChatSession = await response.json();
      set((state) => ({
        chatSessions: state.chatSessions.map(s => s.id === updatedSession.id ? updatedSession : s),
      }));
    } catch (error) { console.error('Erro ao atualizar título:', error); }
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
        currentMcpContext: state.currentSessionId === sessionId ? null : state.currentMcpContext,
        messages: state.currentSessionId === sessionId ? [{id: 'session-deleted', text: 'Conversa excluída. Inicie uma nova.', sender: 'system', timestamp: new Date()}] : state.messages,
      }));
    } catch (error) { console.error('Erro ao deletar sessão:', error); }
  },
}));

export const sendMessageToMCP = async (text: string): Promise<void> => {
  // COORDENADA 1: Obter addMessage diretamente do hook para garantir reatividade, se necessário.
  // Mas getState() deve funcionar. Adicionando logs para verificar.
  const store = useMCPStore.getState();
  const { addMessage, setLoading, navigate, currentSessionId, startNewChat, currentMcpContext, setMCPContext } = store;
  const token = useAuthStore.getState().token;

  console.log('[sendMessageToMCP] Iniciando com texto:', text, "isLoading:", store.isLoading);

  if (!text.trim()) {
    console.log('[sendMessageToMCP] Texto vazio, retornando.');
    return;
  }
  if (!token) {
    console.log('[sendMessageToMCP] Sem token, retornando.');
    addMessage({ id: `error-no-token-${Date.now()}`, text: 'Você precisa estar logado.', sender: 'system', timestamp: new Date() });
    return;
  }

  let sessionToUseId = currentSessionId;
  if (sessionToUseId === null) {
    console.log('[sendMessageToMCP] Nenhuma sessão ativa, iniciando nova...');
    await startNewChat(); 
    sessionToUseId = useMCPStore.getState().currentSessionId; // Pega o novo ID
    if (sessionToUseId === null) {
      console.error('[sendMessageToMCP] Falha crítica: Não foi possível iniciar ou obter ID da nova sessão.');
      addMessage({ id: `error-session-fail-${Date.now()}`, text: 'Falha ao criar sessão de chat.', sender: 'system', timestamp: new Date() });
      return; 
    }
    console.log('[sendMessageToMCP] Nova sessão iniciada para envio, ID:', sessionToUseId);
  }
  
  const userMessage: Message = { 
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // ID mais único
    text, 
    sender: 'user', 
    timestamp: new Date(), 
    sessionId: sessionToUseId 
  };

  console.log('[sendMessageToMCP] Chamando addMessage para mensagem do usuário:', JSON.stringify(userMessage));
  addMessage(userMessage); // Adiciona a mensagem do usuário ao chat visualmente
  
  console.log('[sendMessageToMCP] Chamando setLoading(true)');
  setLoading(true);

  // --- INÍCIO DA SEÇÃO DE TESTE ---
  // COORDENADA 2: Teste para verificar se a mensagem do usuário é adicionada localmente.
  console.log('[sendMessageToMCP] MODO DE TESTE ATIVO: Parando antes da chamada da API.');
  console.log('[sendMessageToMCP] Verifique se a mensagem do usuário e "Digitando..." aparecem no chat.');
  console.log('[sendMessageToMCP] Estado atual de messages no store (após addMessage e antes de setLoading):', JSON.stringify(useMCPStore.getState().messages));
  // Para este teste, o "Digitando..." ficará ativo pois não chamamos setLoading(false).
  // Se a mensagem do usuário não aparecer, o problema é com addMessage ou a reatividade do ChatPanel.
  // Se aparecer, o problema está na lógica da API ou no tratamento da resposta.
  // setLoading(false); // Adicione isso se quiser remover o "Digitando..." para o teste
  return; 
  // --- FIM DA SEÇÃO DE TESTE ---

/*
  // LÓGICA ORIGINAL DA API (MANTIDA COMENTADA PARA O TESTE)
  try {
    console.log('[sendMessageToMCP] Enviando para API /api/mcp/converse. Contexto:', currentMcpContext);
    const response = await fetch('/api/mcp/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, sessionId: sessionToUseId, mcpContext: currentMcpContext }), 
    });

    setLoading(false); // Certifique-se que setLoading(false) é chamado
    console.log('[sendMessageToMCP] Resposta da API recebida, status:', response.status);

    if (!response.ok) {
      let errorMessage = 'Erro ao contatar o Agente MCP.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) { console.error("Falha ao parsear erro JSON da API", e); }
      console.error("MCP API Error:", response.status, errorMessage);
      addMessage({
        id: `error-api-${Date.now()}`,
        text: `Erro do servidor: ${errorMessage}`,
        sender: 'system',
        timestamp: new Date(),
      });
      return;
    }

    const data: MCPResponse = await response.json();
    console.log('[sendMessageToMCP] Dados da API:', data);

    addMessage({ id: `agent-${Date.now()}`, text: data.reply, sender: 'agent', timestamp: new Date(), sessionId: data.sessionId });
    
    if (data.mcpContextForNextTurn !== undefined) {
      console.log('[sendMessageToMCP] Atualizando contexto MCP com:', data.mcpContextForNextTurn);
      setMCPContext(data.mcpContextForNextTurn);
    }

    if (data.action === 'navigate' && data.payload && navigate) {
      console.log(`[MCP_STORE] Navegando para: ${data.payload}`);
      setTimeout(() => {
        navigate(data.payload || '/', { replace: false });
        useMCPStore.getState().togglePanel();
        if (data.payload.startsWith('/campaigns/')) { 
            setMCPContext(null);
        }
      }, 1000); 
    }
  } catch (error) {
    console.error('[sendMessageToMCP] Falha ao enviar mensagem para o MCP (catch):', error);
    setLoading(false); // Certifique-se que setLoading(false) é chamado em caso de erro também
    addMessage({
      id: `error-network-${Date.now()}`,
      text: 'Falha de conexão ao tentar falar com o Agente MCP. Verifique o console.',
      sender: 'system',
      timestamp: new Date(),
    });
  }
*/
};
