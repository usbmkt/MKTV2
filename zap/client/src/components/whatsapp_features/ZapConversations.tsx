// zap/client/src/components/whatsapp_features/ZapConversations.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Badge } from '@zap_client/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@zap_client/components/ui/avatar'; // Adicionado AvatarImage
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Textarea } from '@zap_client/components/ui/textarea';
import {
  MessageCircle, Send, Phone, Search, MoreVertical, Check, CheckCheck, Clock, Paperclip, Smile, UserPlus, Filter, Loader2, AlertTriangle
} from 'lucide-react';
import { useToast } from '@zap_client/hooks/use-toast'; // Verifique se os arquivos de toast estão no módulo zap
import { ApiError } from '@zap_client/features/types/whatsapp_flow_types'; // Importado

interface ChatMessage {
  id: string;
  senderId: string; // 'user' or contact's JID
  contactName?: string; // Nome do contato para mensagens recebidas
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  timestamp: Date;
  status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  isOutgoing: boolean;
}

interface ChatContact {
  id: string; // JID (ex: 5511999998888@c.us)
  name?: string; // Nome do contato (pode ser o número se não houver nome)
  profilePicUrl?: string;
  lastMessage?: string;
  lastMessageTimestamp?: Date;
  unreadCount?: number;
  isMuted?: boolean;
  isArchived?: boolean;
  isBotAssigned?: boolean;
}

// Mock API functions (substitua por chamadas reais)
const fetchContacts = async (): Promise<ChatContact[]> => {
  console.log("Fetching contacts (mocked)...");
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: '5511999998888@c.us', name: 'Alice Silva', lastMessage: 'Olá! Tudo bem?', lastMessageTimestamp: new Date(Date.now() - 60000 * 5), unreadCount: 2, profilePicUrl: '/placeholder-user.jpg' },
    { id: '5511988887777@c.us', name: 'Roberto Santos', lastMessage: 'Sim, podemos marcar.', lastMessageTimestamp: new Date(Date.now() - 60000 * 30), profilePicUrl: '/placeholder-user.jpg' },
    { id: '5521977776666@c.us', name: 'Carla Mendes', lastMessage: 'Obrigada!', lastMessageTimestamp: new Date(Date.now() - 60000 * 120), isBotAssigned: true },
  ];
};

const fetchMessages = async (contactId: string): Promise<ChatMessage[]> => {
  console.log(`Fetching messages for ${contactId} (mocked)...`);
  await new Promise(resolve => setTimeout(resolve, 300));
  const now = Date.now();
  return [
    { id: 'msg1', senderId: contactId, text: 'Olá! Tenho uma dúvida sobre o produto X.', timestamp: new Date(now - 60000 * 3), isOutgoing: false, status: 'READ' },
    { id: 'msg2', senderId: 'user', text: 'Olá! Claro, qual seria sua dúvida?', timestamp: new Date(now - 60000 * 2.5), isOutgoing: true, status: 'DELIVERED' },
    { id: 'msg3', senderId: contactId, text: 'Ele vem com garantia estendida?', timestamp: new Date(now - 60000 * 1), isOutgoing: false, status: 'DELIVERED' },
  ];
};

const sendMessageApi = async (contactId: string, messageText: string): Promise<ChatMessage> => {
    console.log(`Sending message to ${contactId}: ${messageText} (mocked)`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
        id: `msg_${Date.now()}`,
        senderId: 'user',
        text: messageText,
        timestamp: new Date(),
        isOutgoing: true,
        status: 'SENT'
    };
}


export default function ZapConversations() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const contactListRef = useRef<HTMLDivElement>(null); // Para scroll
  const messageListRef = useRef<HTMLDivElement>(null); // Para scroll

  const { data: contacts = [], isLoading: isLoadingContacts, error: contactsError } = useQuery<ChatContact[], ApiError>({
    queryKey: ['zapContacts'],
    queryFn: fetchContacts,
  });

  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useQuery<ChatMessage[], ApiError>({
    queryKey: ['zapMessages', selectedContactId],
    queryFn: () => selectedContactId ? fetchMessages(selectedContactId) : Promise.resolve([]),
    enabled: !!selectedContactId, // Só busca mensagens se um contato estiver selecionado
  });

  const sendMessageMutation = useMutation<ChatMessage, ApiError, { contactId: string; text: string }>({
    mutationFn: (vars) => sendMessageApi(vars.contactId, vars.text),
    onSuccess: (newMessageData) => {
      queryClient.setQueryData<ChatMessage[]>(['zapMessages', selectedContactId], (oldMessages) => 
        oldMessages ? [...oldMessages, newMessageData] : [newMessageData]
      );
      // Atualizar lastMessage no contato (idealmente, isso viria do backend ou de um evento de webhook)
      queryClient.setQueryData<ChatContact[]>(['zapContacts'], (oldContacts) =>
        oldContacts?.map(c => c.id === selectedContactId ? {...c, lastMessage: newMessageData.text, lastMessageTimestamp: newMessageData.timestamp } : c)
      );
      setNewMessage('');
    },
    onError: (error) => {
        toast({ title: "Erro ao Enviar Mensagem", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (selectedContactId) {
      refetchMessages();
    }
  }, [selectedContactId, refetchMessages]);

  useEffect(() => { // Scroll para a última mensagem
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedContactId) return;
    sendMessageMutation.mutate({ contactId: selectedContactId, text: newMessage });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMessageStatusIcon = (status?: ChatMessage['status']) => {
    if (status === 'SENT') return <Clock className="w-3 h-3 text-muted-foreground" />;
    if (status === 'DELIVERED') return <Check className="w-3 h-3 text-muted-foreground" />;
    if (status === 'READ') return <CheckCheck className="w-3 h-3 text-blue-500" />;
    return <Clock className="w-3 h-3 text-muted-foreground opacity-50" />; // PENDING or FAILED
  };

  if (isLoadingContacts) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Carregando contatos...</div>;
  if (contactsError) return <div className="p-4 text-center text-destructive"><AlertTriangle className="w-6 h-6 mx-auto mb-2"/>Erro: {contactsError.message}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]"> {/* Ajuste a altura conforme necessário */}
      {/* Lista de Contatos */}
      <Card className="lg:col-span-1 neu-card flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conversas</CardTitle>
            <Button variant="ghost" size="sm" className="neu-button"><UserPlus className="w-4 h-4"/></Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ou iniciar nova conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 neu-input"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-grow">
          <ScrollArea className="h-full" ref={contactListRef}> {/* Removido viewportRef */}
            {filteredContacts.length === 0 && <p className="p-4 text-sm text-center text-muted-foreground">Nenhum contato encontrado.</p>}
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-3 cursor-pointer border-b transition-colors hover:bg-muted/50 flex items-center space-x-3
                            ${selectedContactId === contact.id ? 'bg-muted' : ''}`}
                onClick={() => setSelectedContactId(contact.id)}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={contact.profilePicUrl} alt={contact.name} />
                  <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate text-sm">{contact.name || contact.id}</p>
                    {contact.lastMessageTimestamp && (
                        <span className="text-xs text-muted-foreground">
                        {new Date(contact.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">{contact.lastMessage || 'Nenhuma mensagem ainda.'}</p>
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">{contact.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <div className="lg:col-span-2 neu-card flex flex-col h-full">
        {selectedContactId ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                     <AvatarImage src={contacts.find(c=>c.id === selectedContactId)?.profilePicUrl} />
                    <AvatarFallback>{getInitials(contacts.find(c=>c.id === selectedContactId)?.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm">{contacts.find(c=>c.id === selectedContactId)?.name || selectedContactId}</h3>
                    {/* <p className="text-xs text-muted-foreground">Online</p> */}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" className="neu-button h-8 w-8"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="neu-button h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(100%-70px)] p-4" ref={messageListRef}> {/* Altura ajustada, removido viewportRef */}
                <div className="space-y-3">
                  {isLoadingMessages && <Loader2 className="w-6 h-6 animate-spin mx-auto my-4" />}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-2.5 rounded-lg text-sm
                                    ${msg.isOutgoing ? 'bg-primary text-primary-foreground rounded-br-none' 
                                                     : 'bg-muted rounded-bl-none'}`}
                      >
                        {msg.text}
                        <div className={`flex items-center mt-1 ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-xs opacity-70 mr-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.isOutgoing && getMessageStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="border-t p-3 bg-background">
                <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="neu-button"><Smile className="w-5 h-5" /></Button>
                    <Textarea
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="neu-input flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
                    rows={1}
                    />
                    <Button variant="ghost" size="icon" className="neu-button"><Paperclip className="w-5 h-5" /></Button>
                    <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sendMessageMutation.isPending} className="neu-button-primary">
                    {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageCircle className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-lg font-semibold">Selecione uma conversa</h3>
            <p className="text-muted-foreground text-sm">
              Escolha um contato na lista à esquerda para ver as mensagens ou iniciar uma nova conversa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
