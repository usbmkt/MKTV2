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
    MessageSquare, ListChecks, Trash2 as IconTrash, Image as ImageIcon, Clock, Variable, Waypoints, HelpCircle, Settings, Plus, RefreshCw, Send, RadioTower, UserCheck, LogOut, Save, Play, Square, Filter as FilterIcon, Layers, Activity, Workflow, Target, Mic, FileText as FileIcon, MapPin, Repeat, Webhook, Sparkles, ArrowLeft, X, AlertTriangle, Bot, FileTerminal, Clock10, Tag, Shuffle,
    MessageCircle as MsgIcon, Phone, Search, MoreVertical, Check, CheckCheck, Paperclip, Smile, Users, TrendingUp, Download, Upload,
    Loader2
} from 'lucide-react';

import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Node, Edge, OnConnect, BackgroundVariant, MarkerType, Position, Handle, NodeProps, useReactFlow, ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    FlowData,
    CampaignSelectItem,
    NodeContextMenuProps as FlowNodeContextMenuProps,
    ButtonOption,
    ListItem,
    ListSection,
    GPTQueryNodeData,
    TextMessageNodeData,
    ButtonMessageNodeData,
    ImageNodeData,
    AudioNodeData,
    FileNodeData,
    LocationNodeData,
    ListMessageNodeData,
    DelayNodeData,
    WaitInputNodeData,
    SetVariableNodeData,
    ConditionNodeData,
    TimeConditionNodeData,
    LoopNodeData,
    ApiCallNodeData,
    WebhookCallNodeData,
    AIAgentNodeData,
    AssignAgentNodeData,
    EndFlowNodeData,
    GoToFlowNodeData,
    TagContactNodeData,
    AllNodeDataTypes,
    Campaign as CampaignType // Importando o tipo Campaign
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import WhatsAppConnection from '@/components/whatsapp-connection';


// --- MOCKS E TIPOS LOCAIS (Para a aba de conversas) ---
interface WhatsAppMessage { id: number; contactNumber: string; contactName?: string; message: string; direction: 'incoming' | 'outgoing'; timestamp: string; isRead: boolean; messageType: 'text' | 'image' | 'document' | 'audio' | 'template'; status?: 'sent' | 'delivered' | 'read' | 'failed'; }
interface Contact { contactNumber: string; contactName: string; lastMessage: string; timestamp: Date; unreadCount?: number; tags?: string[]; isBot?: boolean; }


// --- COMPONENTES DE NÓ (Inalterados) ---
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

function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const updateNodeData = (newText: string) => { setText(newText); setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text: newText } } : n)); }; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES} /> <CardHeader className={NODE_HEADER_CLASSES}> <div className="flex items-center text-xs"><IconWithGlow icon={MessageSquare} className="mr-1.5 h-3.5 w-3.5"/> Mensagem de Texto</div> </CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeTextarea value={text} onChange={(e) => updateNodeData(e.target.value)} placeholder="Digite sua mensagem aqui..." /> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
// ... (outros componentes de Nó, mantidos como antes para brevidade) ...
function ButtonMessageNode({ id, data }: NodeProps<ButtonMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const [footer, setFooter] = useState(data?.footer || ''); const [buttons, setButtons] = useState<ButtonOption[]>(data?.buttons || [{ id: `btn_${id.slice(-4)}_${Date.now()%10000}`, text: 'Opção 1' }]); const updateNodeData = (field: string, value: any) => { setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); }; const handleButtonTextChange = (buttonId: string, newText: string) => { const newButtons = buttons.map(b => b.id === buttonId ? { ...b, text: newText } : b); setButtons(newButtons); updateNodeData('buttons', newButtons); }; const addButton = () => { if (buttons.length >= 3) return; const newButtonId = `btn_${id.slice(-4)}_${Date.now()%10000}_${buttons.length}`; const newButtons = [...buttons, { id: newButtonId, text: `Nova Opção ${buttons.length + 1}` }]; setButtons(newButtons); updateNodeData('buttons', newButtons); }; const removeButton = (buttonId: string) => { const newButtons = buttons.filter(b => b.id !== buttonId); setButtons(newButtons); updateNodeData('buttons', newButtons); }; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5"/> Mensagem com Botões</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Texto Principal</NodeLabel> <NodeTextarea value={text} onChange={(e) => {setText(e.target.value); updateNodeData('text', e.target.value)}} placeholder="Mensagem principal..."/> <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel> <NodeInput value={footer} onChange={(e) => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}} placeholder="Texto do rodapé..."/> <NodeLabel className="mt-1">Botões ({buttons.length}/3 max)</NodeLabel> <div className={cn('space-y-1 max-h-28 overflow-y-auto pr-1', customScrollbarStyle)}> {buttons.map((button, index) => ( <div key={button.id} className='relative group flex items-center gap-1'> <NodeInput value={button.text} onChange={(e) => handleButtonTextChange(button.id, e.target.value)} placeholder={`Texto Botão ${index+1}`} className='flex-grow'/> <Handle type="source" position={Position.Right} id={button.id} style={{ top: `${20 + index * 28}px`, right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-teal-600')} title={button.text || `Saída ${index+1}`} isConnectable={true}/> <Button onClick={() => removeButton(button.id)} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}><X className='w-3 h-3'/></Button> </div> ))} </div> {buttons.length < 3 && <NodeButton onClick={addButton} className="mt-1.5"><Plus className="mr-1 h-3 w-3"/> Adicionar Botão</NodeButton>} </CardContent> </Card> ); }
function EndFlowNode({ id, data }: NodeProps<EndFlowNodeData>) { const { setNodes } = useReactFlow(); const [reason, setReason] = useState(data?.reason || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48 !border-red-500/50")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={cn(NODE_HEADER_CLASSES, "!text-red-400")}><div className="flex items-center text-xs"><IconWithGlow icon={LogOut} className="mr-1.5 h-3.5 w-3.5" color={NEON_RED}/> Encerrar Fluxo</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Motivo do Encerramento (Opcional)</NodeLabel> <NodeInput value={reason} onChange={e => {setReason(e.target.value); update('reason', e.target.value)}} placeholder="Ex: Cliente satisfeito"/> </CardContent> </Card> );}
const globalNodeOrigin: [number, number] = [0.5, 0.5];

// --- COMPONENTE INTERNO DO EDITOR DE FLUXO ---
interface FlowEditorInnerProps {
  activeFlowId?: string | null;
  campaignList: CampaignSelectItem[]; // Recebe a lista de campanhas como prop
}

function FlowEditorInner({ activeFlowId, campaignList }: FlowEditorInnerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeDataTypes>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowInstance = useReactFlow<AllNodeDataTypes, any>();
    const { toast } = useToast();
    const queryClientInternal = useQueryClient();
    const authStore = useAuthStore();

    const [selectedFlow, setSelectedFlow] = useState<FlowData | null>(null);
    const [flowNameInput, setFlowNameInput] = useState('');
    const [selectedCampaignIdForFlow, setSelectedCampaignIdForFlow] = useState<string | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<FlowNodeContextMenuProps | null>(null);
    const [isLoadingFlowDetails, setIsLoadingFlowDetails] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    const nodeTypes = useMemo(() => ({
        textMessage: TextMessageNode,
        buttonMessage: ButtonMessageNode,
        // ... (resto dos tipos de nó)
        endFlow: EndFlowNode,
    }), []);
    
    // Efeito para carregar os detalhes de um fluxo quando o ID ativo muda
    useEffect(() => {
      const loadFullFlowData = async () => {
          if (activeFlowId && authStore.isAuthenticated) {
              setIsLoadingFlowDetails(true);
              setContextMenu(null);
              try {
                  const response = await apiRequest('GET', `/api/flows?id=${activeFlowId}`);
                  if (!response.ok) {
                      throw new Error(`Falha ao carregar fluxo (status ${response.status})`);
                  }
                  const flowDetails: FlowData = await response.json();
                  console.log(`[DEBUG loadFullFlowData] Flow ID: ${activeFlowId} - Detalhes completos recebidos da API:`, JSON.stringify(flowDetails, null, 2));

                  setSelectedFlow(flowDetails);
                  setFlowNameInput(flowDetails.name);
                  setSelectedCampaignIdForFlow(String(flowDetails.campaign_id || 'none'));
                  
                  const flowElements = flowDetails.elements || { nodes: [], edges: [] };
                  setNodes(flowElements.nodes.map(n => ({ ...n, dragHandle: '.node-header' })));
                  setEdges(flowElements.edges);

                  setTimeout(() => reactFlowInstance.fitView({ duration: 300, padding: 0.2 }), 100);
              } catch (error: any) {
                  toast({ title: "Erro ao Carregar Fluxo", description: error.message, variant: "destructive" });
                  setSelectedFlow(null); setNodes([]); setEdges([]);
              } finally {
                  setIsLoadingFlowDetails(false);
              }
          } else {
              // Limpa o editor se nenhum fluxo estiver selecionado
              setSelectedFlow(null); setFlowNameInput(''); setSelectedCampaignIdForFlow(null); setNodes([]); setEdges([]);
          }
      };
      loadFullFlowData();
    }, [activeFlowId, authStore.isAuthenticated, reactFlowInstance, setNodes, setEdges, toast]);

    // CORREÇÃO AQUI: Usar os estados 'nodes' e 'edges' diretamente, que são a fonte da verdade.
    const saveFlow = useCallback(async () => {
      if (!selectedFlow || !flowNameInput.trim() || !authStore.isAuthenticated) {
        toast({ title: "Atenção", description: "Nome do fluxo é obrigatório e um fluxo deve estar selecionado.", variant: "default" });
        return;
      }
      setIsSaving(true);
      try {
          const currentNodesToSave = nodes.map(({ dragHandle, selected, ...node }) => node);
          const currentEdgesToSave = edges.map(({ selected, ...edge }) => edge);

          const campaignIdToSend = selectedCampaignIdForFlow === 'none' ? null : selectedCampaignIdForFlow;

          const flowToSave = {
              name: flowNameInput.trim(),
              campaign_id: campaignIdToSend ? Number(campaignIdToSend) : null,
              status: selectedFlow.status || 'draft',
              elements: { nodes: currentNodesToSave, edges: currentEdgesToSave }
          };

          const response = await apiRequest('PUT', `/api/flows?id=${selectedFlow.id}`, flowToSave);
          if (!response.ok) {
              const errText = await response.text();
              throw new Error(errText || `Falha ao salvar fluxo (status ${response.status})`);
          }
          const updatedFlow: FlowData = await response.json();
          toast({ title: "Fluxo Salvo com Sucesso!" });
          
          // Atualiza o estado local para garantir consistência visual imediata
          setSelectedFlow(updatedFlow);
          const updatedElements = updatedFlow.elements || { nodes: [], edges: [] };
          setNodes(updatedElements.nodes.map(n => ({ ...n, dragHandle: '.node-header' })));
          setEdges(updatedElements.edges);

          queryClientInternal.invalidateQueries({ queryKey: ['flows'] });
      } catch (error: any) {
        toast({ title: "Erro ao Salvar Fluxo", description: error.message, variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }, [selectedFlow, flowNameInput, selectedCampaignIdForFlow, authStore.isAuthenticated, queryClientInternal, toast, nodes, edges, setNodes, setEdges]);
    
    // ... (restante das funções: toggleFlowStatus, onConnect, addNodeToFlow, etc., mantidas como antes) ...

    return (
        <div className="flex flex-row h-full min-h-0">
            {/* ... (código da barra lateral de nós e cabeçalho do editor inalterado) ... */}
            <div className="flex-grow flex flex-col bg-background/70 dark:bg-background/90 min-w-0">
                {/* ... (Cabeçalho do Editor com Nome do Fluxo e Select de Campanha) ... */}
                 <div className={cn("flex items-center justify-between p-2 border-b flex-shrink-0 gap-2", baseCardStyle, 'rounded-none border-b-[rgba(30,144,255,0.2)] relative z-10')}>
                    <div className="flex items-center gap-1.5 flex-grow">
                        {selectedFlow && !isLoadingFlowDetails && (
                            <>
                                <Select 
                                    value={selectedCampaignIdForFlow || 'none'} 
                                    onValueChange={(v) => setSelectedCampaignIdForFlow(v === 'none' ? null : v)} 
                                >
                                    <SelectTrigger className={cn(baseButtonSelectStyle, "w-[160px] h-8 px-2 text-xs rounded")}>
                                        <Layers className='h-3 w-3 mr-1.5 text-gray-400' style={{ filter: `drop-shadow(0 0 3px ${NEON_COLOR}50)` }}/>
                                        <SelectValue placeholder="Vincular Campanha..." />
                                    </SelectTrigger>
                                    <SelectContent className={cn(popoverContentStyle)}>
                                        <SelectItem value="none">Sem Campanha</SelectItem>
                                        {Array.isArray(campaignList) && campaignList.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <Input value={flowNameInput} onChange={(e) => setFlowNameInput(e.target.value)} placeholder="Nome do Fluxo" className={cn(baseInputInsetStyle, "h-8 text-xs w-[180px] rounded px-2")} />
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button onClick={saveFlow} variant="ghost" size="icon" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                </div>
                {/* ... (Resto do JSX do FlowEditorInner) ... */}
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
interface WhatsAppPageActualProps {}

const WhatsApp: React.FC<WhatsAppPageActualProps> = () => {
  const [activeTab, setActiveTab] = useState('connection');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  
  // CORREÇÃO: O estado da lista de campanhas é gerenciado aqui, no componente pai.
  const [campaignList, setCampaignList] = useState<CampaignSelectItem[]>([]);
  const [filterCampaignIdForList, setFilterCampaignIdForList] = useState<string | 'all' | 'none'>('all');
  const [activeFlowIdForEditor, setActiveFlowIdForEditor] = useState<string | null>(null);

  // --- Mock data para "Conversas" (mantido por enquanto) ---
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [mockContacts] = useState<Contact[]>([ { contactNumber: '+5511999887766', contactName: 'João Silva', lastMessage: 'Olá! Gostaria de saber mais sobre os produtos', timestamp: new Date(Date.now() - 300000), unreadCount: 2, tags: ['Lead', 'Interessado'], isBot: false }, { contactNumber: '+5511888776655', contactName: 'Maria Santos', lastMessage: 'Obrigada pelas informações!', timestamp: new Date(Date.now() - 1800000), unreadCount: 0, tags: ['Cliente'], isBot: false }]);
  
  // CORREÇÃO: Query para buscar campanhas, agora é a única fonte da verdade.
  const { isLoading: isLoadingCampaigns } = useQuery<CampaignSelectItem[]>({
    queryKey: ['campaignsForFlowPage'],
    queryFn: async () => {
      if (!auth.isAuthenticated) return [];
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) throw new Error('Falha ao buscar campanhas');
      const data: CampaignType[] = await response.json();
      const mappedData = data.map(c => ({ id: String(c.id), name: c.name }));
      console.log("[DEBUG WhatsAppPage] Campanhas mapeadas:", mappedData);
      return mappedData;
    },
    enabled: auth.isAuthenticated,
    onSuccess: (data) => {
        console.log("[DEBUG WhatsAppPage] onSuccess, dados para setCampaignList:", data);
        if (Array.isArray(data)) {
            setCampaignList(data);
        } else {
            setCampaignList([]);
        }
    },
    onError: (error: any) => {
      toast({ title: "Erro ao Buscar Campanhas", description: error.message, variant: "destructive" });
      setCampaignList([]);
    }
  });

  const { data: flowsList = [], isLoading: isLoadingFlowsList, error: flowsListError } = useQuery<FlowData[]>({
    queryKey: ['flows', filterCampaignIdForList],
    queryFn: async () => {
      if (!auth.isAuthenticated) return [];
      const params = new URLSearchParams();
      if (filterCampaignIdForList !== 'all') {
        params.append('campaignId', filterCampaignIdForList === 'none' ? 'null' : filterCampaignIdForList);
      }
      const response = await apiRequest('GET', `/api/flows?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao buscar fluxos');
      return response.json();
    },
    enabled: auth.isAuthenticated,
    onSuccess: (data) => {
      // Lógica para selecionar o primeiro fluxo da lista se nenhum estiver ativo
      if (data && data.length > 0 && !activeFlowIdForEditor) {
        setActiveFlowIdForEditor(String(data[0].id));
      }
    }
  });

  // ... (mutações para criar e deletar fluxos, mantidas como antes) ...

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* ... (TabsList inalterada) ... */}

        <TabsContent value="flows" className="space-y-4">
            <Card className="neu-card">
                <CardHeader> {/* ... */} </CardHeader>
                <CardContent>
                    {/* ... (lógica de exibição da lista de fluxos) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {flowsList.map((flow) => (
                            <Card key={flow.id} className={cn("neu-card hover:shadow-primary/20 cursor-pointer", activeFlowIdForEditor === String(flow.id) && "ring-2 ring-primary")}
                                  onClick={() => { setActiveFlowIdForEditor(String(flow.id)); setActiveTab('flow-builder');}}>
                                <CardHeader>
                                    {/* ... */}
                                    <CardDescription>
                                        {/* CORREÇÃO: Usar a lista de campanhas do estado para encontrar o nome */}
                                        {flow.campaign_id ? `Campanha: ${campaignList.find(c => c.id === String(flow.campaign_id))?.name || 'Inválida'}` : 'Sem campanha'}
                                    </CardDescription>
                                </CardHeader>
                                {/* ... */}
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="flow-builder" className="space-y-0 h-[calc(100vh-200px)]">
          <ReactFlowProvider> 
            <TooltipProvider>
              <FlowEditorInner 
                activeFlowId={activeFlowIdForEditor}
                campaignList={campaignList} // Passa a lista de campanhas consolidada
              />
            </TooltipProvider>
          </ReactFlowProvider>
        </TabsContent>
        {/* ... (outras TabsContent) ... */}
      </Tabs>
    </div>
  );
}

export default WhatsApp;
