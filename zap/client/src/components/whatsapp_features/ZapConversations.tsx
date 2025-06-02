// zap/client/src/components/whatsapp_features/ZapConversations.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@zap_client/components/ui/avatar';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Separator } from '@zap_client/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@zap_client/components/ui/dropdown-menu';
import { apiRequest } from '@zap_client/lib/api';
import { Loader2, Send, Search, Paperclip, Phone, MoreVertical, AlertTriangle, Check, CheckCheck, Clock, Smile, MessageSquare, ArrowLeft, UserPlus, Video, FileText as FileTextIcon, Mic } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { format, parseISO, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';

// Tipos (conforme especificação e uso comum)
interface ZapContact {
  contactJid: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  lastMessageSnippet?: string | null;
  lastMessageTimestamp?: string | null;
  unreadCount?: number;
  isOnline?: boolean;
  typing?: boolean; // Para indicar se o contato está digitando
}

interface ZapMessageContent {
  text?: string;
  url?: string; // para mídia
  caption?: string;
  fileName?: string;
  mimeType?: string;
  ptt?: boolean; // Para áudio PTT
  duration?: number; // Para áudio/vídeo
}

interface ZapMessage {
  id: string;
  baileysMessageId?: string; // ID original do Baileys
  contactJid: string;
  content: ZapMessageContent;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'reaction' | 'unsupported' | 'location' | 'contact' | 'template';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'failed';
  isReadByZapUser?: boolean;
  quotedMessageId?: string;
  quotedMessageContent?: ZapMessageContent; // Para exibir preview da msg respondida
  quotedMessageSenderName?: string;
}

interface SendMessageInput {
  jid: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document';
  content: ZapMessageContent;
  // Adicionar 'file' opcional para upload direto, ou gerenciar upload separadamente
  file?: File;
}

const ZapConversations: React.FC = () => {
  const queryClientHook = useQueryClient();
  const [selectedContactJid, setSelectedContactJid] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: contacts = [], isLoading: isLoadingContacts, error: contactsError } = useQuery<ZapContact[], ApiError>({
    queryKey: ['zapContacts', contactSearchTerm], // Adicionar searchTerm à queryKey para refetch na busca
    queryFn: () => apiRequest({ url: `/whatsapp/contacts?search=${encodeURIComponent(contactSearchTerm)}`, method: 'GET' }),
    placeholderData: [], // Evitar undefined durante o carregamento inicial
  });

  const { data: currentMessages = [], isLoading: isLoadingMessages, error: messagesError } = useQuery<ZapMessage[], ApiError>({
    queryKey: ['zapMessages', selectedContactJid],
    queryFn: () => apiRequest({ url: `/whatsapp/messages?contactJid=${selectedContactJid}`, method: 'GET' }),
    enabled: !!selectedContactJid,
    placeholderData: [],
    refetchInterval: 5000, // Polling para novas mensagens (idealmente seria WebSocket)
  });

  const sendMessageMutation = useMutation<ZapMessage, ApiError, SendMessageInput | FormData>({
    mutationFn: (data) => {
      if (data instanceof FormData) {
        return apiRequest({ url: '/whatsapp/send-media', method: 'POST', data, isFormData: true });
      }
      return apiRequest({ url: '/whatsapp/send-message', method: 'POST', data });
    },
    onSuccess: (sentMessage) => {
      queryClientHook.setQueryData(['zapMessages', selectedContactJid], (oldData: ZapMessage[] = []) =>
        [...oldData, sentMessage]
      );
      queryClientHook.invalidateQueries({ queryKey: ['zapContacts'] });
      setNewMessage('');
    },
    onError: (error) => {
      console.error("Erro ao enviar mensagem:", error.message);
      // TODO: Adicionar toast de erro
    }
  });

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedContactJid) return;
    sendMessageMutation.mutate({
      jid: selectedContactJid,
      messageType: 'text',
      content: { text: newMessage },
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedContactJid) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jid', selectedContactJid);
      // Tipo pode ser inferido no backend ou adicionado aqui
      if (file.type.startsWith('image/')) formData.append('messageType', 'image');
      else if (file.type.startsWith('video/')) formData.append('messageType', 'video');
      else if (file.type.startsWith('audio/')) formData.append('messageType', 'audio');
      else formData.append('messageType', 'document');
      
      // Poderia adicionar caption aqui se tivesse um input para isso
      // formData.append('caption', 'Minha legenda para a mídia');

      sendMessageMutation.mutate(formData);
    }
    if(fileInputRef.current) fileInputRef.current.value = ""; // Resetar input
  };
  
  useEffect(() => {
    if (messagesEndRef.current) {
        const scrollContainer = messagesEndRef.current.parentElement?.parentElement; // Acessar o viewport da ScrollArea
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }
  }, [currentMessages, isLoadingMessages]);


  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const dateA = a.lastMessageTimestamp ? parseISO(a.lastMessageTimestamp).getTime() : 0;
      const dateB = b.lastMessageTimestamp ? parseISO(b.lastMessageTimestamp).getTime() : 0;
      return dateB - dateA;
    });
  }, [contacts]);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1 && parts[parts.length-1]) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    if (parts[0] && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    if (parts[0]) return parts[0][0].toUpperCase();
    return '?';
  };
  
  const formatTimestamp = (timestamp?: string | null, type: 'list' | 'chat' = 'list') => {
    if (!timestamp) return '';
    const date = parseISO(timestamp);
    if (type === 'list') {
        if (isToday(date)) return format(date, 'HH:mm', { locale: ptBR });
        if (isYesterday(date)) return 'Ontem';
        return format(date, 'dd/MM/yy', { locale: ptBR });
    }
    // Para o chat, sempre mostrar HH:mm
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const getMessageStatusIcon = (status?: string) => {
    const commonClass = "h-3.5 w-3.5";
    if (status === 'sent') return <Check className={cn(commonClass, "text-muted-foreground/70")} />;
    if (status === 'delivered') return <CheckCheck className={cn(commonClass, "text-muted-foreground/70")} />;
    if (status === 'read' || status === 'played') return <CheckCheck className={cn(commonClass, "text-blue-500 dark:text-blue-400")} />;
    if (status === 'pending' || !status) return <Clock className={cn(commonClass, "text-muted-foreground/70")} />;
    if (status === 'failed') return <AlertTriangle className={cn(commonClass, "text-destructive")} />;
    return null;
  };
  
  const selectedContactDetails = selectedContactJid ? sortedContacts.find(c => c.contactJid === selectedContactJid) : null;

  const renderMessageContent = (message: ZapMessage) => {
    switch (message.messageType) {
        case 'text':
            return <p className="whitespace-pre-wrap break-words">{message.content.text}</p>;
        case 'image':
            return <img src={message.content.url} alt={message.content.caption || "Imagem"} className="max-w-xs max-h-64 rounded-md my-1" />;
        case 'video':
            return <video src={message.content.url} controls className="max-w-xs max-h-64 rounded-md my-1" />;
        case 'audio':
            return <audio src={message.content.url} controls className="my-1 w-full max-w-xs" />;
        case 'document':
            return (
                <a href={message.content.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-2 bg-background/50 dark:bg-black/20 rounded-md hover:bg-background/70 dark:hover:bg-black/30">
                    <FileTextIcon className="w-6 h-6 text-primary" />
                    <span className="text-sm truncate">{message.content.fileName || "Documento"}</span>
                </a>
            );
        default:
            return <p className="italic text-xs opacity-70">[Tipo de mensagem não suportado: {message.messageType}]</p>;
    }
  };


  return (
    <div className={cn(
        "grid grid-cols-1 gap-0 h-[calc(100vh-210px)] md:h-[calc(100vh-230px)] border rounded-lg shadow-lg bg-card overflow-hidden",
        isMobileView ? "md:grid-cols-[1fr]" : "md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]"
    )}>
      {/* Lista de Contatos */}
      <div className={cn(
        "flex flex-col border-r border-border transition-all duration-300 ease-in-out",
        isMobileView && selectedContactJid ? "hidden" : "flex"
      )}>
        <CardHeader className="p-3 border-b sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Conversas</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 neu-button"><UserPlus className="w-4 h-4"/></Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ou iniciar nova conversa..."
              value={contactSearchTerm}
              onChange={(e) => setContactSearchTerm(e.target.value)}
              className="pl-9 text-sm h-9 neu-input"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-grow">
          <ScrollArea className="h-full" type="auto" viewportRef={contactListRef}>
            {isLoadingContacts && <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center h-full"><Loader2 className="mr-2 w-5 h-5 animate-spin"/>Carregando...</div>}
            {contactsError && <div className="p-4 text-center text-sm text-destructive">Erro: {contactsError.message}</div>}
            {!isLoadingContacts && sortedContacts.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center h-full">Nenhuma conversa encontrada.</div>}
            {sortedContacts.map((contact) => (
              <div
                key={contact.contactJid}
                className={cn(
                  "p-3 cursor-pointer border-b border-border/50 flex items-center space-x-3 hover:bg-muted/50 transition-colors",
                  selectedContactJid === contact.contactJid && "bg-accent"
                )}
                onClick={() => setSelectedContactJid(contact.contactJid)}
              >
                <Avatar className="h-10 w-10">
                  {contact.profilePictureUrl && <AvatarImage src={contact.profilePictureUrl} alt={contact.name || contact.contactJid} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm truncate text-foreground">{contact.name || contact.contactJid}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatTimestamp(contact.lastMessageTimestamp, 'list')}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-xs text-muted-foreground truncate pr-2">{contact.typing ? <span className="italic text-primary">Digitando...</span> : contact.lastMessageSnippet || 'Nenhuma mensagem.'}</p>
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <Badge variant="success" className="px-1.5 py-0.5 text-[0.65rem] leading-tight font-semibold">{contact.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </div>

      {/* Área de Chat */}
      <div className={cn(
        "flex flex-col bg-background",
        isMobileView && !selectedContactJid ? "hidden" : "flex",
        !isMobileView && !selectedContactJid && "items-center justify-center"
      )}>
        {selectedContactJid && selectedContactDetails ? (
          <>
            <CardHeader className="p-3 border-b flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center space-x-2 min-w-0">
                {isMobileView && <Button variant="ghost" size="icon" className="h-8 w-8 mr-1 neu-button" onClick={() => setSelectedContactJid(null)}><ArrowLeft className="w-5 h-5"/></Button>}
                <Avatar className="h-9 w-9">
                  {selectedContactDetails.profilePictureUrl && <AvatarImage src={selectedContactDetails.profilePictureUrl} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(selectedContactDetails.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="text-base leading-tight truncate text-foreground">{selectedContactDetails.name || selectedContactJid}</CardTitle>
                  {selectedContactDetails.isOnline && <CardDescription className="text-xs text-green-500">Online</CardDescription>}
                  {selectedContactDetails.typing && <CardDescription className="text-xs text-primary italic">Digitando...</CardDescription>}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 neu-button"><Phone className="w-4 h-4 text-muted-foreground" /></Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 neu-button"><MoreVertical className="w-4 h-4 text-muted-foreground" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>Ver Contato</DropdownMenuItem>
                        <DropdownMenuItem>Limpar Conversa</DropdownMenuItem>
                        <DropdownMenuItem>Bloquear</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full" type="auto">
                <div className="p-4 space-y-3">
                  {isLoadingMessages && <div className="text-center p-4 text-sm text-muted-foreground">Carregando mensagens... <Loader2 className="inline w-4 h-4 animate-spin"/></div>}
                  {messagesError && <div className="text-center p-4 text-sm text-destructive">Erro: {messagesError.message}</div>}
                  {!isLoadingMessages && currentMessages.length === 0 && <div className="text-center p-4 text-sm text-muted-foreground">Sem mensagens nesta conversa ainda. Inicie a conversa!</div>}
                  {currentMessages.map((msg, index) => {
                     const prevMsg = currentMessages[index - 1];
                     const showDateSeparator = prevMsg && differenceInMinutes(parseISO(msg.timestamp), parseISO(prevMsg.timestamp)) > 60 * 2; // Mais de 2 horas

                     return (
                        <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                                <div className="text-center my-3">
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                        {format(parseISO(msg.timestamp), "eeee, dd MMM", { locale: ptBR })}
                                    </Badge>
                                </div>
                            )}
                            <div className={cn("flex flex-col", msg.direction === 'outgoing' ? 'items-end' : 'items-start')}>
                            <div className={cn(
                                "max-w-[75%] sm:max-w-[65%] p-2.5 rounded-lg shadow-sm text-sm",
                                msg.direction === 'outgoing' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted text-foreground rounded-bl-none border'
                                )}>
                                {renderMessageContent(msg)}
                                <div className={cn("text-xs mt-1 flex items-center space-x-1.5", msg.direction === 'outgoing' ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground justify-start')}>
                                <span>{formatTimestamp(msg.timestamp, 'chat')}</span>
                                {msg.direction === 'outgoing' && getMessageStatusIcon(msg.status)}
                                </div>
                            </div>
                            </div>
                        </React.Fragment>
                     )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-2 sm:p-3 border-t bg-card sticky bottom-0">
              <form onSubmit={handleSendMessage} className="flex items-end w-full gap-2">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary neu-button" onClick={() => fileInputRef.current?.click()}><Paperclip className="w-4 h-4" /></Button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); }}}
                  className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm rounded-full px-4 py-2 border-input focus-visible:ring-1 focus-visible:ring-primary neu-input"
                  rows={1}
                  disabled={sendMessageMutation.isPending || isLoadingMessages}
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary neu-button"><Smile className="w-4 h-4" /></Button>
                <Button type="submit" size="icon" className="h-9 w-9 bg-primary hover:bg-primary/90 rounded-full neu-button-primary" disabled={!newMessage.trim() || sendMessageMutation.isPending}>
                  {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </CardFooter>
          </>
        ) : (
          !isMobileView && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Ou inicie uma nova busca na lista à esquerda.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ZapConversations;