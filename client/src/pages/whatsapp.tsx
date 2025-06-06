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
    AllNodeDataTypes,
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import WhatsAppConnection from '@/components/whatsapp-connection';
import { Campaign as CampaignType } from '@shared/schema';

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

// CADA COMPONENTE DE NÓ É UMA FUNÇÃO INDEPENDENTE
function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { /* ... (código completo do nó aqui) ... */ }
function ButtonMessageNode({ id, data }: NodeProps<ButtonMessageNodeData>) { /* ... (código completo do nó aqui) ... */ }
function ImageNode({ id, data }: NodeProps<ImageNodeData>) { /* ... (código completo do nó aqui) ... */ }
function AudioMessageNode({ id, data }: NodeProps<AudioNodeData>) { /* ... */ }
function FileMessageNode({ id, data }: NodeProps<FileNodeData>) { /* ... */ }
function LocationMessageNode({ id, data }: NodeProps<LocationNodeData>) { /* ... */ }
function ListMessageNode({ id, data }: NodeProps<ListMessageNodeData>) { /* ... */ }
function DelayNode({ id, data }: NodeProps<DelayNodeData>) { /* ... */ }
function WaitInputNode({ id, data }: NodeProps<WaitInputNodeData>) { /* ... */ }
function SetVariableNode({ id, data }: NodeProps<SetVariableNodeData>) { /* ... */ }
function ConditionNode({ id, data }: NodeProps<ConditionNodeData>) { /* ... */ }
function TimeConditionNode({ id, data }: NodeProps<TimeConditionNodeData>) { /* ... */ }
function LoopNode({ id, data }: NodeProps<LoopNodeData>) { /* ... */ }
function ApiCallNode({ id, data }: NodeProps<ApiCallNodeData>) { /* ... */ }
function WebhookCallNode({ id, data }: NodeProps<WebhookCallNodeData>) { /* ... */ }
function GPTQueryNode({ id, data }: NodeProps<GPTQueryNodeData>) { /* ... */ }
function TagContactNode({ id, data }: NodeProps<TagContactNodeData>) { /* ... */ }
function GoToFlowNode({ id, data }: NodeProps<GoToFlowNodeData>) { /* ... */ }
function AssignAgentNode({ id, data }: NodeProps<AssignAgentNodeData>) { /* ... */ }
function EndFlowNode({ id, data }: NodeProps<EndFlowNodeData>) { /* ... */ }

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
    const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeDataTypes>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowInstance = useReactFlow();
    const { toast } = useToast();
    
    const [flowNameInput, setFlowNameInput] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('none');
    
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<FlowNodeContextMenuProps | null>(null);

    const nodeTypes = useMemo(() => ({
        textMessage: TextMessageNode, buttonMessage: ButtonMessageNode, imageMessage: ImageNode, audioMessage: AudioMessageNode, fileMessage: FileMessageNode, locationMessage: LocationMessageNode, listMessage: ListMessageNode, delay: DelayNode, waitInput: WaitInputNode, setVariable: SetVariableNode, condition: ConditionNode, timeCondition: TimeConditionNode, loopNode: LoopNode, apiCall: ApiCallNode, webhookCall: WebhookCallNode, gptQuery: GPTQueryNode, tagContact: TagContactNode, goToFlow: GoToFlowNode, assignAgent: AssignAgentNode, endFlow: EndFlowNode,
    }), []);

    useEffect(() => {
        if (activeFlow) {
            setFlowNameInput(activeFlow.name);
            setSelectedCampaignId(String(activeFlow.campaignId || 'none'));
            const flowElements = activeFlow.elements || { nodes: [], edges: [] };
            setNodes(flowElements.nodes.map(n => ({ ...n, dragHandle: '.node-header' })));
            setEdges(flowElements.edges);
            setTimeout(() => reactFlowInstance.fitView({ duration: 200, padding: 0.2 }), 100);
        } else {
            setNodes([]); setEdges([]); setFlowNameInput(''); setSelectedCampaignId('none');
        }
    }, [activeFlow, setNodes, setEdges, reactFlowInstance]);

    const handleSave = () => {
        if (!flowNameInput.trim()) { toast({ title: 'Nome Obrigatório', variant: 'destructive' }); return; }
        const currentNodesToSave = nodes.map(({ dragHandle, selected, ...node }) => node);
        const currentEdgesToSave = edges.map(({ selected, ...edge }) => edge);
        onSave({
            name: flowNameInput.trim(),
            status: activeFlow?.status || 'draft',
            campaignId: selectedCampaignId === 'none' ? null : Number(selectedCampaignId),
            elements: { nodes: currentNodesToSave, edges: currentEdgesToSave }
        });
    };

    const handleToggleStatus = () => {
      if (!activeFlow) return;
      onToggleStatus(activeFlow.status === 'active' ? 'inactive' : 'active');
    };
    
    const addNodeToFlow = useCallback((type: keyof typeof nodeTypes) => { /* ... (lógica de addNodeToFlow completa) ... */ }, [reactFlowInstance, activeFlow, toast, nodeTypes, setNodes]);
    const onConnect: OnConnect = useCallback((connection) => { /* ... */ }, [setEdges, reactFlowInstance]);
    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => { /* ... */ }, []);
    const handlePaneClick = useCallback(() => setContextMenu(null), []);
    const handleDeleteNode = useCallback((nodeId: string) => { /* ... */ }, [setNodes, setEdges]);
    const handleDuplicateNode = useCallback((nodeId: string) => { /* ... */ }, [reactFlowInstance]);

    if (!activeFlow) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background/70">
                <div className="text-center text-muted-foreground">
                    <Workflow className="mx-auto h-12 w-12" />
                    <p className="mt-2">Selecione ou crie um fluxo na aba "Fluxos Salvos" para começar.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-row h-full min-h-0">
            <div className={cn("w-52 p-2.5 flex-shrink-0 flex flex-col space-y-1.5 border-r overflow-y-auto", baseCardStyle)}>
                <h3 className="text-sm font-semibold text-center text-white border-b border-[rgba(30,144,255,0.2)] pb-1.5 mb-1.5 sticky top-0 z-10" style={{ textShadow: `0 0 5px ${NEON_COLOR}`, background: 'hsl(var(--card))' }}> Adicionar Etapa </h3>
                {Object.entries(nodeTypes).map(([type, NodeComponent]) => {
                    let icon = HelpCircle; let name = type;
                    // ... (lógica completa de ícones e nomes aqui, como na sua versão anterior) ...
                    return ( <Button key={type} className={cn(baseButtonSelectStyle, "node-add-button justify-start text-xs")} onClick={() => addNodeToFlow(type as keyof typeof nodeTypes)} disabled={isLoading}> <IconWithGlow icon={icon} className="mr-1.5 h-3.5 w-3.5" color={NEON_COLOR}/> {name} </Button> );
                })}
            </div>
            <div className="flex-grow flex flex-col bg-background/70">
                <div className={cn("flex items-center justify-between p-2 border-b flex-shrink-0 gap-2", baseCardStyle)}>
                    <div className="flex items-center gap-1.5 flex-grow">
                        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={isLoading}>
                            <SelectTrigger className={cn(baseButtonSelectStyle, "w-[160px] h-8 text-xs")}><SelectValue placeholder="Vincular..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sem Campanha</SelectItem>
                                {campaignList.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Input value={flowNameInput} onChange={(e) => setFlowNameInput(e.target.value)} placeholder="Nome do Fluxo" className={cn(baseInputInsetStyle, "h-8 text-xs")} disabled={isLoading} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button onClick={handleToggleStatus} variant="ghost" size="icon" disabled={isLoading}>{activeFlow.status === 'active' ? <Square className="w-4 h-4 text-red-400"/> : <Play className="w-4 h-4 text-green-400"/>}</Button>
                        <Button onClick={handleSave} variant="ghost" size="icon" disabled={isLoading || !flowNameInput.trim()}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
                    </div>
                </div>
                <div className="flex-grow relative h-full" ref={reactFlowWrapper}>
                    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView={nodes.length === 0} proOptions={{ hideAttribution: true }} onNodeContextMenu={handleNodeContextMenu} onPaneClick={handlePaneClick}>
                        <Controls className={cn(baseButtonSelectStyle)} />
                        <MiniMap className={cn(baseCardStyle)} />
                        <Background variant={BackgroundVariant.Dots} />
                        {contextMenu && <NodeContextMenuComponent {...contextMenu} onClose={handlePaneClick} onDelete={handleDeleteNode} onDuplicate={handleDuplicateNode} />}
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
const WhatsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('flows');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

  const { data: campaignList = [] } = useQuery<CampaignSelectItem[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) throw new Error('Falha ao buscar campanhas');
      const data: CampaignType[] = await response.json();
      return data.map(c => ({ id: String(c.id), name: c.name }));
    },
    enabled: !!auth.isAuthenticated,
  });

  const { data: flowsList = [], isLoading: isLoadingFlows } = useQuery<FlowData[]>({
    queryKey: ['flows'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/flows');
      if (!response.ok) throw new Error('Falha ao buscar fluxos');
      return await response.json();
    },
    enabled: !!auth.isAuthenticated,
    onSuccess: (data) => {
      if (data && data.length > 0 && !activeFlowId) {
        setActiveFlowId(String(data[0].id));
      }
    }
  });

  const activeFlow = useMemo(() => {
    if (!activeFlowId) return null;
    return flowsList.find(f => String(f.id) === activeFlowId) || null;
  }, [flowsList, activeFlowId]);

  const mutationOptions = {
    onSuccess: () => {
      toast({ title: "Operação realizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
    onError: (error: any) => {
      toast({ title: "Erro na Operação", description: error.message, variant: "destructive" });
    },
  };
  
  const updateFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('PUT', `/api/flows?id=${activeFlowId}`, data), ...mutationOptions });
  const createFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('POST', '/api/flows', data), ...mutationOptions, onSuccess: (newFlow: FlowData) => { mutationOptions.onSuccess(); setActiveFlowId(String(newFlow.id)); setActiveTab('flow-builder'); } });
  const deleteFlowMutation = useMutation({ mutationFn: (id: string) => apiRequest('DELETE', `/api/flows?id=${id}`), ...mutationOptions, onSuccess: () => { mutationOptions.onSuccess(); setActiveFlowId(null); } });
  
  const handleCreateFlow = () => { const name = prompt("Nome do novo fluxo:", "Novo Fluxo"); if (name) createFlowMutation.mutate({ name, status: 'draft', elements: {nodes:[], edges:[]} }); };
  const handleDeleteFlow = (id: string) => { if (window.confirm("Tem certeza?")) deleteFlowMutation.mutate(id); };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-3xl font-bold tracking-tight">WhatsApp Business</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connection">Conectar</TabsTrigger>
          <TabsTrigger value="flows">Fluxos Salvos</TabsTrigger>
          <TabsTrigger value="flow-builder">Editor Visual</TabsTrigger>
        </TabsList>
        <TabsContent value="connection"><WhatsAppConnection /></TabsContent>
        <TabsContent value="flows">
          <Card>
            <CardHeader><Button onClick={handleCreateFlow} disabled={createFlowMutation.isPending}><Plus className="mr-2 h-4 w-4"/>Novo Fluxo</Button></CardHeader>
            <CardContent>
                {isLoadingFlows ? <div className="text-center py-4"><Loader2 className="animate-spin" /></div> : 
                <div className="space-y-2">{flowsList.map(flow => (
                    <div key={flow.id} onClick={() => {setActiveFlowId(String(flow.id)); setActiveTab('flow-builder');}} className={cn("p-3 rounded-md cursor-pointer border", activeFlowId === String(flow.id) ? "border-primary bg-muted" : "hover:bg-muted/50")}>
                        <div className="flex justify-between items-center"><p className="font-semibold">{flow.name}</p><Button variant="ghost" size="icon" className="h-7 w-7" disabled={deleteFlowMutation.isPending} onClick={(e)=>{e.stopPropagation(); handleDeleteFlow(String(flow.id))}}><IconTrash className="w-4 h-4 text-destructive"/></Button></div>
                        <Badge variant={flow.status === 'active' ? 'default' : 'secondary'}>{flow.status}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">{campaignList.find(c => c.id === String(flow.campaignId))?.name || "Sem campanha"}</p>
                    </div>
                ))}</div>}
            </CardContent>
          </Card>
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
