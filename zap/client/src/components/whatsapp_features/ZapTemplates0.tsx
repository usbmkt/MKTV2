import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import FlowBuilder from '@/components/flow-builder';
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
  AlertTriangle, // Adicionado para uso em caso de erro
  XCircle, // Adicionado para uso em caso de erro
  Info // Adicionado para uso em caso de erro
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert'; // Importação já existe

interface WhatsAppMessage {
  id: number;
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
  contactNumber: string;
  contactName: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount?: number;
  tags?: string[];
  isBot?: boolean;
}

interface ChatFlow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  isActive: boolean;
  steps: FlowStep[];
  analytics: {
    totalUsers: number;
    completionRate: number;
    avgTime: string;
  };
}

interface FlowStep {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action' | 'delay';
  content: string;
  options?: string[];
  nextStep?: string;
  delay?: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL';
  components: TemplateComponent[];
  qualityScore?: {
    score: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    lastUpdatedTime?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'CATALOG';
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string[];
  couponCode?: string;
}

const initialTemplatesFromMock: MessageTemplate[] = [
  {
    id: 'welcome_message_123',
    name: 'welcome_message_123',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Bem-vindo à {{1}}!' },
      { type: 'BODY', text: 'Olá {{1}}, obrigado por se registrar! Seu código de verificação é {{2}}. Use este código para ativar sua conta. Se precisar de ajuda, responda a esta mensagem.' },
      { type: 'FOOTER', text: 'Atenciosamente, Equipe USB MKT PRO' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Preciso de Ajuda' }] }
    ],
    qualityScore: { score: 'GREEN' }
  },
];

const fetchTemplates = async (): Promise<MessageTemplate[]> => {
  console.log("Buscando templates (simulado)...");
  await new Promise(resolve => setTimeout(resolve, 500));
  return JSON.parse(JSON.stringify(initialTemplatesFromMock));
};

const createTemplate = async (templateData: Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> => {
  console.log("Criando template (simulado):", templateData);
  await new Promise(resolve => setTimeout(resolve, 500));
  const newTemplate: MessageTemplate = {
    ...templateData,
    id: `template_${Date.now()}`,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  initialTemplatesFromMock.push(newTemplate);
  return newTemplate;
};

const deleteTemplateApi = async (templateId: string): Promise<void> => {
  console.log("Deletando template (simulado):", templateId);
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = initialTemplatesFromMock.findIndex(t => t.id === templateId);
  if (index > -1) {
    initialTemplatesFromMock.splice(index, 1);
  } else {
    throw new Error("Template não encontrado para exclusão.");
  }
};

const defaultNewTemplateDataState: Partial<MessageTemplate> = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  components: [
    { type: 'BODY', text: '' },
    { type: 'BUTTONS', buttons: [] }
  ]
};

export default function WhatsApp() {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('conversations');
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplateData, setNewTemplateData] = useState<Partial<MessageTemplate>>(defaultNewTemplateDataState);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery<MessageTemplate[]>({
    queryKey: ['zapTemplates'],
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation<MessageTemplate, Error, Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>>({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: "Template enviado para aprovação!", variant: "default" });
      setIsModalOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar template", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteTemplateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: "Template excluído!", variant: "default" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir template", description: err.message, variant: "destructive" });
    }
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "category" || name === "language") {
        setNewTemplateData(prev => ({ ...prev, [name]: value as MessageTemplate['category'] | MessageTemplate['language'] }));
    } else {
        setNewTemplateData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleComponentChange = (index: number, field: keyof TemplateComponent, value: any) => {
    setNewTemplateData(prev => {
      const components = [...(prev.components || [])];
      const targetComponent = { ...components[index] }; 
      (targetComponent as any)[field] = value; 
      components[index] = targetComponent; 
      return { ...prev, components };
    });
  };

  const addComponent = (type: TemplateComponent['type']) => {
    let newComponent: TemplateComponent;
    switch(type) {
      case 'HEADER': newComponent = { type: 'HEADER', format: 'TEXT', text: ''}; break;
      case 'BODY': newComponent = { type: 'BODY', text: ''}; break;
      case 'FOOTER': newComponent = { type: 'FOOTER', text: ''}; break;
      case 'BUTTONS': newComponent = { type: 'BUTTONS', buttons: [{type: 'QUICK_REPLY', text: 'Resposta Rápida'}]}; break;
      default: return;
    }
    setNewTemplateData(prev => ({...prev, components: [...(prev.components || []), newComponent]}));
  };
  
  const removeComponent = (index: number) => {
    setNewTemplateData(prev => ({...prev, components: prev.components?.filter((_, i) => i !== index)}));
  };

  const handleButtonChange = (compIndex: number, btnIndex: number, field: keyof TemplateButton, value: string) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || [])); 
      if (components[compIndex]?.buttons) {
        (components[compIndex].buttons[btnIndex] as any)[field] = value;
      }
      return { ...prev, components };
    });
  };

  const addTemplateButton = (compIndex: number) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || []));
      if (components[compIndex]?.buttons) {
        components[compIndex].buttons.push({ type: 'QUICK_REPLY', text: 'Nova Resposta' });
      } else if (components[compIndex]) {
        components[compIndex].buttons = [{ type: 'QUICK_REPLY', text: 'Nova Resposta' }];
      }
      return { ...prev, components };
    });
  };

  const removeTemplateButton = (compIndex: number, btnIndex: number) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || []));
      if (components[compIndex]?.buttons) {
        components[compIndex].buttons.splice(btnIndex, 1);
      }
      return { ...prev, components };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTemplateData.name || !newTemplateData.category || !newTemplateData.language || !newTemplateData.components?.some(c => c.type === 'BODY' && c.text?.trim())) {
      toast({ title: "Campos obrigatórios", description: "Nome, categoria, idioma e corpo da mensagem são obrigatórios.", variant: "destructive" });
      return;
    }
    createMutation.mutate(newTemplateData as Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeClass = (status: MessageTemplate['status']) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700 border-green-300';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };
  
  const getQualityScoreBadgeClass = (score?: MessageTemplate['qualityScore'] | null) => {
    if (!score || !score.score) return 'bg-gray-100 text-gray-700 border-gray-300';
    switch (score.score) {
      case 'GREEN': return 'bg-green-100 text-green-700 border-green-300';
      case 'YELLOW': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'RED': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const handleModalOpenChange = (isOpen: boolean) => {
    setIsModalOpen(isOpen);
    if (!isOpen) {
      setEditingTemplate(null); 
      setNewTemplateData(defaultNewTemplateDataState); 
    }
  };

  useEffect(() => {
    if (isModalOpen) { 
      if (editingTemplate) {
        setNewTemplateData(editingTemplate);
      } else {
        setNewTemplateData(defaultNewTemplateDataState); 
      }
    } else {
        setNewTemplateData(defaultNewTemplateDataState);
    }
  }, [editingTemplate, isModalOpen]);


  // Mock data - In production, this would come from your API
  const [contacts] = useState<Contact[]>([
    {
      contactNumber: '+5511999887766',
      contactName: 'João Silva',
      lastMessage: 'Olá! Gostaria de saber mais sobre os produtos',
      timestamp: new Date(Date.now() - 300000),
      unreadCount: 2,
      tags: ['Lead', 'Interessado'],
      isBot: false
    },
    {
      contactNumber: '+5511888776655',
      contactName: 'Maria Santos',
      lastMessage: 'Obrigada pelas informações!',
      timestamp: new Date(Date.now() - 1800000),
      unreadCount: 0,
      tags: ['Cliente'],
      isBot: false
    },
    {
      contactNumber: '+5511777665544',
      contactName: 'Pedro Costa',
      lastMessage: 'Quando vocês abrem?',
      timestamp: new Date(Date.now() - 3600000),
      unreadCount: 1,
      tags: ['Novo'],
      isBot: true
    }
  ]);

  const [currentMessages] = useState<WhatsAppMessage[]>([ // Renomeado para evitar conflito com 'message' do estado
    {
      id: 1,
      contactNumber: '+5511999887766',
      contactName: 'João Silva',
      message: 'Olá! Gostaria de saber mais sobre os produtos',
      direction: 'incoming',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      isRead: false,
      messageType: 'text',
      status: 'delivered'
    },
    {
      id: 2,
      contactNumber: '+5511999887766',
      contactName: 'João Silva',
      message: 'Estou interessado em fazer uma compra',
      direction: 'incoming',
      timestamp: new Date(Date.now() - 240000).toISOString(),
      isRead: false,
      messageType: 'text',
      status: 'delivered'
    }
  ]);

  const [chatFlows] = useState<ChatFlow[]>([
    {
      id: 'welcome-flow',
      name: 'Boas-vindas Automático',
      description: 'Mensagem de boas-vindas para novos contatos',
      trigger: 'primeira_mensagem',
      isActive: true,
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: 'Olá! 👋 Bem-vindo(a) à USB MKT PRO! Como posso ajudá-lo hoje?',
          nextStep: 'step2'
        },
        {
          id: 'step2',
          type: 'question',
          content: 'Escolha uma opção:',
          options: ['Informações sobre produtos', 'Suporte técnico', 'Falar com vendedor'],
          nextStep: 'step3'
        }
      ],
      analytics: {
        totalUsers: 127,
        completionRate: 85,
        avgTime: '2m 34s'
      }
    },
    {
      id: 'lead-qualification',
      name: 'Qualificação de Leads',
      description: 'Coleta informações de potenciais clientes',
      trigger: 'palavra_chave: "interessado"',
      isActive: true,
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: 'Ótimo! Vou te ajudar a encontrar a melhor solução.',
          nextStep: 'step2'
        },
        {
          id: 'step2',
          type: 'question',
          content: 'Qual é o seu segmento de negócio?',
          options: ['E-commerce', 'Serviços', 'Indústria', 'Outro'],
          nextStep: 'step3'
        }
      ],
      analytics: {
        totalUsers: 89,
        completionRate: 72,
        avgTime: '4m 12s'
      }
    },
    {
      id: 'support-flow',
      name: 'Suporte Técnico',
      description: 'Fluxo para dúvidas e problemas técnicos',
      trigger: 'palavra_chave: "problema", "erro", "ajuda"',
      isActive: true,
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: 'Entendi que você está com um problema. Vou te ajudar! 🛠️',
          nextStep: 'step2'
        },
        {
          id: 'step2',
          type: 'question',
          content: 'Qual tipo de problema você está enfrentando?',
          options: ['Login/Acesso', 'Funcionalidade', 'Performance', 'Outro'],
          nextStep: 'step3'
        }
      ],
      analytics: {
        totalUsers: 45,
        completionRate: 91,
        avgTime: '3m 45s'
      }
    }
  ]);

  const filteredContacts = contacts.filter(contact =>
    contact.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.contactNumber.includes(searchTerm)
  );

  const selectedContactMessages = currentMessages.filter(
    msg => msg.contactNumber === selectedContact
  );

  const getContactInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMessageStatus = (status?: string) => {
    switch (status) {
      case 'sent': return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered': return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read': return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedContact) return;
    
    console.log('Sending message:', message, 'to:', selectedContact);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Carregando templates...</div>;
  if (error) return <div className="p-4 text-center text-red-500"><AlertTriangle className="w-6 h-6 mx-auto mb-2"/>Erro ao carregar templates: {(error as Error).message}</div>;

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
          <Button variant="outline" className="neu-button">
            <Download className="w-4 h-4 mr-2" />
            Exportar Conversas
          </Button>
          <Button className="neu-button">
            <Bot className="w-4 h-4 mr-2" />
            Novo Bot
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
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
            {/* Lista de Contatos */}
            <Card className="neu-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Conversas</CardTitle>
                  <Badge variant="secondary">{contacts.length}</Badge>
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
                <ScrollArea className="h-[500px]">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.contactNumber}
                      className={`p-4 cursor-pointer border-b transition-colors hover:bg-accent/50 ${
                        selectedContact === contact.contactNumber ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedContact(contact.contactNumber)}
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
                              {contact.timestamp.toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.lastMessage}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex flex-wrap gap-1">
                              {contact.tags?.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            {contact.unreadCount && contact.unreadCount > 0 && (
                              <Badge className="bg-green-500 text-white">
                                {contact.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Área de Chat */}
            <div className="lg:col-span-2">
              {selectedContact ? (
                <Card className="neu-card h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getContactInitials(
                              contacts.find(c => c.contactNumber === selectedContact)?.contactName || ''
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">
                            {contacts.find(c => c.contactNumber === selectedContact)?.contactName}
                          </h3>
                          <p className="text-sm text-muted-foreground">{selectedContact}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="neu-button">
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="neu-button">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {selectedContactMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-2xl ${
                                msg.direction === 'outgoing'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'neu-card-inset'
                              }`}
                            >
                              <p className="text-sm">{msg.message}</p>
                              <div className="flex items-center justify-end space-x-1 mt-1">
                                <span className="text-xs opacity-70">
                                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {msg.direction === 'outgoing' && getMessageStatus(msg.status)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="border-t p-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="neu-button">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <div className="flex-1 relative">
                          <Textarea
                            placeholder="Digite sua mensagem..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="neu-input min-h-[40px] max-h-[100px] resize-none"
                            rows={1}
                          />
                        </div>
                        <Button variant="ghost" size="sm" className="neu-button">
                          <Smile className="w-4 h-4" />
                        </Button>
                        <Button 
                          onClick={sendMessage}
                          disabled={!message.trim()}
                          className="neu-button"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="neu-card h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Selecione uma conversa</h3>
                    <p className="text-muted-foreground">
                      Escolha um contato para começar a conversar
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Fluxos Automáticos</h2>
              <p className="text-muted-foreground">Configure chatbots e automações</p>
            </div>
            <Dialog open={isFlowModalOpen} onOpenChange={setIsFlowModalOpen}>
              <DialogTrigger asChild>
                <Button className="neu-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Fluxo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Fluxo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="flow-name">Nome do Fluxo</Label>
                      <Input id="flow-name" placeholder="Ex: Boas-vindas" className="neu-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flow-trigger">Gatilho</Label>
                      <Select>
                        <SelectTrigger className="neu-input">
                          <SelectValue placeholder="Selecione o gatilho" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first-message">Primeira mensagem</SelectItem>
                          <SelectItem value="keyword">Palavra-chave</SelectItem>
                          <SelectItem value="schedule">Agendado</SelectItem>
                          <SelectItem value="action">Ação específica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flow-description">Descrição</Label>
                    <Textarea 
                      id="flow-description" 
                      placeholder="Descreva o objetivo deste fluxo..."
                      className="neu-input"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsFlowModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="neu-button">Criar Fluxo</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {chatFlows.map((flow) => (
              <Card key={flow.id} className="neu-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{flow.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch checked={flow.isActive} />
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{flow.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gatilho:</span>
                    <Badge variant="outline">{flow.trigger}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Etapas:</span>
                    <span className="font-medium">{flow.steps.length}</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Performance</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-primary">{flow.analytics.totalUsers}</p>
                        <p className="text-xs text-muted-foreground">Usuários</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-500">{flow.analytics.completionRate}%</p>
                        <p className="text-xs text-muted-foreground">Conclusão</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-500">{flow.analytics.avgTime}</p>
                        <p className="text-xs text-muted-foreground">Tempo Médio</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Ver Analytics
                    </Button>
                    <Button size="sm" className="flex-1 neu-button">
                      <Settings className="w-4 h-4 mr-1" />
                      Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flow-builder" className="space-y-4">
          <Card className="neu-card h-[calc(100vh-250px)]">
            <FlowBuilder 
              onSave={(nodes) => {
                console.log('Fluxo salvo:', nodes);
              }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Templates de Mensagem</h2>
              <p className="text-muted-foreground">Gerencie templates aprovados pelo WhatsApp</p>
            </div>
            <Button 
              onClick={() => { 
                setEditingTemplate(null); 
                setIsModalOpen(true); 
              }} 
              className="neu-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </div>

          <Card className="neu-card">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar templates..."
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="neu-input max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum template encontrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => (
                    <Card key={template.id} className="neu-card hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base font-semibold truncate">{template.name}</CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-1 h-7 neu-button">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingTemplate(template); 
                                setIsModalOpen(true); 
                              }}>
                                <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-500" onClick={() => deleteMutation.mutate(template.id)} disabled={deleteMutation.isPending && deleteMutation.variables === template.id}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center space-x-2 text-xs mt-1">
                          <Badge variant="outline" className={getStatusBadgeClass(template.status)}>{template.status}</Badge>
                          {template.qualityScore && (
                            <Badge variant="outline" className={getQualityScoreBadgeClass(template.qualityScore)}>
                              Qualidade: {template.qualityScore.score}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <p><strong>Categoria:</strong> {template.category}</p>
                        <p><strong>Idioma:</strong> {template.language}</p>
                        <div className="mt-2">
                          <p className="font-medium mb-1">Corpo da Mensagem:</p>
                          <p className="text-muted-foreground bg-muted/50 p-2 rounded line-clamp-3">
                            {template.components.find(c => c.type === 'BODY')?.text || 'Corpo não definido'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle>{editingTemplate ? 'Editar Template' : 'Criar Novo Template de Mensagem'}</DialogTitle>
                <DialogDescription>
                  {editingTemplate ? `Modificando o template "${editingTemplate.name}".` : 'Os templates precisam ser aprovados pelo WhatsApp antes do uso.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="template-modal-name">Nome do Template*</Label> {/* Alterado ID para evitar duplicidade */}
                        <Input
                            id="template-modal-name"
                            name="name"
                            value={newTemplateData.name || ''}
                            onChange={handleInputChange}
                            placeholder="Ex: promocao_natal_2024"
                            className="neu-input"
                            required
                        />
                        <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e underscores.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="template-modal-category">Categoria*</Label>
                        <Select
                            name="category"
                            value={newTemplateData.category || 'UTILITY'}
                            onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, category: value as MessageTemplate['category'] }))}
                        >
                            <SelectTrigger id="template-modal-category" className="neu-input"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MARKETING">Marketing</SelectItem>
                                <SelectItem value="UTILITY">Utilitário</SelectItem>
                                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="template-modal-language">Idioma*</Label>
                        <Select
                            name="language"
                            value={newTemplateData.language || 'pt_BR'}
                            onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, language: value }))}
                        >
                            <SelectTrigger id="template-modal-language" className="neu-input"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                                <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                                <SelectItem value="es_ES">Espanhol (Espanha)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <Card className="neu-card-inset">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base">Componentes do Template</CardTitle>
                    <CardDescription className="text-xs">Defina o conteúdo da sua mensagem.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(newTemplateData.components || []).map((comp, compIndex) => {
                      if (!comp) return null;
                      return (
                        <div key={compIndex} className="p-3 border rounded bg-card space-y-2">
                          <div className="flex justify-between items-center">
                            <Badge variant="secondary">{comp.type}</Badge>
                            {comp.type !== 'BODY' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 p-1 text-red-500"
                                onClick={() => removeComponent(compIndex)}
                              >
                                <XCircle className="w-3.5 h-3.5"/>
                              </Button>
                            )}
                          </div>
                          {comp.type === 'HEADER' && (
                            <Select
                              value={comp.format || 'TEXT'}
                              onValueChange={(value: string) => handleComponentChange(compIndex, 'format', value)}
                            >
                                <SelectTrigger className="text-xs neu-input h-8"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TEXT">Texto</SelectItem>
                                    <SelectItem value="IMAGE">Imagem</SelectItem>
                                    <SelectItem value="VIDEO">Vídeo</SelectItem>
                                    <SelectItem value="DOCUMENT">Documento</SelectItem>
                                </SelectContent>
                            </Select>
                          )}
                          {((comp.type === 'HEADER' && comp.format === 'TEXT') || comp.type === 'BODY' || comp.type === 'FOOTER') && (
                            <Textarea
                              placeholder={`Conteúdo para ${comp.type.toLowerCase()}`}
                              value={comp.text || ''}
                              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleComponentChange(compIndex, 'text', e.target.value)}
                              rows={comp.type === 'BODY' ? 4 : 2}
                              className="text-sm neu-input"
                            />
                          )}
                          {comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT') && (
                            <div className="text-xs text-muted-foreground p-2 border border-dashed rounded bg-muted/50">
                              <Info className="w-3 h-3 inline mr-1"/>
                              {comp.format === 'IMAGE' ? 'Para Imagem: Forneça um link de exemplo ou deixe em branco para adicionar via API ao enviar.' :
                               comp.format === 'VIDEO' ? 'Para Vídeo: Forneça um link de exemplo ou deixe em branco para adicionar via API.' :
                               'Para Documento: Forneça um nome de arquivo de exemplo ou deixe em branco.'}
                              <Input
                                type="text"
                                placeholder="Link de exemplo (opcional)"
                                value={(comp.example?.header_handle || [])[0] || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleComponentChange(compIndex, 'example', { ...comp.example, header_handle: [e.target.value] })}
                                className="text-xs mt-1 neu-input h-7"
                              />
                            </div>
                          )}
                          {comp.type === 'BUTTONS' && comp.buttons && (
                            <div className="space-y-2">
                              {comp.buttons.map((btn, btnIndex) => (
                                <div key={btnIndex} className="p-2 border rounded bg-background space-y-1">
                                  <div className="flex justify-between items-center">
                                    <Select
                                      value={btn.type}
                                      onValueChange={(value: string) => handleButtonChange(compIndex, btnIndex, 'type', value as TemplateButton['type'])}
                                    >
                                        <SelectTrigger className="text-xs neu-input h-8 w-40"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                                            <SelectItem value="URL">Link (URL)</SelectItem>
                                            <SelectItem value="PHONE_NUMBER">Ligar</SelectItem>
                                            <SelectItem value="COPY_CODE">Copiar Código</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0"
                                      onClick={() => removeTemplateButton(compIndex, btnIndex)}
                                    >
                                      <Trash2 className="w-3 h-3 text-red-500"/>
                                    </Button>
                                  </div>
                                  <Input
                                    placeholder="Texto do Botão"
                                    value={btn.text}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'text', e.target.value)}
                                    className="text-xs neu-input h-8"
                                  />
                                  {btn.type === 'URL' && (
                                    <Input
                                      placeholder="https://exemplo.com/{{1}}"
                                      value={btn.url || ''}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'url', e.target.value)}
                                      className="text-xs neu-input h-8"
                                    />
                                  )}
                                  {btn.type === 'PHONE_NUMBER' && (
                                    <Input
                                      placeholder="+5511999999999"
                                      value={btn.phoneNumber || ''}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'phoneNumber', e.target.value)}
                                      className="text-xs neu-input h-8"
                                    />
                                  )}
                                  {btn.type === 'COPY_CODE' && (
                                    <Input
                                      placeholder="CUPOMXYZ"
                                      value={btn.couponCode || ''}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'couponCode', e.target.value)}
                                      className="text-xs neu-input h-8"
                                    />
                                  )}
                                </div>
                              ))}
                              {(comp.buttons?.length || 0) < 3 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTemplateButton(compIndex)}
                                  className="text-xs h-7"
                                >
                                  + Botão
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => addComponent('HEADER')} className="text-xs h-7">Header</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => addComponent('FOOTER')} className="text-xs h-7">Rodapé</Button>
                      {!(newTemplateData.components || []).find(c => c.type === 'BUTTONS') && (
                        <Button type="button" variant="outline" size="sm" onClick={() => addComponent('BUTTONS')} className="text-xs h-7">Botões</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-700">
                  <Info className="h-4 w-4 !text-amber-600" />
                  <AlertDescription className="text-xs">
                    <strong>Atenção:</strong> Todas as variáveis devem ser no formato <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>, etc.
                    O conteúdo do template deve seguir as <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800">diretrizes do WhatsApp</a>.
                    A aprovação pode levar de alguns minutos a algumas horas.
                  </AlertDescription>
                </Alert>
              </form>
              <DialogFooter className="p-6 pt-4 border-t">
                <Button variant="outline" onClick={() => handleModalOpenChange(false)} disabled={createMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  type="submit" 
                  form="template-form-id" // Adicionar ID ao form e referenciar aqui
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      // Para garantir que o form seja submetido programaticamente
                      // se o botão estiver fora do <form> ou para controle extra.
                      // Se o botão já é type="submit" e está DENTRO do form, esta linha não é estritamente necessária.
                      // No entanto, para manter a lógica original do handleSubmit, podemos simular
                      // o evento do form.
                      const form = document.getElementById("template-form-id") as HTMLFormElement;
                      if (form) {
                        // Para evitar dupla submissão se o botão já for type="submit"
                        // e para permitir que o handleSubmit do form seja chamado.
                        if (form.requestSubmit) {
                            form.requestSubmit();
                        } else { // Fallback para navegadores mais antigos
                            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        }
                      }
                    }}
                  disabled={createMutation.isPending}
                  className="neu-button-primary"
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTemplate ? 'Salvar Alterações' : 'Enviar para Aprovação'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="neu-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <p className="text-xs text-muted-foreground">+12% em relação ao mês passado</p>
              </CardContent>
            </Card>
            
            <Card className="neu-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">127</div>
                <p className="text-xs text-muted-foreground">+5% em relação ao mês passado</p>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">94%</div>
                <p className="text-xs text-muted-foreground">+2% em relação ao mês passado</p>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2m 34s</div>
                <p className="text-xs text-muted-foreground">-15s em relação ao mês passado</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Fluxos Mais Utilizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {chatFlows.map((flow) => (
                    <div key={flow.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="font-medium">{flow.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{flow.analytics.totalUsers}</p>
                        <p className="text-xs text-muted-foreground">usuários</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Horários de Maior Atividade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>09:00 - 12:00</span>
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <span className="text-sm font-medium">85%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>14:00 - 17:00</span>
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <span className="text-sm font-medium">92%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>19:00 - 22:00</span>
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '67%' }}></div>
                    </div>
                    <span className="text-sm font-medium">67%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
