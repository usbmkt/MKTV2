import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@zap_client/components/ui/avatar';
import { Input } from '@zap_client/components/ui/input';
import { Button } from '@zap_client/components/ui/button';
import { Paperclip, Send, Smile, Mic, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { useToast } from '@zap_client/hooks/use-toast'; // Mantido conforme documentação
import { getConversations, sendMessage, getMessagesForConversation, Conversation, Message } from '@zap_client/lib/api'; // Supondo que estas funções existam
import { ApiError } from '@zap_client/features/types/whatsapp_flow_types';


// Mock data - substitua por chamadas de API reais
// const mockConversations: Conversation[] = [
//   { id: '1', contactName: 'Alice Wonderland', lastMessage: 'Okay, see you then!', timestamp: '10:30 AM', unreadCount: 2, avatarUrl: '/placeholder-user.jpg' },
//   { id: '2', contactName: 'Bob The Builder', lastMessage: 'Can you fix it?', timestamp: 'Yesterday', unreadCount: 0, avatarUrl: '/placeholder-user.jpg' },
// ];

// const mockMessages: { [key: string]: Message[] } = {
//   '1': [
//     { id: 'm1', text: 'Hey Alice!', timestamp: '10:25 AM', sender: 'me' },
//     { id: 'm2', text: 'Hi! What\'s up?', timestamp: '10:26 AM', sender: 'contact' },
//     { id: 'm3', text: 'Not much, just checking in. Are we still on for tomorrow?', timestamp: '10:28 AM', sender: 'me' },
//     { id: 'm4', text: 'Yes, definitely! Looking forward to it.', timestamp: '10:29 AM', sender: 'contact' },
//     { id: 'm5', text: 'Okay, see you then!', timestamp: '10:30 AM', sender: 'me' },
//   ],
//   '2': [
//      { id: 'm6', text: 'Hello Bob', timestamp: 'Yesterday', sender: 'me' },
//      { id: 'm7', text: 'Can you fix it?', timestamp: 'Yesterday', sender: 'contact' },
//   ]
// };


const ZapConversations: React.FC = () => {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contactListRef = useRef<HTMLDivElement | null>(null); // Corrigido: tipo HTMLDivElement
  const viewportRef = useRef<HTMLDivElement | null>(null); // Adicionado para ScrollArea


  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const convs = await getConversations(); // Implementar em lib/api.ts
      setConversations(convs);
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Carregar Conversas',
        description: apiError.message || 'Não foi possível buscar as conversas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConversations(false);
    }
  }, [toast]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await getMessagesForConversation(conversationId); // Implementar em lib/api.ts
      setMessages(msgs);
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Carregar Mensagens',
        description: apiError.message || `Não foi possível buscar as mensagens para ${selectedConversation?.contactName}.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [toast, selectedConversation?.contactName]);


  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    try {
      const sentMessage = await sendMessage(selectedConversation.id, newMessage); // Implementar em lib/api.ts
      setMessages(prevMessages => [...prevMessages, sentMessage]);
      setNewMessage('');
      // Atualizar a conversa na lista (lastMessage, timestamp)
      setConversations(prevConvs => prevConvs.map(c =>
        c.id === selectedConversation.id
          ? { ...c, lastMessage: sentMessage.text, timestamp: sentMessage.timestamp }
          : c
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Enviar Mensagem',
        description: apiError.message || 'Não foi possível enviar a sua mensagem.',
        variant: 'destructive',
      });
    }
  };

  const filteredConversations = conversations.filter(conversation =>
    conversation.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="h-[calc(100vh-120px)] w-full flex flex-col shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Conversas do WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex p-0 overflow-hidden">
        {/* Coluna de Contatos */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar conversas..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="flex-grow" viewportRef={viewportRef} ref={contactListRef}> {/* Usando viewportRef e ref */}
            {isLoadingConversations && <p className="p-4 text-sm text-gray-500">Carregando conversas...</p>}
            {!isLoadingConversations && filteredConversations.length === 0 && (
                <p className="p-4 text-sm text-gray-500">Nenhuma conversa encontrada.</p>
            )}
            {filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''}`}
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={conversation.avatarUrl || '/placeholder-user.jpg'} alt={conversation.contactName} />
                    <AvatarFallback>{conversation.contactName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold truncate">{conversation.contactName}</h3>
                      <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Coluna de Mensagens */}
        <div className="w-2/3 flex flex-col bg-gray-50">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b bg-white flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={selectedConversation.avatarUrl || '/placeholder-user.jpg'} alt={selectedConversation.contactName} />
                  <AvatarFallback>{selectedConversation.contactName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedConversation.contactName}</h3>
                  {/* <p className="text-xs text-gray-500">Online</p> TODO: Status online */}
                </div>
              </div>
              <ScrollArea className="flex-grow p-4 space-y-4">
                {isLoadingMessages && <p className="text-sm text-gray-500">Carregando mensagens...</p>}
                {!isLoadingMessages && messages.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-10">Sem mensagens nesta conversa ainda.</p>
                )}
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow ${
                        message.sender === 'me' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      <p className={`text-xs mt-1 ${message.sender === 'me' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="p-4 border-t bg-white">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="icon" className="text-gray-500">
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-500">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-grow"
                  />
                  {newMessage ? (
                    <Button size="icon" onClick={handleSendMessage}>
                      <Send className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="text-gray-500">
                      <Mic className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
              <ZapIcon className="w-24 h-24 text-gray-300 mb-4" />
              <p className="text-lg">Selecione uma conversa para começar.</p>
              <p className="text-sm">Ou inicie uma nova busca por um contato.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ZapConversations;
