import { useState, useEffect } from 'react';
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
  BarChart3
} from 'lucide-react';

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
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  content: string;
  variables?: string[];
}

export default function WhatsApp() {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('conversations');
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ChatFlow | null>(null);

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

  const [messages] = useState<WhatsAppMessage[]>([
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

  const [templates] = useState<MessageTemplate[]>([
    {
      id: 'welcome-new-customer',
      name: 'Boas-vindas Novo Cliente',
      category: 'marketing',
      language: 'pt_BR',
      status: 'approved',
      content: 'Olá {{name}}! 🎉 Bem-vindo(a) à USB MKT PRO! Estamos muito felizes em tê-lo(a) conosco.',
      variables: ['name']
    },
    {
      id: 'order-confirmation',
      name: 'Confirmação de Pedido',
      category: 'utility',
      language: 'pt_BR',
      status: 'approved',
      content: 'Seu pedido #{{order_id}} foi confirmado! Total: R$ {{amount}}. Prazo de entrega: {{delivery_time}}.',
      variables: ['order_id', 'amount', 'delivery_time']
    },
    {
      id: 'payment-reminder',
      name: 'Lembrete de Pagamento',
      category: 'utility',
      language: 'pt_BR',
      status: 'approved',
      content: 'Olá {{name}}! Lembramos que sua fatura no valor de R$ {{amount}} vence em {{due_date}}.',
      variables: ['name', 'amount', 'due_date']
    }
  ]);

  const filteredContacts = contacts.filter(contact =>
    contact.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.contactNumber.includes(searchTerm)
  );

  const selectedContactMessages = messages.filter(
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
    
    // Here you would send the message to your backend/WhatsApp API
    console.log('Sending message:', message, 'to:', selectedContact);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
                // Aqui você salvaria os nós do fluxo na sua API
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
            <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
              <DialogTrigger asChild>
                <Button className="neu-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Nome do Template</Label>
                      <Input id="template-name" placeholder="Ex: welcome_message" className="neu-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-category">Categoria</Label>
                      <Select>
                        <SelectTrigger className="neu-input">
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="utility">Utilitário</SelectItem>
                          <SelectItem value="authentication">Autenticação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                    <Textarea 
                      id="template-content" 
                      placeholder="Digite o conteúdo... Use {{variavel}} para variáveis"
                      className="neu-input"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Variáveis</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">nome</Badge>
                      <Badge variant="outline">telefone</Badge>
                      <Badge variant="outline">data</Badge>
                      <Button variant="ghost" size="sm" className="h-6">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="neu-button">Criar Template</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="neu-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={template.status === 'approved' ? 'default' : 
                                template.status === 'pending' ? 'secondary' : 'destructive'}
                      >
                        {template.status === 'approved' ? 'Aprovado' :
                         template.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Categoria: {template.category}</span>
                    <span>Idioma: {template.language}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Conteúdo:</Label>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      {template.content}
                    </div>
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="space-y-2">
                      <Label>Variáveis:</Label>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Upload className="w-4 h-4 mr-1" />
                      Usar Template
                    </Button>
                    <Button size="sm" className="flex-1 neu-button">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Testar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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