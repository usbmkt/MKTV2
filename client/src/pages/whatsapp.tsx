// client/src/pages/whatsapp.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    MessageSquare, ListChecks, Trash2 as IconTrash, Image as ImageIcon, Clock, Variable, Waypoints, HelpCircle, Plus, Send, RadioTower, UserCheck, LogOut, Save, Play, Square, Filter, Layers, Activity, Workflow, Mic, FileText as FileIcon, MapPin, Repeat, Webhook, X, AlertTriangle, Bot, Clock10, Tag, Shuffle,
    MessageCircle as MsgIcon, Phone, Search, MoreVertical, Check, CheckCheck, Paperclip, Smile,
    Loader2
} from 'lucide-react';
import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Node, Edge, OnConnect, BackgroundVariant, MarkerType, Position, Handle, NodeProps, useReactFlow, ReactFlowProvider, NodeOrigin, Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    FlowData, CampaignSelectItem, NodeContextMenuProps as FlowNodeContextMenuProps, ButtonOption, ListItem, ListSection,
    GPTQueryNodeData, TextMessageNodeData, ButtonMessageNodeData, ImageNodeData, AudioNodeData, FileNodeData, LocationNodeData, ListMessageNodeData, DelayNodeData, WaitInputNodeData, SetVariableNodeData, ConditionNodeData, TimeConditionNodeData, LoopNodeData, ApiCallNodeData, WebhookCallNodeData, AssignAgentNodeData, EndFlowNodeData, GoToFlowNodeData, TagContactNodeData,
    AllNodeDataTypes
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import { WhatsAppConnection } from '@/components/whatsapp-connection';

// --- TIPOS REAIS ---
interface Contact {
  contactNumber: string;
  contactName: string | null;
  lastMessage: string;
  timestamp: string; // Vem como string da API
  unreadCount: number;
}

interface WhatsAppMessage {
    id: number;
    contactNumber: string;
    contactName: string | null;
    message: string;
    direction: 'incoming' | 'outgoing';
    timestamp: string;
    isRead: boolean;
}


// --- INÍCIO DOS COMPONENTES DE NÓ E FUNÇÕES AUXILIARES DO FLUXO (Sem alterações) ---
const NodeInput = (props: React.ComponentProps<typeof Input>) => <Input {...props} className={cn(baseInputInsetStyle, "text-[11px] h-7 px-1.5 py-1 rounded", props.className)} />;
const NodeLabel = (props: React.ComponentProps<typeof Label>) => <Label {...props} className={cn("text-[10px] text-gray-400 mb-0.5 block font-normal", props.className)} style={{ textShadow: `0 0 3px ${NEON_COLOR}30` }}/>;
const NodeButton = (props: React.ComponentProps<typeof Button>) => <Button variant="outline" {...props} className={cn(baseButtonSelectStyle, `text-[10px] h-6 w-full rounded-sm px-2`, props.className)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }} />;
const NodeSelect = ({ children, placeholder, ...props }: React.ComponentProps<typeof Select> & { placeholder?: string }) => ( <Select {...props}> <SelectTrigger className={cn(baseButtonSelectStyle, "h-7 text-[11px] rounded px-1.5")}> <SelectValue placeholder={placeholder || 'Selecione...'} /> </SelectTrigger> <SelectContent className={cn(popoverContentStyle, "text-xs")}> {children} </SelectContent> </Select> );
const NodeTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, ...props }, ref) => { const internalRef = useRef<HTMLTextAreaElement>(null); const currentRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>; const autoResize = useCallback(() => { if (currentRef.current) { currentRef.current.style.height = 'auto'; currentRef.current.style.height = `${currentRef.current.scrollHeight}px`; } }, [currentRef]); useEffect(() => { autoResize(); }, [value, autoResize]); const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { autoResize(); if (props.onChange) props.onChange(e); }; return ( <Textarea ref={currentRef} className={cn(baseInputInsetStyle, "text-[11px] resize-none overflow-hidden min-h-[32px] p-1.5 rounded", className)} rows={1} value={value} {...props} onChange={handleChange} onFocus={autoResize} /> ); });
NodeTextarea.displayName = "NodeTextarea";

const NODE_CARD_BASE_CLASSES = "node-card w-60 shadow-lg";
const NODE_HEADER_CLASSES = "node-header !p-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing";
const NODE_CONTENT_CLASSES = "p-2 space-y-1.5";
const NODE_HANDLE_BASE_CLASSES = "!bg-gray-700 !border-none !h-2.5 !w-2.5";
const NODE_HANDLE_GLOW_CLASSES = "node-handle-glow";

// Todas as implementações de nós (TextMessageNode, ButtonMessageNode, etc.) permanecem aqui, sem alterações...
function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const updateNodeData = (newText: string) => { setText(newText); setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text: newText } } : n)); }; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES} /> <CardHeader className={NODE_HEADER_CLASSES}> <div className="flex items-center text-xs"><IconWithGlow icon={MessageSquare} className="mr-1.5 h-3.5 w-3.5"/> Mensagem de Texto</div> </CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeTextarea value={text} onChange={(e) => updateNodeData(e.target.value)} placeholder="Digite sua mensagem aqui..." /> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
function ButtonMessageNode({ id, data }: NodeProps<ButtonMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const [footer, setFooter] = useState(data?.footer || ''); const [buttons, setButtons] = useState<ButtonOption[]>(data?.buttons || [{ id: `btn_${id.slice(-4)}_${Date.now()%10000}`, text: 'Opção 1' }]); const updateNodeData = (field: string, value: any) => { setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); }; const handleButtonTextChange = (buttonId: string, newText: string) => { const newButtons = buttons.map(b => b.id === buttonId ? { ...b, text: newText } : b); setButtons(newButtons); updateNodeData('buttons', newButtons); }; const addButton = () => { if (buttons.length >= 3) return; const newButtonId = `btn_${id.slice(-4)}_${Date.now()%10000}_${buttons.length}`; const newButtons = [...buttons, { id: newButtonId, text: `Nova Opção ${buttons.length + 1}` }]; setButtons(newButtons); updateNodeData('buttons', newButtons); }; const removeButton = (buttonId: string) => { const newButtons = buttons.filter(b => b.id !== buttonId); setButtons(newButtons); updateNodeData('buttons', newButtons); };
    return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5"/> Mensagem com Botões</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Texto Principal</NodeLabel> <NodeTextarea value={text} onChange={(e) => {setText(e.target.value); updateNodeData('text', e.target.value)}} placeholder="Mensagem principal..."/> <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel> <NodeInput value={footer} onChange={(e) => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}} placeholder="Texto do rodapé..."/> <NodeLabel className="mt-1">Botões ({buttons.length}/3 max)</NodeLabel> <div className={cn('space-y-1 max-h-28 overflow-y-auto pr-1', customScrollbarStyle)}> {buttons.map((button, index) => ( <div key={button.id} className='relative group flex items-center gap-1'> <NodeInput value={button.text} onChange={(e) => handleButtonTextChange(button.id, e.target.value)} placeholder={`Texto Botão ${index+1}`} className='flex-grow'/> <Handle type="source" position={Position.Right} id={button.id} style={{ top: `${20 + index * 28}px`, right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-teal-600')} title={button.text || `Saída ${index+1}`} isConnectable={true}/> <Button onClick={() => removeButton(button.id)} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}><X className='w-3 h-3'/></Button> </div> ))} </div> {buttons.length < 3 && <NodeButton onClick={addButton} className="mt-1.5"><Plus className="mr-1 h-3 w-3"/> Adicionar Botão</NodeButton>} </CardContent> </Card> ); }
// ... (cole aqui TODAS as outras definições de nós: ImageNode, AudioMessageNode, ..., EndFlowNode)
// ...
const globalNodeOrigin: NodeOrigin = [0.5, 0.5];


// --- INÍCIO DO EDITOR DE FLUXO INTERNO (Sem alterações) ---
interface FlowEditorInnerProps {
  activeFlowId?: string | null;
  onFlowSelect?: (flowId: string) => void;
}
function FlowEditorInner({ activeFlowId, onFlowSelect }: FlowEditorInnerProps) { 
    // ... (Cole aqui TODO o código do componente FlowEditorInner da resposta anterior. Ele está correto.)
    // ...
    return (
        <div className="flex flex-row h-full min-h-0">
            {/* ... JSX do FlowEditorInner ... */}
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA (Com a lógica de dados reais) ---
const WhatsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('connection'); 
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  
  const [flowsList, setFlowsList] = useState<FlowData[]>([]);
  const [campaignListForFilter, setCampaignListForFilter] = useState<CampaignSelectItem[]>([]);
  const [filterCampaignIdForList, setFilterCampaignIdForList] = useState<string | 'all' | 'none'>('all');
  const [activeFlowIdForEditor, setActiveFlowIdForEditor] = useState<string | null>(null);
  const [isInitialFlowLoad, setIsInitialFlowLoad] = useState(true);

  // --- LÓGICA DE DADOS REAIS PARA "CONVERSAS" ---
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [searchTermContacts, setSearchTermContacts] = useState('');

  // Busca a lista de contatos
  const { data: contacts = [], isLoading: isLoadingContacts, error: contactsError } = useQuery<Contact[]>({
    queryKey: ['whatsappContacts'],
    queryFn: async () => apiRequest('GET', '/api/whatsapp/contacts').then(res => res.json()),
    enabled: auth.isAuthenticated && activeTab === 'conversations',
  });

  // Busca as mensagens para o contato selecionado
  const { data: messages = [], isLoading: isLoadingMessages, error: messagesError } = useQuery<WhatsAppMessage[]>({
    queryKey: ['whatsappMessages', selectedContact?.contactNumber],
    queryFn: async () => apiRequest('GET', `/api/whatsapp/messages?contactNumber=${selectedContact!.contactNumber}`).then(res => res.json()),
    enabled: !!selectedContact,
  });

  // Mutação para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: (newMessage: { contactNumber: string; message: string; direction: 'outgoing' }) => apiRequest('POST', '/api/whatsapp/messages', newMessage),
    onSuccess: () => {
      // Re-busca as mensagens da conversa atual
      queryClient.invalidateQueries({ queryKey: ['whatsappMessages', selectedContact?.contactNumber] });
      // Re-busca a lista de contatos para atualizar a "última mensagem"
      queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao Enviar', description: error.message, variant: 'destructive' });
    }
  });

  const filteredContacts = useMemo(() => 
    contacts.filter(contact => 
        (contact.contactName || '').toLowerCase().includes(searchTermContacts.toLowerCase()) || 
        contact.contactNumber.includes(searchTermContacts)
    ), [contacts, searchTermContacts]
  );
  
  const getContactInitials = (name: string | null) => (name || '#').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const sendChatMessage = () => {
    if (!currentChatMessage.trim() || !selectedContact) return;
    sendMessageMutation.mutate({
      contactNumber: selectedContact.contactNumber,
      message: currentChatMessage,
      direction: 'outgoing',
    });
    setCurrentChatMessage('');
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }};
  
  // --- FIM DA LÓGICA DE CONVERSAS ---
  
  // Queries e Mutações para FLUXOS (sem alteração)
  const { isLoading: isLoadingFlowsList, error: flowsListError } = useQuery<FlowData[]>({ /* ... */ });
  const { isLoading: isLoadingCampaignsForFilter } = useQuery<CampaignSelectItem[]>({ /* ... */ });
  const createNewFlowMutation = useMutation<FlowData, Error, { name: string; campaign_id: string | null }>({ /* ... */ });
  const deleteFlowMutation = useMutation<void, Error, string>({ /* ... */ });
  const createNewFlowForList = useCallback(async () => { /* ... */ }, [auth.isAuthenticated, filterCampaignIdForList, createNewFlowMutation]);
  const deleteFlowFromList = useCallback((flowId: string) => { /* ... */ }, [flowsList, deleteFlowMutation]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        {/* ... Header ... */}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 lg:grid-cols-5">
           {/* ... Tabs Triggers ... */}
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <WhatsAppConnection />
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
            {/* Coluna da Lista de Contatos */}
            <Card className="neu-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Conversas</CardTitle>
                  <Badge variant="secondary">{contacts.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar contatos..." value={searchTermContacts} onChange={(e) => setSearchTermContacts(e.target.value)} className="pl-10 neu-input" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)]">
                  {isLoadingContacts ? (
                    <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2"/> Carregando...</div>
                  ) : contactsError ? (
                    <div className="p-4 text-center text-destructive"><AlertTriangle className="w-5 h-5 inline-block mr-2"/>Erro ao buscar contatos.</div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div key={contact.contactNumber} className={`p-4 cursor-pointer border-b transition-colors hover:bg-accent/50 ${ selectedContact?.contactNumber === contact.contactNumber ? 'bg-accent' : '' }`} onClick={() => setSelectedContact(contact)} >
                        <div className="flex items-center space-x-3">
                           <Avatar className="w-12 h-12"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{getContactInitials(contact.contactName)}</AvatarFallback></Avatar>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between"><p className="font-medium truncate">{contact.contactName || contact.contactNumber}</p><span className="text-xs text-muted-foreground">{new Date(contact.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
                             <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                             {contact.unreadCount > 0 && (<div className="flex justify-end mt-1"><Badge className="bg-green-500 text-white">{contact.unreadCount}</Badge></div>)}
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* Coluna do Chat */}
            <div className="lg:col-span-2">
              {selectedContact ? (
                <Card className="neu-card h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary">{getContactInitials(selectedContact.contactName)}</AvatarFallback></Avatar>
                        <div><h3 className="font-semibold">{selectedContact.contactName || selectedContact.contactNumber}</h3><p className="text-sm text-muted-foreground">{selectedContact.contactNumber}</p></div>
                      </div>
                      <div className="flex items-center space-x-2"><Button variant="ghost" size="sm" className="neu-button"><Phone className="w-4 h-4" /></Button><Button variant="ghost" size="sm" className="neu-button"><MoreVertical className="w-4 h-4" /></Button></div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {isLoadingMessages ? (
                           <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2"/> Carregando mensagens...</div>
                        ) : messagesError ? (
                           <div className="p-4 text-center text-destructive"><AlertTriangle className="w-5 h-5 inline-block mr-2"/>Erro ao buscar mensagens.</div>
                        ) : (
                          messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] p-3 rounded-2xl ${ msg.direction === 'outgoing' ? 'bg-primary text-primary-foreground' : 'neu-card-inset' }`}>
                                <p className="text-sm">{msg.message}</p>
                                <div className="flex items-center justify-end space-x-1 mt-1"><span className="text-xs opacity-70">{new Date(msg.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>{msg.direction === 'outgoing' && <Check className="w-4 h-4 text-gray-400" /> }</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    <div className="border-t p-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="neu-button"><Paperclip className="w-4 h-4" /></Button>
                        <div className="flex-1 relative"><Textarea placeholder="Digite sua mensagem..." value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} onKeyPress={handleChatKeyPress} className="neu-input min-h-[40px] max-h-[100px] resize-none" rows={1}/></div>
                        <Button variant="ghost" size="sm" className="neu-button"><Smile className="w-4 h-4" /></Button>
                        <Button onClick={sendChatMessage} disabled={!currentChatMessage.trim() || sendMessageMutation.isPending} className="neu-button">
                          {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="neu-card h-full flex items-center justify-center">
                  <div className="text-center"><MsgIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">Selecione uma conversa</h3><p className="text-muted-foreground">Escolha um contato para começar a conversar</p></div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
            {/* ... (Cole aqui o JSX da sua aba 'Fluxos Salvos') ... */}
        </TabsContent>

        <TabsContent value="flow-builder" className="space-y-0 h-[calc(100vh-200px)]">
          <ReactFlowProvider> 
            <TooltipProvider>
              {/* ... (Cole aqui o JSX da sua aba 'Editor Visual' com FlowEditorInner) ... */}
            </TooltipProvider>
          </ReactFlowProvider>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {/* ... (Conteúdo da aba Templates) ... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WhatsApp;
