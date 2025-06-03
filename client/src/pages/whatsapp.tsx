import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FlowBuilder, { FlowBuilderNode } from '@/components/flow-builder';
import WhatsAppConnection from '@/components/whatsapp-connection';
import { 
  MessageCircle, 
  Send, 
  Phone, 
  Search, 
  MoreVertical,
  Clock,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Bot,
  Zap,
  Play,
  Pause,
  Settings,
  Plus,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Download,
  Upload,
  MessageSquare,
  Timer,
  Target,
  BarChart3,
  Loader2
} from 'lucide-react';

// Interfaces (mantidas como estavam, pois definem a estrutura dos dados)
interface WhatsAppMessage {
  id: string; 
  contactNumber: string;
  contactName?: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  isRead: boolean;
  messageType: 'text' | 'image' | 'document' | 'audio' | 'template';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

interface Contact {
  id: string; 
  contactNumber: string;
  contactName: string;
  lastMessage: string;
  timestamp: string; 
  unreadCount?: number;
  tags?: string[];
  isBot?: boolean;
}

interface FlowStep {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action' | 'delay';
  content: string;
  options?: string[];
  nextStepId?: string; 
  delayInSeconds?: number; 
}

interface ChatFlow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  isActive: boolean;
  steps: FlowStep[]; 
  definition?: FlowBuilderNode[]; 
  analytics?: { 
    totalUsers: number;
    completionRate: number;
    avgTime: string;
  };
}

interface MessageTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  status: 'approved' | 'pending' | 'rejected' | 'submitted'; 
  content: string;
  variables?: string[];
}

interface WhatsAppAnalytics {
  totalMessages: number;
  totalMessagesPrevMonthDiff: number;
  activeConversations: number;
  activeConversationsPrevMonthDiff: number;
  responseRate: number;
  responseRatePrevMonthDiff: number;
  avgResponseTime: string;
  avgResponseTimePrevMonthDiff: string;
  topFlows: { id: string; name: string; users: number }[];
  activityByHour: { hourRange: string; percentage: number }[];
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer YOUR_AUTH_TOKEN` 
    },
  };
  const response = await fetch(`/api/whatsapp${endpoint}`, { ...defaultOptions, ...options });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Error ${response.status}`);
  }
  if (response.status === 204) return null; 
  return response.json();
}


export default function WhatsApp() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('conversations');
  
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ChatFlow | null>(null);
  const [isSubmittingFlow, setIsSubmittingFlow] = useState(false);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [chatFlows, setChatFlows] = useState<ChatFlow[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState<WhatsAppAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      setContactsLoading(true);
      setContactsError(null);
      try {
        const data = await fetchApi('/contacts');
        setContacts(data || []);
      } catch (error: any) {
        setContactsError(error.message);
      } finally {
        setContactsLoading(false);
      }
    };
    if (activeTab === 'conversations' || activeTab === 'analytics') {
        loadContacts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedContact) {
      const loadMessages = async () => {
        setMessagesLoading(true);
        setMessagesError(null);
        try {
          const data = await fetchApi(`/contacts/${selectedContact.id}/messages`);
          setMessages(data || []);
        } catch (error: any) {
          setMessagesError(error.message);
        } finally {
          setMessagesLoading(false);
        }
      };
      loadMessages();
    } else {
      setMessages([]); 
    }
  }, [selectedContact]);

  useEffect(() => {
    const loadChatFlows = async () => {
      setFlowsLoading(true);
      setFlowsError(null);
      try {
        const data = await fetchApi('/flows');
        setChatFlows(data || []);
      } catch (error: any) {
        setFlowsError(error.message);
      } finally {
        setFlowsLoading(false);
      }
    };
    if (activeTab === 'flows' || activeTab === 'flow-builder' || activeTab === 'analytics') {
        loadChatFlows();
    }
  }, [activeTab]);

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const data = await fetchApi('/templates');
        setTemplates(data || []);
      } catch (error: any) {
        setTemplatesError(error.message);
      } finally {
        setTemplatesLoading(false);
      }
    };
     if (activeTab === 'templates') {
        loadTemplates();
    }
  }, [activeTab]);

  useEffect(() => {
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const data = await fetchApi('/analytics');
        setAnalyticsData(data);
      } catch (error: any) {
        setAnalyticsError(error.message);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);


  const filteredContacts = contacts.filter(contact =>
    contact.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.contactNumber.includes(searchTerm)
  );

  const getContactInitials = (name?: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent': return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered': return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read': return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed': return <Clock className="w-4 h-4 text-red-500" />; // Added failed state
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedContact || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: WhatsAppMessage = {
        contactNumber: selectedContact.contactNumber,
        message: currentMessage,
        messageType: 'text',
        id: optimisticId,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        isRead: false, 
        contactName: selectedContact.contactName,
        status: 'sent' 
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    const messageToSend = currentMessage;
    setCurrentMessage('');

    try {
      const sentMessage = await fetchApi(`/contacts/${selectedContact.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: messageToSend }), 
      });
      
      setMessages(prev => prev.map(msg => msg.id === optimisticId ? { ...sentMessage, id: sentMessage.id } : msg));
      // Optionally refetch contacts or update last message locally
      // setContacts(prev => prev.map(c => c.id === selectedContact.id ? {...c, lastMessage: messageToSend, timestamp: new Date().toISOString()} : c));

    } catch (error: any) {
      console.error('Failed to send message:', error.message);
      setMessages(prev => prev.map(msg => msg.id === optimisticId ? {...msg, status: 'failed'} : msg ));
      // Show toast or error message to user
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveFlow = async (flowData: Omit<ChatFlow, 'id' | 'analytics' | 'steps' | 'definition'> & { definition?: FlowBuilderNode[] }) => {
    setIsSubmittingFlow(true);
    try {
      let savedFlow;
      if (editingFlow?.id) {
        savedFlow = await fetchApi(`/flows/${editingFlow.id}`, {
          method: 'PUT',
          body: JSON.stringify(flowData),
        });
        setChatFlows(prev => prev.map(f => f.id === editingFlow.id ? { ...f, ...savedFlow } : f));
      } else {
        savedFlow = await fetchApi('/flows', {
          method: 'POST',
          body: JSON.stringify(flowData),
        });
        setChatFlows(prev => [...prev, savedFlow]);
      }
      setIsFlowModalOpen(false);
      setEditingFlow(null);
    } catch (error: any) {
      console.error('Failed to save flow:', error.message);
      // Show toast with error.message
    } finally {
      setIsSubmittingFlow(false);
    }
  };
  
  const handleOpenFlowModal = (flow?: ChatFlow) => {
    setEditingFlow(flow || null);
    setIsFlowModalOpen(true);
  };

  const handleSaveTemplate = async (templateData: Omit<MessageTemplate, 'id' | 'status'>) => {
    setIsSubmittingTemplate(true);
    try {
      let savedTemplate;
      const payload = { ...templateData, language: templateData.language || 'pt_BR' }; // Ensure language
      if (editingTemplate?.id) {
        savedTemplate = await fetchApi(`/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
         setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...savedTemplate } : t));
      } else {
        savedTemplate = await fetchApi('/templates', {
          method: 'POST',
          body: JSON.stringify({ ...payload, status: 'submitted' }),
        });
        setTemplates(prev => [...prev, savedTemplate]);
      }
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
    } catch (error: any) {
      console.error('Failed to save template:', error.message);
      // Show toast with error.message
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleOpenTemplateModal = (template?: MessageTemplate) => {
    setEditingTemplate(template || null);
    setIsTemplateModalOpen(true);
  };
  
  const handleFlowBuilderSave = async (nodes: FlowBuilderNode[], flowIdToUpdate?: string) => {
    const targetFlowId = flowIdToUpdate || editingFlow?.id;
    if (!targetFlowId) {
        console.error("Target flow ID is missing for FlowBuilder save.");
        // Show toast: "Please select or create a flow first."
        return;
    }
    // Add a submitting state for this specific action if complex, or use a general one
    console.log(`Saving flow definition for ${targetFlowId}`, nodes); 
    try {
        const updatedFlow = await fetchApi(`/flows/${targetFlowId}/definition`, {
            method: 'PUT', 
            body: JSON.stringify({ definition: nodes }),
        });
        setChatFlows(prevFlows => prevFlows.map(flow => 
            flow.id === targetFlowId ? { ...flow, definition: updatedFlow.definition } : flow
        ));
        // Show success toast: "Flow structure saved!"
    } catch (error: any) {
        console.error('Failed to save flow definition:', error.message);
        // Show error toast
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Business</h1>
          <p className="text-muted-foreground">
            Gerencie conversas, automatize fluxos e templates de mensagens
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="neu-button" onClick={() => console.log("Exportar conversas Clicado")}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Conversas
          </Button>
          <Button className="neu-button" onClick={() => handleOpenFlowModal()}>
            <Bot className="w-4 h-4 mr-2" />
            Novo Bot (Fluxo)
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="connection">Conectar</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="flows">Fluxos Automáticos</TabsTrigger>
          <TabsTrigger value="flow-builder">Editor Visual</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <WhatsAppConnection />
          <Card className="neu-card">
            <CardHeader><CardTitle>Nota sobre Conexão</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                A funcionalidade de conexão real com o WhatsApp (geração de QR Code, status da conexão) 
                requer integração com uma API oficial do WhatsApp Business (ex: API da Meta). 
                Esta seção da UI está preparada para tal integração, mas a lógica de conexão reside no componente <code>WhatsAppConnection</code> e no backend.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
            <Card className="neu-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Conversas</CardTitle>
                  {!contactsLoading && <Badge variant="secondary">{contacts.length}</Badge>}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contatos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 neu-input"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {contactsLoading && <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}
                {contactsError && <div className="p-4 text-center text-red-500">Erro ao carregar contatos: {contactsError}</div>}
                {!contactsLoading && !contactsError && (
                  <ScrollArea className="h-[calc(100vh-420px)]"> 
                    {filteredContacts.length === 0 && <p className="p-4 text-center text-muted-foreground">Nenhum contato encontrado.</p>}
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-4 cursor-pointer border-b transition-colors hover:bg-accent/50 ${
                          selectedContact?.id === contact.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getContactInitials(contact.contactName)}
                              </AvatarFallback>
                            </Avatar>
                            {contact.isBot && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">{contact.contactName}</p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(contact.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex flex-wrap gap-1">
                                {contact.tags?.map((tag) => (<Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>))}
                              </div>
                              {contact.unreadCount && contact.unreadCount > 0 && (<Badge className="bg-green-500 text-white">{contact.unreadCount}</Badge>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              {selectedContact ? (
                <Card className="neu-card h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary">{getContactInitials(selectedContact.contactName)}</AvatarFallback></Avatar>
                        <div><h3 className="font-semibold">{selectedContact.contactName}</h3><p className="text-sm text-muted-foreground">{selectedContact.contactNumber}</p></div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="neu-button"><Phone className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="neu-button"><MoreVertical className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    {messagesLoading && <div className="p-4 text-center flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}
                    {messagesError && <div className="p-4 text-center text-red-500 flex-1 flex items-center justify-center">Erro ao carregar mensagens: {messagesError}</div>}
                    {!messagesLoading && !messagesError && (
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages.length === 0 && <p className="text-center text-muted-foreground">Nenhuma mensagem nesta conversa.</p>}
                          {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] p-3 rounded-2xl ${msg.direction === 'outgoing' ? 'bg-primary text-primary-foreground' : 'neu-card-inset'}`}>
                                <p className="text-sm">{msg.message}</p>
                                <div className="flex items-center justify-end space-x-1 mt-1">
                                  <span className="text-xs opacity-70">{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {msg.direction === 'outgoing' && getMessageStatusIcon(msg.status)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <div className="border-t p-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="neu-button"><Paperclip className="w-4 h-4" /></Button>
                        <div className="flex-1 relative">
                          <Textarea placeholder="Digite sua mensagem..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={handleKeyPress} className="neu-input min-h-[40px] max-h-[100px] resize-none" rows={1} disabled={isSendingMessage}/>
                        </div>
                        <Button variant="ghost" size="sm" className="neu-button"><Smile className="w-4 h-4" /></Button>
                        <Button onClick={handleSendMessage} disabled={!currentMessage.trim() || isSendingMessage} className="neu-button">
                          {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="neu-card h-full flex items-center justify-center">
                  <div className="text-center"><MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">Selecione uma conversa</h3><p className="text-muted-foreground">Escolha um contato para começar a conversar</p></div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold">Fluxos Automáticos</h2><p className="text-muted-foreground">Configure chatbots e automações</p></div>
            <Dialog open={isFlowModalOpen} onOpenChange={setIsFlowModalOpen}>
              <DialogTrigger asChild><Button className="neu-button" onClick={() => handleOpenFlowModal()}><Plus className="w-4 h-4 mr-2" /> Novo Fluxo</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingFlow ? 'Editar Fluxo' : 'Criar Novo Fluxo'}</DialogTitle></DialogHeader>
                <form onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const flowData = {
                    name: formData.get('flow-name') as string,
                    trigger: formData.get('flow-trigger') as string,
                    description: formData.get('flow-description') as string,
                    isActive: editingFlow?.isActive ?? true,
                  };
                  handleSaveFlow(flowData);
                }}>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="flow-name">Nome do Fluxo</Label><Input id="flow-name" name="flow-name" placeholder="Ex: Boas-vindas" className="neu-input" defaultValue={editingFlow?.name} required /></div>
                      <div className="space-y-2">
                        <Label htmlFor="flow-trigger">Gatilho</Label>
                        <Select name="flow-trigger" defaultValue={editingFlow?.trigger || "first_message"}>
                          <SelectTrigger className="neu-input"><SelectValue placeholder="Selecione o gatilho" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first_message">Primeira mensagem</SelectItem>
                            <SelectItem value="keyword">Palavra-chave</SelectItem>
                            <SelectItem value="schedule">Agendado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label htmlFor="flow-description">Descrição</Label><Textarea id="flow-description" name="flow-description" placeholder="Descreva o objetivo deste fluxo..." className="neu-input" defaultValue={editingFlow?.description} /></div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => { setIsFlowModalOpen(false); setEditingFlow(null); }} disabled={isSubmittingFlow}>Cancelar</Button>
                    <Button type="submit" className="neu-button" disabled={isSubmittingFlow}>
                      {isSubmittingFlow ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {editingFlow ? 'Salvar Alterações' : 'Criar Fluxo'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {flowsLoading && <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}
          {flowsError && <div className="p-4 text-center text-red-500">Erro ao carregar fluxos: {flowsError}</div>}
          {!flowsLoading && !flowsError && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {chatFlows.length === 0 && <p className="col-span-full text-center text-muted-foreground">Nenhum fluxo automático criado.</p>}
              {chatFlows.map((flow) => (
                <Card key={flow.id} className="neu-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2"><Bot className="w-5 h-5 text-primary" /><CardTitle className="text-lg">{flow.name}</CardTitle></div>
                      <div className="flex items-center space-x-2">
                        <Switch checked={flow.isActive} onCheckedChange={async (checked) => {
                           try {
                            await fetchApi(`/flows/${flow.id}/status`, { method: 'PUT', body: JSON.stringify({ isActive: checked }) });
                            setChatFlows(prev => prev.map(f => f.id === flow.id ? {...f, isActive: checked} : f));
                           } catch (e: any) { console.error("Failed to update flow status:", e.message); /* show toast */ }
                        }} />
                        <Button variant="ghost" size="sm" onClick={() => handleOpenFlowModal(flow)}><Edit className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <CardDescription>{flow.description || "Sem descrição."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Gatilho:</span><Badge variant="outline">{flow.trigger}</Badge></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Etapas:</span><span className="font-medium">{flow.definition?.length || flow.steps?.length || 0}</span></div>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Performance (Exemplo)</h4>
                      {flow.analytics ? (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div><p className="text-lg font-bold text-primary">{flow.analytics.totalUsers}</p><p className="text-xs text-muted-foreground">Usuários</p></div>
                          <div><p className="text-lg font-bold text-green-500">{flow.analytics.completionRate}%</p><p className="text-xs text-muted-foreground">Conclusão</p></div>
                          <div><p className="text-lg font-bold text-blue-500">{flow.analytics.avgTime}</p><p className="text-xs text-muted-foreground">Tempo Médio</p></div>
                        </div>
                      ) : <p className="text-xs text-muted-foreground">Dados de performance não disponíveis.</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => console.log(`Ver analytics para ${flow.name}`)}><BarChart3 className="w-4 h-4 mr-1" />Ver Analytics</Button>
                      <Button size="sm" className="flex-1 neu-button" onClick={() => { setEditingFlow(flow); setActiveTab('flow-builder'); }}><Settings className="w-4 h-4 mr-1" />Editar no Editor</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flow-builder" className="space-y-4">
          <Card className="neu-card h-[calc(100vh-250px)]">
            {editingFlow ? (
                <FlowBuilder key={editingFlow.id} initialNodes={editingFlow.definition || []} onSave={(nodes) => handleFlowBuilderSave(nodes, editingFlow.id)} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                    <Bot size={48} className="mb-4"/>
                    <h3 className="text-xl font-semibold mb-2">Editor Visual de Fluxos</h3>
                    <p className="mb-1">Para começar, selecione um fluxo existente na aba "Fluxos Automáticos" e clique em "Editar no Editor".</p>
                    <p>Ou, crie um "Novo Fluxo" e depois volte aqui para desenhar sua automação.</p>
                </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold">Templates de Mensagem</h2><p className="text-muted-foreground">Gerencie templates aprovados pelo WhatsApp</p></div>
             <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
              <DialogTrigger asChild><Button className="neu-button" onClick={() => handleOpenTemplateModal()}><Plus className="w-4 h-4 mr-2" /> Novo Template</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingTemplate ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle></DialogHeader>
                 <form onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const variables = (formData.get('template-variables') as string).split(',').map(v => v.trim()).filter(v => v); 
                  const templateData = {
                    name: formData.get('template-name') as string,
                    category: formData.get('template-category') as MessageTemplate['category'],
                    language: (formData.get('template-language') as string) || 'pt_BR',
                    content: formData.get('template-content') as string,
                    variables: variables.length > 0 ? variables : undefined,
                  };
                  handleSaveTemplate(templateData);
                }}>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="template-name">Nome do Template</Label><Input id="template-name" name="template-name" placeholder="Ex: welcome_message" className="neu-input" defaultValue={editingTemplate?.name} required/></div>
                      <div className="space-y-2">
                        <Label htmlFor="template-category">Categoria</Label>
                        <Select name="template-category" defaultValue={editingTemplate?.category || "utility"}>
                          <SelectTrigger className="neu-input"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="utility">Utilitário</SelectItem>
                            <SelectItem value="authentication">Autenticação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="template-language">Idioma</Label>
                        <Input id="template-language" name="template-language" placeholder="Ex: pt_BR, en_US" className="neu-input" defaultValue={editingTemplate?.language || 'pt_BR'} required/>
                      </div>
                    <div className="space-y-2"><Label htmlFor="template-content">Conteúdo da Mensagem</Label><Textarea id="template-content" name="template-content" placeholder="Digite o conteúdo... Use {{variavel}} para variáveis" className="neu-input" rows={4} defaultValue={editingTemplate?.content} required/></div>
                    <div className="space-y-2"><Label htmlFor="template-variables">Variáveis (separadas por vírgula)</Label><Input id="template-variables" name="template-variables" placeholder="Ex: nome, pedido_id, data_entrega" className="neu-input" defaultValue={editingTemplate?.variables?.join(', ')} /></div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => { setIsTemplateModalOpen(false); setEditingTemplate(null); }} disabled={isSubmittingTemplate}>Cancelar</Button>
                    <Button type="submit" className="neu-button" disabled={isSubmittingTemplate}>
                      {isSubmittingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {editingTemplate ? 'Salvar Alterações' : 'Enviar para Aprovação'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {templatesLoading && <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}
          {templatesError && <div className="p-4 text-center text-red-500">Erro ao carregar templates: {templatesError}</div>}
          {!templatesLoading && !templatesError && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {templates.length === 0 && <p className="col-span-full text-center text-muted-foreground">Nenhum template criado.</p>}
              {templates.map((template) => (
                <Card key={template.id} className="neu-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant={template.status === 'approved' ? 'default' : template.status === 'pending' || template.status === 'submitted' ? 'secondary' : 'destructive'}>
                          {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenTemplateModal(template)}><Edit className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground"><span>Categoria: {template.category}</span><span>Idioma: {template.language}</span></div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2"><Label>Conteúdo:</Label><div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">{template.content}</div></div>
                    {template.variables && template.variables.length > 0 && (
                      <div className="space-y-2"><Label>Variáveis:</Label><div className="flex flex-wrap gap-1">{template.variables.map((variable) => (<Badge key={variable} variant="outline" className="text-xs">{`{{${variable}}}`}</Badge>))}</div></div>
                    )}
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => console.log(`Usar template ${template.name}`)}><Upload className="w-4 h-4 mr-1" />Usar Template</Button>
                      <Button size="sm" className="flex-1 neu-button" onClick={() => console.log(`Testar template ${template.name}`)}><MessageSquare className="w-4 h-4 mr-1" />Testar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analyticsLoading && <div className="p-4 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}
          {analyticsError && <div className="p-4 text-center text-red-500">Erro ao carregar analytics: {analyticsError}</div>}
          {analyticsData && !analyticsLoading && !analyticsError && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="neu-card"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.totalMessages.toLocaleString('pt-BR')}</div><p className="text-xs text-muted-foreground">{analyticsData.totalMessagesPrevMonthDiff >= 0 ? '+' : ''}{analyticsData.totalMessagesPrevMonthDiff}% mês anterior</p></CardContent></Card>
                <Card className="neu-card"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.activeConversations.toLocaleString('pt-BR')}</div><p className="text-xs text-muted-foreground">{analyticsData.activeConversationsPrevMonthDiff >= 0 ? '+' : ''}{analyticsData.activeConversationsPrevMonthDiff}% mês anterior</p></CardContent></Card>
                <Card className="neu-card"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.responseRate}%</div><p className="text-xs text-muted-foreground">{analyticsData.responseRatePrevMonthDiff >= 0 ? '+' : ''}{analyticsData.responseRatePrevMonthDiff}% mês anterior</p></CardContent></Card>
                <Card className="neu-card"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analyticsData.avgResponseTime}</div><p className="text-xs text-muted-foreground">{analyticsData.avgResponseTimePrevMonthDiff} mês anterior</p></CardContent></Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="neu-card">
                  <CardHeader><CardTitle>Fluxos Mais Utilizados</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.topFlows.length === 0 && <p className="text-center text-muted-foreground">Nenhum dado de fluxo disponível.</p>}
                      {analyticsData.topFlows.map((flow) => (
                        <div key={flow.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3"><Bot className="w-4 h-4 text-primary" /><span className="font-medium">{flow.name}</span></div>
                          <div className="text-right"><p className="font-bold">{flow.users.toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">usuários</p></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="neu-card">
                  <CardHeader><CardTitle>Horários de Maior Atividade</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.activityByHour.length === 0 && <p className="text-center text-muted-foreground">Nenhum dado de atividade disponível.</p>}
                      {analyticsData.activityByHour.map((activity) => (
                        <div key={activity.hourRange} className="flex justify-between items-center">
                          <span>{activity.hourRange}</span>
                          <div className="w-32 bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${activity.percentage}%` }}></div></div>
                          <span className="text-sm font-medium">{activity.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
           {!analyticsData && !analyticsLoading && !analyticsError && (
             <Card className="neu-card"><CardContent className="pt-6 text-center text-muted-foreground">Dados de analytics ainda não disponíveis.</CardContent></Card>
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
