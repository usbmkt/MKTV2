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
    MessageSquare, ListChecks, Trash2 as IconTrash, Image as ImageIcon, Clock, Variable, Waypoints, HelpCircle, Settings, Plus, RefreshCw, Send, RadioTower, UserCheck, LogOut, Save, Play, Square, Filter as FilterIcon, Layers, Activity, Workflow, Target, Mic, FileText as FileIcon, MapPin, Repeat, Webhook, Sparkles, X, AlertTriangle, Bot, FileTerminal, Clock10, Tag, Shuffle,
    MessageCircle as MsgIcon, Phone, Search, MoreVertical, Check, CheckCheck, Paperclip, Smile, Users, TrendingUp,
    Loader2
} from 'lucide-react';
import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Node, Edge, OnConnect, BackgroundVariant, MarkerType, Position, Handle, NodeProps, useReactFlow, ReactFlowProvider, NodeOrigin, Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    FlowData, CampaignSelectItem, NodeContextMenuProps as FlowNodeContextMenuProps, ButtonOption, ListItem, ListSection,
    GPTQueryNodeData, TextMessageNodeData, ButtonMessageNodeData, ImageNodeData, AudioNodeData, FileNodeData, LocationNodeData, ListMessageNodeData, DelayNodeData, WaitInputNodeData, SetVariableNodeData, ConditionNodeData, TimeConditionNodeData, LoopNodeData, ApiCallNodeData, WebhookCallNodeData, AIAgentNodeData, AssignAgentNodeData, EndFlowNodeData, GoToFlowNodeData, TagContactNodeData,
    AllNodeDataTypes
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import WhatsAppConnection from '@/components/whatsapp-connection';
import { Campaign as CampaignType, WhatsappMessage as WhatsappMessageType } from '@shared/schema';

// --- TIPOS REAIS ---
interface Contact {
  contactNumber: string;
  contactName: string | null;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
}

// --- COMPONENTES DE NÓ (MOVIMOVOS PARA FORA) ---
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

function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { /* Implementação completa... */ }
function ButtonMessageNode({ id, data }: NodeProps<ButtonMessageNodeData>) { /* Implementação completa... */ }
function ImageNode({ id, data }: NodeProps<ImageNodeData>) { /* Implementação completa... */ }
// ... todos os outros componentes de nó ...
function EndFlowNode({ id, data }: NodeProps<EndFlowNodeData>) { /* Implementação completa... */ }

const globalNodeOrigin: NodeOrigin = [0.5, 0.5];

// --- COMPONENTE INTERNO DO EDITOR DE FLUXO (FORA DO WHATSAPP) ---
interface FlowEditorInnerProps {
  activeFlow?: FlowData | null;
  campaignList: CampaignSelectItem[];
  onSave: (flowData: { name: string; status: 'active' | 'inactive' | 'draft'; campaignId: number | null; elements: { nodes: Node<AllNodeDataTypes>[]; edges: Edge[] } }) => Promise<any>;
  onToggleStatus: (newStatus: 'active' | 'inactive') => void;
  isLoading: boolean;
}

function FlowEditorInner({ activeFlow, campaignList, onSave, onToggleStatus, isLoading }: FlowEditorInnerProps) {
    // ... (Código completo do FlowEditorInner, sem alterações em relação à versão anterior)
    // ...
    return (
        <div className="flex flex-row h-full min-h-0">
             {/* ... JSX completo do FlowEditorInner ... */}
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
const WhatsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('flows');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  
  // Estados para a aba de Fluxos
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  
  // Estados para a aba de Conversas
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [searchTermContacts, setSearchTermContacts] = useState('');

  // --- QUERIES E MUTAÇÕES PARA FLUXOS ---
  const { data: campaignList = [] } = useQuery<CampaignSelectItem[]>({ queryKey: ['campaigns'], queryFn: async () => { const res = await apiRequest('GET', '/api/campaigns'); if (!res.ok) throw new Error('Falha ao buscar campanhas'); const data: CampaignType[] = await res.json(); return data.map(c => ({ id: String(c.id), name: c.name })); }, enabled: !!auth.isAuthenticated, });
  const { data: flowsList = [], isLoading: isLoadingFlows } = useQuery<FlowData[]>({ queryKey: ['flows'], queryFn: async () => { const res = await apiRequest('GET', '/api/flows'); if (!res.ok) throw new Error('Falha ao buscar fluxos'); return await res.json(); }, enabled: !!auth.isAuthenticated, onSuccess: (data) => { if (data && data.length > 0 && !activeFlowId) setActiveFlowId(String(data[0].id)); } });
  const activeFlow = useMemo(() => activeFlowId ? flowsList.find(f => String(f.id) === activeFlowId) || null : null, [flowsList, activeFlowId]);
  const mutationOptions = { onSuccess: () => { toast({ title: "Operação realizada com sucesso!" }); queryClient.invalidateQueries({ queryKey: ['flows'] }); }, onError: (error: any) => toast({ title: "Erro na Operação", description: error.message, variant: "destructive" }) };
  const updateFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('PUT', `/api/flows?id=${activeFlowId}`, data), ...mutationOptions });
  const createFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('POST', '/api/flows', data), ...mutationOptions, onSuccess: (newFlow: FlowData) => { mutationOptions.onSuccess(); setActiveFlowId(String(newFlow.id)); setActiveTab('flow-builder'); } });
  const deleteFlowMutation = useMutation({ mutationFn: (id: string) => apiRequest('DELETE', `/api/flows?id=${id}`), ...mutationOptions, onSuccess: () => { mutationOptions.onSuccess(); setActiveFlowId(null); } });
  const handleCreateFlow = () => { const name = prompt("Nome do novo fluxo:", "Novo Fluxo"); if (name) createFlowMutation.mutate({ name, status: 'draft', elements: {nodes:[], edges:[]} }); };
  const handleDeleteFlow = (id: string) => { if (window.confirm("Tem certeza?")) deleteFlowMutation.mutate(id); };

  // --- QUERIES E MUTAÇÕES PARA CONVERSAS ---
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({ queryKey: ['whatsappContacts'], queryFn: async () => (await apiRequest('GET', '/api/whatsapp/contacts')).json(), enabled: activeTab === 'conversations' && !!auth.isAuthenticated });
  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useQuery<WhatsappMessageType[]>({ queryKey: ['whatsappMessages', selectedContact?.contactNumber], queryFn: async () => { if (!selectedContact) return []; return (await apiRequest('GET', `/api/whatsapp/messages?contactNumber=${selectedContact.contactNumber}`)).json(); }, enabled: !!selectedContact });
  const sendMessageMutation = useMutation({ mutationFn: (data: { contactNumber: string; message: string; }) => apiRequest('POST', '/api/whatsapp/messages', {...data, direction: 'outgoing'}), onSuccess: () => refetchMessages() });
  const handleSelectContact = (contact: Contact) => setSelectedContact(contact);
  const filteredContacts = useMemo(() => contacts.filter(c => (c.contactName || '').toLowerCase().includes(searchTermContacts.toLowerCase()) || c.contactNumber.includes(searchTermContacts)), [contacts, searchTermContacts]);
  const getContactInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '#';
  const getMessageStatus = (status?: string) => { /* ... */ };
  const sendChatMessage = () => { if (currentChatMessage.trim() && selectedContact) { sendMessageMutation.mutate({ contactNumber: selectedContact.contactNumber, message: currentChatMessage.trim() }); setCurrentChatMessage(''); } };
  const handleChatKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-3xl font-bold tracking-tight">WhatsApp Business</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connection">Conectar</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="flows">Fluxos Salvos</TabsTrigger>
          <TabsTrigger value="flow-builder">Editor Visual</TabsTrigger>
        </TabsList>
        <TabsContent value="connection"><WhatsAppConnection /></TabsContent>
        
        {/* ABA DE CONVERSAS COM DADOS REAIS */}
        <TabsContent value="conversations">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
                <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                        <Input placeholder="Buscar contatos..." value={searchTermContacts} onChange={(e) => setSearchTermContacts(e.target.value)} />
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[calc(100vh-380px)]">
                            {isLoadingContacts ? <div className="p-4 text-center"><Loader2 className="animate-spin" /></div> :
                            filteredContacts.map((contact) => (
                                <div key={contact.contactNumber} className={`p-4 cursor-pointer border-b ${selectedContact?.contactNumber === contact.contactNumber ? 'bg-accent' : ''}`} onClick={() => handleSelectContact(contact)}>
                                    <div className="flex items-center space-x-3">
                                        <Avatar><AvatarFallback>{getContactInitials(contact.contactName)}</AvatarFallback></Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{contact.contactName || contact.contactNumber}</p>
                                            <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                                        </div>
                                        {contact.unreadCount > 0 && <Badge>{contact.unreadCount}</Badge>}
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>
                <div className="lg:col-span-2 flex flex-col">
                    {selectedContact ? (
                        <Card className="flex-1 flex flex-col">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>{selectedContact.contactName || selectedContact.contactNumber}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => refetchMessages()}><RefreshCw className="h-4 w-4"/></Button>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                <ScrollArea className="h-[calc(100vh-450px)] p-4">
                                    {isLoadingMessages ? <div className="text-center"><Loader2 className="animate-spin" /></div> :
                                    messages.map((msg) => (
                                        <div key={msg.id} className={`flex my-2 ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg ${msg.direction === 'outgoing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <p>{msg.message}</p>
                                                <span className="text-xs opacity-70 block text-right mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </CardContent>
                            <div className="border-t p-4">
                                <form onSubmit={(e) => {e.preventDefault(); sendChatMessage();}} className="flex items-center space-x-2">
                                    <Input placeholder="Digite sua mensagem..." value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} />
                                    <Button type="submit" disabled={sendMessageMutation.isPending}><Send className="h-4 w-4" /></Button>
                                </form>
                            </div>
                        </Card>
                    ) : (
                        <Card className="flex-1 flex items-center justify-center"><p>Selecione um contato para ver as mensagens.</p></Card>
                    )}
                </div>
            </div>
        </TabsContent>

        {/* ABA DE FLUXOS (sem alterações) */}
        <TabsContent value="flows">
            {/* ... JSX da aba de fluxos permanece igual ... */}
        </TabsContent>
        <TabsContent value="flow-builder" className="h-[calc(100vh-250px)]">
          <ReactFlowProvider>
            <FlowEditorInner 
              activeFlow={activeFlow} 
              campaignList={campaignList} 
              onSave={(data) => updateFlowMutation.mutateAsync(data)} 
              onToggleStatus={(status) => updateFlowMutation.mutateAsync({ status })}
              isLoading={updateFlowMutation.isPending}
            />
          </ReactFlowProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WhatsApp;
