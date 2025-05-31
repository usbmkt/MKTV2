// client/src/components/mcp/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useMCPStore, sendMessageToMCP, ChatSession } from '@/lib/mcpStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, RotateCcw, MoreVertical, Plus, History, Trash, Edit, Mic, StopCircle, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const ChatPanel: React.FC = () => {
  const {
    isPanelOpen,
    togglePanel,
    messages,
    currentInput,
    setCurrentInput,
    clearCurrentInput,
    isLoading,
    currentSessionId,
    chatSessions,
    loadChatSessions,
    startNewChat,
    loadSessionHistory,
    updateCurrentSessionTitle,
    deleteChatSession,
    isSessionsLoading,
    addMessage,
  } = useMCPStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechRecognitionAvailable = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  console.log("[ChatPanel] Renderizando mensagens:", messages);

  useEffect(() => {
    if (isPanelOpen) {
      loadChatSessions();
      // Foca no input quando o painel é aberto e não está carregando histórico/sessão
      if (!isLoading && !isSessionsLoading && inputRef.current) {
          inputRef.current.focus();
      }
    }
  }, [isPanelOpen, loadChatSessions, isLoading, isSessionsLoading]); // Adicionado isLoading e isSessionsLoading

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    // COORDENADA 2 (ChatPanel.tsx): Logs dentro de handleSendMessage
    console.log('[ChatPanel] handleSendMessage: currentInput =', currentInput, '| isLoading =', isLoading);
    const messageText = currentInput.trim();
    console.log('[ChatPanel] handleSendMessage: messageText (trimmed) =', messageText);

    if (!messageText || isLoading) {
      console.log('[ChatPanel] handleSendMessage: Retornando (messageText vazio ou isLoading true)');
      return;
    }
    
    // clearCurrentInput é chamado após o envio ter sido iniciado por sendMessageToMCP
    // para evitar que o input seja limpo se sendMessageToMCP retornar cedo.
    // clearCurrentInput(); 
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
    }
    console.log('[ChatPanel] handleSendMessage: Chamando sendMessageToMCP com texto:', messageText);
    await sendMessageToMCP(messageText);
    // Limpa o input aqui APÓS a chamada para sendMessageToMCP ter sido feita.
    // A própria sendMessageToMCP não limpa mais o input.
    useMCPStore.getState().clearCurrentInput(); 
  };

  useEffect(() => {
    if (isPanelOpen && inputRef.current && !isLoading && !isListening) { // Não focar se estiver ouvindo ou carregando
      inputRef.current.focus();
    }
  }, [isPanelOpen, isLoading, isListening, messages]); // Adicionado messages para refocar após envio

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]'); // Seletor mais específico para ShadCN
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        const firstChildDiv = scrollAreaRef.current.children[0] as HTMLElement;
        if (firstChildDiv && firstChildDiv.tagName === 'DIV') {
            firstChildDiv.scrollTop = firstChildDiv.scrollHeight;
        }
      }
    }
  }, [messages, isLoading]);

  const handleStartNewChat = async () => {
    await startNewChat();
    setIsHistoryModalOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleLoadSession = async (session: ChatSession) => {
    await loadSessionHistory(session.id, session.title);
    setIsHistoryModalOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleEditTitleClick = () => {
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    setNewTitle(currentSession?.title || `Sessão #${currentSessionId || ''}`);
    setIsEditTitleModalOpen(true);
  };

  const handleSaveTitle = async () => {
    if (newTitle.trim() && currentSessionId) {
      await updateCurrentSessionTitle(newTitle.trim());
      setIsEditTitleModalOpen(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta conversa?')) {
      await deleteChatSession(sessionId);
      // Se a sessão atual foi deletada e não há mais sessões, startNewChat já é chamado no store.
      // Se havia outras sessões, o currentSessionId pode ter sido setado para null.
      // O loadChatSessions pode ser útil para atualizar a lista no modal.
      if (isHistoryModalOpen) {
          await loadChatSessions();
      }
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleVoiceInput = () => {
    if (!speechRecognitionAvailable) { /* ... (código inalterado) ... */ }
    if (!recognitionRef.current) { /* ... (código inalterado) ... */ }
    if (!isListening) { /* ... (código inalterado) ... */ } 
    else { recognitionRef.current.stop(); }
  };


  if (!isPanelOpen) {
    return null;
  }

  const currentChatTitle = currentSessionId 
    ? chatSessions.find(s => s.id === currentSessionId)?.title || `Sessão #${currentSessionId}`
    : 'Nova Conversa';

  return (
    <div
      className={cn( /* ... estilos ... */ )}
      role="dialog" aria-modal="true" aria-labelledby="mcp-chat-panel-title"
    >
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h3 id="mcp-chat-panel-title" className="font-semibold text-lg text-foreground truncate max-w-[calc(100%-100px)]">
            Agente MCP: {currentChatTitle}
        </h3>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Opções da Conversa" aria-label="Opções da Conversa">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[101]"> 
              <DropdownMenuItem onClick={handleStartNewChat}><Plus className="mr-2 h-4 w-4" /> Nova Conversa</DropdownMenuItem>
              <DropdownMenuItem onClick={handleEditTitleClick} disabled={!currentSessionId}><Edit className="mr-2 h-4 w-4" /> Renomear</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsHistoryModalOpen(true)}><History className="mr-2 h-4 w-4" /> Histórico</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                 if (currentSessionId) useMCPStore.setState({ messages: [{ ...initialAgentMessageDefault, text: 'Conversa reiniciada.', sessionId: currentSessionId }]});
                 else handleStartNewChat();
              }}><RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Atual</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if(currentSessionId) handleDeleteSession(currentSessionId); }} disabled={!currentSessionId}><Trash className="mr-2 h-4 w-4" /> Excluir Atual</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={togglePanel} title="Fechar Painel" aria-label="Fechar painel do Agente MCP">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id} /* Usar ID único aqui */
              className={cn( /* ... estilos ... */ )}
            >
              <p className={cn("text-sm whitespace-pre-wrap", msg.sender === 'system' ? 'italic' : '')}>{msg.text}</p>
              {msg.sender !== 'system' && (
                <span className={cn( /* ... estilos timestamp ... */ )}>
                  {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                </span>
              )}
            </div>
          ))}
          {isLoading && ( /* ... "Digitando..." ... */ )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" title="Anexar arquivo" aria-label="Anexar arquivo" disabled={isLoading}>
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            id="mcp-message-input"
            name="mcp-message-input"
            type="text"
            placeholder={isListening ? "Ouvindo..." : "Iniciar o chat"}
            value={currentInput}
            onChange={handleInputChange}
            className="flex-grow"
            disabled={isLoading} 
          />
          <Button 
            type="button" variant="ghost" size="icon" onClick={handleVoiceInput} 
            title={isListening ? "Parar" : "Voz"} aria-label={isListening ? "Parar" : "Voz"} 
            disabled={isLoading || !speechRecognitionAvailable}
          >
            {isListening ? <StopCircle className="h-5 w-5 text-destructive animate-pulse" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !currentInput.trim()} aria-label="Enviar mensagem">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>

      {/* Modais de Histórico e Edição de Título (código inalterado) */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}> {/* ... */} </Dialog>
      <Dialog open={isEditTitleModalOpen} onOpenChange={setIsEditTitleModalOpen}> {/* ... */} </Dialog>
    </div>
  );
};

// Para manter o código conciso na resposta, omiti as partes inalteradas dos modais e do voice input,
// mas elas devem ser mantidas no seu arquivo real. Os estilos também foram abreviados.
// Certifique-se de que as partes omitidas com "// ... (código inalterado) ..." e "// ... estilos ..."
// sejam mantidas como estavam no seu arquivo original ou na minha última versão completa dele.
