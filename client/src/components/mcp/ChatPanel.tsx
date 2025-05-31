// client/src/components/mcp/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useMCPStore, sendMessageToMCP, ChatSession } from '@/lib/mcpStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, RotateCcw, MoreVertical, Plus, History, Trash, Edit, Mic, StopCircle, Paperclip } from 'lucide-react';
// import { BotMessageSquare } from 'lucide-react'; // Alternativa se não tiver imagem
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ... (interface Window e outras declarações como antes) ...
declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; } }


export const ChatPanel: React.FC = () => {
  const {
    isPanelOpen, togglePanel, messages, currentInput, setCurrentInput, clearCurrentInput, isLoading,
    currentSessionId, chatSessions, loadChatSessions, startNewChat, loadSessionHistory,
    updateCurrentSessionTitle, deleteChatSession, isSessionsLoading, addMessage,
  } = useMCPStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechRecognitionAvailable = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  // ... (todos os useEffects e handlers como antes) ...
  useEffect(() => { if (isPanelOpen) { loadChatSessions(); } }, [isPanelOpen, loadChatSessions]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setCurrentInput(e.target.value); };
  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => { e?.preventDefault(); const messageText = currentInput.trim(); if (!messageText || isLoading) return; clearCurrentInput(); if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } await sendMessageToMCP(messageText); };
  useEffect(() => { if (isPanelOpen && inputRef.current) { inputRef.current.focus(); } }, [isPanelOpen]);
  useEffect(() => { if (scrollAreaRef.current) { const viewport = scrollAreaRef.current.querySelector('div[style*="overflow: scroll"]'); if (viewport) { viewport.scrollTop = viewport.scrollHeight; } else { const firstChildDiv = scrollAreaRef.current.children[0] as HTMLElement; if (firstChildDiv && firstChildDiv.tagName === 'DIV') { firstChildDiv.scrollTop = firstChildDiv.scrollHeight; } } } }, [messages, isLoading]);
  const handleStartNewChat = async () => { await startNewChat(); setIsHistoryModalOpen(false); };
  const handleLoadSession = async (session: ChatSession) => { await loadSessionHistory(session.id, session.title); setIsHistoryModalOpen(false); };
  const handleEditTitleClick = () => { const currentSession = chatSessions.find(s => s.id === currentSessionId); setNewTitle(currentSession?.title || `Sessão #${currentSessionId || new Date().toLocaleDateString('pt-BR')}`); setIsEditTitleModalOpen(true); };
  const handleSaveTitle = async () => { if (newTitle.trim() && currentSessionId) { await updateCurrentSessionTitle(newTitle.trim()); setIsEditTitleModalOpen(false); } };
  const handleDeleteSession = async (sessionId: number) => { if (window.confirm('Tem certeza que deseja excluir esta conversa?')) { await deleteChatSession(sessionId); if (currentSessionId === sessionId) { await startNewChat(); } await loadChatSessions(); } };
  const handleVoiceInput = () => { /* ... (como antes) ... */ };


  if (!isPanelOpen) return null;

  const currentChatTitle = currentSessionId 
    ? chatSessions.find(s => s.id === currentSessionId)?.title || `Sessão #${currentSessionId}`
    : 'Nova Conversa';

  return (
    <div
      className={cn( /* ... (classes como antes) ... */ )}
      role="dialog" aria-modal="true" aria-labelledby="mcp-chat-panel-title"
    >
      <header className="flex items-center justify-between p-4 border-b border-border">
        {/* LOGO UBIE ADICIONADO AO TÍTULO */}
        <div className="flex items-center gap-2 min-w-0">
           <img 
            src="/ubie-logo.svg" // Coloque seu logo "Ubie" em client/public/ubie-logo.svg
            alt="Ubie" 
            className="h-6 w-6 object-contain flex-shrink-0" // Ajuste tamanho
          />
          {/* Alternativa com Lucide Icon: <BotMessageSquare className="h-6 w-6 text-primary flex-shrink-0" /> */}
          <h3 id="mcp-chat-panel-title" className="font-semibold text-lg text-foreground truncate">
             Agente MCP: {currentChatTitle}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* ... (DropdownMenu e Botão Fechar como antes) ... */}
          <DropdownMenu> <DropdownMenuTrigger asChild> <Button variant="ghost" size="icon" title="Opções" aria-label="Opções"> <MoreVertical className="h-5 w-5" /> </Button> </DropdownMenuTrigger> <DropdownMenuContent align="end" className="z-[101]"> <DropdownMenuItem onClick={handleStartNewChat}><Plus className="mr-2 h-4 w-4" /> Nova Conversa</DropdownMenuItem> <DropdownMenuItem onClick={handleEditTitleClick} disabled={currentSessionId === null}><Edit className="mr-2 h-4 w-4" /> Renomear</DropdownMenuItem> <DropdownMenuItem onClick={() => setIsHistoryModalOpen(true)}><History className="mr-2 h-4 w-4" /> Histórico</DropdownMenuItem> <DropdownMenuSeparator /> <DropdownMenuItem onClick={() => { if (currentSessionId) { useMCPStore.setState({ messages: [{ id: 'reset', text: 'Conversa reiniciada.', sender: 'agent', timestamp: new Date(), sessionId: currentSessionId }]}); } else { handleStartNewChat().then(() => { const newId = useMCPStore.getState().currentSessionId; if(newId) useMCPStore.setState({ messages: [{ id: 'reset', text: 'Conversa reiniciada.', sender: 'agent', timestamp: new Date(), sessionId: newId }]}) }); } }} ><RotateCcw className="mr-2 h-4 w-4" /> Reiniciar</DropdownMenuItem> <DropdownMenuItem onClick={() => { if(currentSessionId) handleDeleteSession(currentSessionId); }} disabled={currentSessionId === null}><Trash className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem> </DropdownMenuContent> </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={togglePanel} title="Fechar" aria-label="Fechar MCP"> <X className="h-5 w-5" /> </Button>
        </div>
      </header>

      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        {/* ... (renderização das mensagens como antes) ... */}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
        {/* ... (input e botões de enviar/voz como antes) ... */}
      </form>

      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        {/* ... (Modal de Histórico como antes) ... */}
      </Dialog>

      <Dialog open={isEditTitleModalOpen} onOpenChange={setIsEditTitleModalOpen}>
        {/* ... (Modal de Editar Título como antes) ... */}
      </Dialog>
    </div>
  );
};
