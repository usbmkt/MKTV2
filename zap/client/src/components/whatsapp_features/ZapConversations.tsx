import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, useCallback } from 'react';
import { Loader2, Paperclip, Send, Smile, Phone, Search, ArrowLeft, Bot, MessageSquare } from 'lucide-react';
// CORRIGIDO: Path Aliases para @zap_client
import { Avatar, AvatarFallback, AvatarImage } from '@zap_client/components/ui/avatar';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { ScrollArea, ScrollAreaViewport } from '@zap_client/components/ui/scroll-area'; // ScrollAreaViewport se usado, senão só ScrollArea
import { Badge } from '@zap_client/components/ui/badge';
import { WhatsAppContact, WhatsAppMessage } from '@zap_client/features/types/whatsapp_flow_types'; // Corrigido para o local correto dentro do zap/client
import { useToast } from '@zap_client/hooks/use-toast';
import { apiRequest } from '@zap_client/lib/api'; // Assumindo que apiRequest está em lib do zap
import { cn } from '@zap_client/lib/utils';

// Mock data (substituir com chamadas de API reais para o backend do ZAP)
const mockContacts: WhatsAppContact[] = [
  { id: '1234567890@s.whatsapp.net', name: 'Alice Wonderland', profilePicUrl: 'https://i.pravatar.cc/150?img=1', lastMessage: 'Okay, obrigada!', lastMessageTimestamp: Date.now() - 1000 * 60 * 5, unreadCount: 2, tags: ['cliente', 'vip'], isBotActive: false },
  { id: '0987654321@s.whatsapp.net', name: 'Bob The Builder', profilePicUrl: 'https://i.pravatar.cc/150?img=2', lastMessage: 'Posso te ajudar com mais alguma coisa?', lastMessageTimestamp: Date.now() - 1000 * 60 * 30, unreadCount: 0, tags: ['lead'], isBotActive: true },
];

const mockMessages: Record<string, WhatsAppMessage[]> = {
  '1234567890@s.whatsapp.net': [
    { id: 'msg1', from: '1234567890@s.whatsapp.net', to: 'me', body: 'Olá! Tenho uma dúvida sobre meu pedido.', type: 'chat', timestamp: Date.now() - 1000 * 60 * 10, isSentByMe: false },
    { id: 'msg2', from: 'me', to: '1234567890@s.whatsapp.net', body: 'Olá Alice! Claro, qual sua dúvida?', type: 'chat', timestamp: Date.now() - 1000 * 60 * 8, isSentByMe: true, isDelivered: true, isRead: true },
  ],
  '0987654321@s.whatsapp.net': [
    { id: 'msg5', from: '0987654321@s.whatsapp.net', to: 'me', body: 'Oi, preciso de um orçamento.', type: 'chat', timestamp: Date.now() - 1000 * 60 * 35, isSentByMe: false },
  ],
};

interface WhatsappConversationsProps {
  // Props adicionais se necessário
}

const ZapConversations: React.FC<WhatsappConversationsProps> = () => {
  const [contacts, setContacts] = useState<WhatsAppContact[]>(mockContacts);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoadingContacts(true);
      try {
        // const response = await apiRequest('GET', '/zap-api/contacts'); // Exemplo de rota no backend do Zap
        setContacts(mockContacts);
      } catch (error) {
        toast({ title: 'Erro ao buscar contatos', description: String(error), variant: 'destructive' });
      } finally {
        setIsLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [toast]);

  useEffect(() => {
    if (selectedContact) {
      const fetchMessages = async () => {
        setIsLoadingMessages(true);
        try {
          // const response = await apiRequest('GET', `/zap-api/messages/${selectedContact.id}`);
          setMessages(mockMessages[selectedContact.id] || []);
          if (selectedContact.unreadCount && selectedContact.unreadCount > 0) {
             // await apiRequest('POST', `/zap-api/contacts/${selectedContact.id}/mark-read`);
             setContacts((prev: WhatsAppContact[]) => prev.map(c => c.id === selectedContact.id ? {...c, unreadCount: 0} : c));
          }
        } catch (error) {
          toast({ title: 'Erro ao buscar mensagens', description: String(error), variant: 'destructive' });
        } finally {
          setIsLoadingMessages(false);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedContact, toast]);

  useEffect(() => {
    if (scrollAreaViewportRef.current) {
        scrollAreaViewportRef.current.scrollTop = scrollAreaViewportRef.current.scrollHeight;
    } else if (messagesEndRef.current) { // Fallback se ScrollAreaViewport não for diretamente acessível
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSelectContact = (contact: WhatsAppContact) => {
    setSelectedContact(contact);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    const tempMessageId = `temp-${Date.now()}`;
    const sentMessage: WhatsAppMessage = {
      id: tempMessageId,
      from: 'me',
      to: selectedContact.id,
      body: newMessage,
      type: 'chat',
      timestamp: Date.now(),
      isSentByMe: true,
    };
    setMessages(prev => [...prev, sentMessage]);
    const messageToSend = newMessage;
    setNewMessage('');

    try {
      // await apiRequest('POST', '/zap-api/messages/send', { to: selectedContact.id, messageContent: messageToSend, type: 'chat' });
      console.log('Mensagem enviada (simulado):', messageToSend);
      setTimeout(() => {
        setMessages(prevMsgs => prevMsgs.map(m => m.id === tempMessageId ? {...m, isDelivered: true, isRead: Math.random() > 0.5} : m));
      }, 1000);
    } catch (error) {
      toast({ title: 'Erro ao enviar mensagem', description: String(error), variant: 'destructive' });
      setMessages(prevMsgs => prevMsgs.filter(m => m.id !== tempMessageId));
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.id.includes(searchTerm)
  );

  return (
    <div className="flex h-[calc(100vh-180px)] border rounded-lg neu-card-inset overflow-hidden">
      <div className={cn("w-full md:w-1/3 border-r bg-background/70 p-0 flex flex-col", selectedContact && "hidden md:flex")}>
        <div className="p-3 border-b">
          <Input
            type="text"
            placeholder="Buscar contatos..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="neu-input"
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        {isLoadingContacts ? (
          <div className="flex-grow flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
        <ScrollArea className="flex-grow">
          <div className="p-0">
            {filteredContacts.map(contact => (
              <div
                key={contact.id}
                className={cn(
                  "flex items-center p-3 hover:bg-muted/50 cursor-pointer border-b",
                  selectedContact?.id === contact.id && "bg-primary/10"
                )}
                onClick={() => handleSelectContact(contact)}
              >
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={contact.profilePicUrl} alt={contact.name} />
                  <AvatarFallback>{contact.name ? contact.name.substring(0, 2).toUpperCase() : '??'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="font-semibold text-sm truncate">{contact.name || contact.id}</div>
                  <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                </div>
                <div className="flex flex-col items-end ml-2">
                   <span className="text-xs text-muted-foreground mb-1">
                     {new Date(contact.lastMessageTimestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                  {contact.unreadCount && contact.unreadCount > 0 ? (
                    <Badge variant="destructive" className="h-5 px-2 text-xs">{contact.unreadCount}</Badge>
                  ): contact.isBotActive ? (
                    <Bot className="h-4 w-4 text-blue-500" title="Bot Ativo" />
                  ) : null }
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        )}
      </div>

      <div className={cn("flex-1 flex flex-col bg-background", !selectedContact && "hidden md:flex", selectedContact && "flex")}>
        {selectedContact ? (
          <>
            <div className="flex items-center p-3 border-b bg-muted/20">
                <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setSelectedContact(null)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage src={selectedContact.profilePicUrl} alt={selectedContact.name} />
                <AvatarFallback>{selectedContact.name ? selectedContact.name.substring(0, 2).toUpperCase() : '??'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold">{selectedContact.name || selectedContact.id}</div>
                {/* <div className="text-xs text-green-500">Online</div> */}
              </div>
              <Button variant="ghost" size="icon" title={`Ligar para ${selectedContact.name || selectedContact.id}`}>
                <Phone className="h-5 w-5" />
              </Button>
            </div>

            <ScrollArea className="flex-grow p-4" viewportRef={scrollAreaViewportRef}> {/* Usando viewportRef aqui */}
               <div className="space-y-4">
                {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex items-end max-w-[75%] break-words",
                      msg.isSentByMe ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {!msg.isSentByMe && (
                        <Avatar className="h-8 w-8 mr-2 self-start">
                            <AvatarImage src={selectedContact.profilePicUrl} alt={selectedContact.name} />
                            <AvatarFallback>{selectedContact.name ? selectedContact.name.substring(0,1) : 'C'}</AvatarFallback>
                        </Avatar>
                    )}
                    <div
                      className={cn(
                        "p-3 rounded-lg shadow-sm text-sm",
                        msg.isSentByMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted rounded-bl-none"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <div className={cn("text-xs mt-1", msg.isSentByMe ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70 text-left")}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.isSentByMe && msg.isDelivered && (
                           <span className={cn("ml-1", msg.isRead ? "text-blue-400" : "text-primary-foreground/70")}>✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            <div className="p-3 border-t bg-muted/20">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className="flex-1 neu-input"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()} className="bg-primary hover:bg-primary/90">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-background">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Selecione uma conversa</h2>
            <p className="text-muted-foreground">Escolha um contato na lista para visualizar as mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZapConversations;
