// client/src/components/mcp/ChatPanel.tsx
// Abaixo, indicar o caminho completo da pasta de destino.
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
    // resetChat, // Comentado pois o reset agora é mais focado na sessão
    currentSessionId,
    chatSessions,
    loadChatSessions,
    startNewChat,
    loadSessionHistory,
    updateCurrentSessionTitle,
    deleteChatSession,
    isSessionsLoading,
    addMessage, // Adicionado para feedback de erro do microfone
  } = useMCPStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechRecognitionAvailable = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);


  useEffect(() => {
    if (isPanelOpen) {
      loadChatSessions();
    }
  }, [isPanelOpen, loadChatSessions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const messageText = currentInput.trim();
    if (!messageText || isLoading) return;
    
    clearCurrentInput();
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
    }
    await sendMessageToMCP(messageText);
  };

  useEffect(() => {
    if (isPanelOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPanelOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        // Fallback para tentar o primeiro filho direto que seja DIV
        const firstChildDiv = scrollAreaRef.current.children[0] as HTMLElement;
        if (firstChildDiv && firstChildDiv.tagName === 'DIV') {
            firstChildDiv.scrollTop = firstChildDiv.scrollHeight;
        }
      }
    }
  }, [messages, isLoading]); // Adicionado isLoading para scroll quando "Digitando..." aparece

  const handleStartNewChat = async () => {
    await startNewChat();
    setIsHistoryModalOpen(false);
  };

  const handleLoadSession = async (session: ChatSession) => {
    await loadSessionHistory(session.id, session.title);
    setIsHistoryModalOpen(false);
  };

  const handleEditTitleClick = () => {
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    setNewTitle(currentSession?.title || `Sessão #${currentSessionId || new Date().toLocaleDateString('pt-BR')}`);
    setIsEditTitleModalOpen(true);
  };

  const handleSaveTitle = async () => {
    if (newTitle.trim() && currentSessionId) { // Garante que currentSessionId não é null
      await updateCurrentSessionTitle(newTitle.trim());
      setIsEditTitleModalOpen(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta conversa?')) {
      await deleteChatSession(sessionId);
      if (currentSessionId === sessionId) {
        await startNewChat(); // Inicia uma nova conversa se a atual foi deletada
      }
      await loadChatSessions(); 
    }
  };

  const handleVoiceInput = () => {
    if (!speechRecognitionAvailable) {
      addMessage({
        id: `speech-error-${Date.now()}`,
        text: 'Seu navegador não suporta reconhecimento de voz. Tente usar Chrome ou Edge.',
        sender: 'system',
        timestamp: new Date(),
      });
      return;
    }

    if (!recognitionRef.current) {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = 'pt-BR';
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onstart = () => {
            setIsListening(true);
            setCurrentInput('Ouvindo...');
            console.log("Reconhecimento de voz iniciado.");
        };

        recognitionRef.current.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            setCurrentInput(finalTranscript || interimTranscript);

            if (finalTranscript.trim()) {
                console.log("Transcrição final recebida:", finalTranscript);
                recognitionRef.current.stop(); 
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Erro de reconhecimento de voz:', event.error, event.message);
            let errorMessage = 'Ocorreu um erro durante o reconhecimento de voz.';
            if (event.error === 'not-allowed') {
                errorMessage = 'Permissão para usar o microfone negada. Por favor, habilite nas configurações do seu navegador.';
            } else if (event.error === 'no-speech') {
                errorMessage = 'Nenhuma fala detectada. Tente falar mais alto ou verifique seu microfone.';
            } else if (event.error === 'audio-capture') {
                errorMessage = 'Problema na captura de áudio. Verifique seu microfone.';
            } else if (event.error === 'network') {
                errorMessage = 'Erro de rede durante o reconhecimento de voz.';
            }
            
            addMessage({
                id: `speech-error-detail-${Date.now()}`,
                text: errorMessage,
                sender: 'system',
                timestamp: new Date(),
            });
            setIsListening(false);
            setCurrentInput(''); 
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
            console.log("Reconhecimento de voz finalizado.");
            if (currentInput === 'Ouvindo...') { 
                setCurrentInput('');
            }
            inputRef.current?.focus(); 
        };
    }
    
    if (!isListening) {
        try {
            recognitionRef.current.start();
        } catch (error) {
            console.error("Erro ao tentar iniciar o reconhecimento:", error);
            setIsListening(false);
            setCurrentInput('');
            addMessage({
                id: `speech-start-error-${Date.now()}`,
                text: 'Não foi possível iniciar o reconhecimento de voz. Tente novamente.',
                sender: 'system',
                timestamp: new Date(),
            });
        }
    } else {
        recognitionRef.current.stop();
    }
  };


  if (!isPanelOpen) {
    return null;
  }

  const currentChatTitle = currentSessionId 
    ? chatSessions.find(s => s.id === currentSessionId)?.title || `Sessão #${currentSessionId}`
    : 'Nova Conversa';

  return (
    <div
      className={cn(
        "fixed bottom-20 right-5 z-[100] w-full max-w-md h-[70vh] max-h-[600px] bg-card border border-border shadow-xl rounded-lg flex flex-col transition-all duration-300 ease-in-out",
        isPanelOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-chat-panel-title"
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
              <DropdownMenuItem onClick={handleStartNewChat}>
                <Plus className="mr-2 h-4 w-4" /> Nova Conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEditTitleClick} disabled={currentSessionId === null}>
                <Edit className="mr-2 h-4 w-4" /> Renomear Conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsHistoryModalOpen(true)}>
                <History className="mr-2 h-4 w-4" /> Ver Conversas Antigas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                if (currentSessionId) { 
                    useMCPStore.setState({ messages: [
                      { id: 'reset-agent-message', text: 'Conversa reiniciada. Como posso ajudar?', sender: 'agent', timestamp: new Date(), sessionId: currentSessionId }
                    ]});
                } else {
                    handleStartNewChat().then(() => {
                        const newSessionId = useMCPStore.getState().currentSessionId;
                        if (newSessionId) {
                             useMCPStore.setState({ messages: [
                                { id: 'reset-agent-message', text: 'Conversa reiniciada. Como posso ajudar?', sender: 'agent', timestamp: new Date(), sessionId: newSessionId }
                            ]});
                        }
                    });
                }
              }} >
                <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Conversa Atual
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if(currentSessionId) handleDeleteSession(currentSessionId); }} disabled={currentSessionId === null}>
                <Trash className="mr-2 h-4 w-4" /> Excluir Conversa Atual
              </DropdownMenuItem>
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
              key={msg.id}
              className={cn(
                "flex flex-col p-3 rounded-lg max-w-[80%]",
                msg.sender === 'user' ? 'bg-primary text-primary-foreground self-end rounded-br-none' :
                msg.sender === 'agent' ? 'bg-muted text-muted-foreground self-start rounded-bl-none' :
                'bg-transparent text-xs text-muted-foreground self-center text-center w-full py-1' 
              )}
            >
              <p className={cn("text-sm whitespace-pre-wrap", msg.sender === 'system' ? 'italic' : '')}>{msg.text}</p>
              {msg.sender !== 'system' && (
                <span className={cn(
                  "text-xs mt-1",
                  msg.sender === 'user' ? 'text-primary-foreground/70 self-end' : 
                  'text-muted-foreground/70 self-start'
                )}>
                  {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                </span>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center justify-start p-3">
              <div className="bg-muted text-muted-foreground rounded-lg p-3 inline-flex items-center space-x-2 rounded-bl-none">
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Digitando...</span>
              </div>
            </div>
          )}
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
            placeholder={isListening ? "Ouvindo..." : "Digite sua mensagem..."}
            value={currentInput}
            onChange={handleInputChange}
            className="flex-grow"
            disabled={isLoading} 
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={handleVoiceInput} 
            title={isListening ? "Parar de ouvir" : "Ativar entrada de voz"} 
            aria-label={isListening ? "Parar de ouvir" : "Ativar entrada de voz"} 
            disabled={isLoading || !speechRecognitionAvailable} 
          >
            {isListening ? <StopCircle className="h-5 w-5 text-destructive animate-pulse" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !currentInput.trim()} aria-label="Enviar mensagem">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>

      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conversas Antigas</DialogTitle>
            <DialogDescription>
              Selecione uma conversa para carregar o histórico.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] py-4">
            <div className="grid gap-4">
                {isSessionsLoading ? (
                <div className="text-center text-muted-foreground">Carregando conversas...</div>
                ) : chatSessions.length === 0 ? (
                <div className="text-center text-muted-foreground">Nenhuma conversa salva ainda.</div>
                ) : (
                chatSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted">
                    <div onClick={() => handleLoadSession(session)} className="flex-grow cursor-pointer pr-2">
                        <h4 className="font-medium text-sm truncate">{session.title}</h4>
                        <p className="text-xs text-muted-foreground">
                        Última atualização: {format(new Date(session.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-auto flex-shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} title="Excluir Conversa">
                        <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                    </div>
                ))
                )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleStartNewChat}>
              <Plus className="mr-2 h-4 w-4" /> Iniciar Nova Conversa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditTitleModalOpen} onOpenChange={setIsEditTitleModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Renomear Conversa</DialogTitle>
            <DialogDescription>
              Dê um novo nome para a conversa atual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="newTitle"> 
              Novo Título
            </Label>
            <Input
              id="newTitle"
              name="newTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTitleModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTitle}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
