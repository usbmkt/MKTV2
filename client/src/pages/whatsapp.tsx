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
    MessageSquare, ListChecks, Trash2 as IconTrash, Image as ImageIcon, Clock, Variable, Waypoints, HelpCircle, Settings, Plus, RefreshCw, Send, RadioTower, UserCheck, LogOut, Save, Play, Square, Filter as FilterIcon, Layers, Activity, Workflow, Target, Mic, FileText as FileIcon, MapPin, Repeat, Webhook, Sparkles, AlertTriangle, Bot,
    MessageCircle as MsgIcon, Phone, Search, MoreVertical, Check, CheckCheck, Paperclip, Smile, Users,
    Loader2
} from 'lucide-react';

import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Node, Edge, OnConnect, BackgroundVariant, MarkerType, Position, Handle, NodeProps, useReactFlow, ReactFlowProvider, NodeOrigin
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    FlowData, CampaignSelectItem, NodeContextMenuProps as FlowNodeContextMenuProps, ButtonOption, ListItem, ListSection,
    TextMessageNodeData, AllNodeDataTypes, Campaign as CampaignType
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import WhatsAppConnection from '@/components/whatsapp-connection';

// --- MOCKS E TIPOS LOCAIS ---
interface WhatsAppMessage { id: number; message: string; direction: 'incoming' | 'outgoing'; timestamp: string; status?: 'sent' | 'delivered' | 'read' | 'failed'; }
interface Contact { contactNumber: string; contactName: string; lastMessage: string; timestamp: Date; unreadCount?: number; }
// --- COMPONENTES DE NÓ (Simplificado para brevidade, mantenha suas implementações completas) ---
function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { /* ... (inalterado) ... */ }
function EndFlowNode({ id, data }: NodeProps<any>) { /* ... (inalterado) ... */ }
const globalNodeOrigin: NodeOrigin = [0.5, 0.5];

// --- COMPONENTE INTERNO DO EDITOR DE FLUXO ---
interface FlowEditorInnerProps {
  activeFlow?: FlowData | null;
  campaignList: CampaignSelectItem[];
  onSave: (flowData: { name: string; status: string; campaignId: number | null; elements: { nodes: Node[]; edges: Edge[] } }) => Promise<any>;
  onToggleStatus: (newStatus: 'active' | 'inactive') => void;
  isLoading: boolean;
}

function FlowEditorInner({ activeFlow, campaignList, onSave, onToggleStatus, isLoading }: FlowEditorInnerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeDataTypes>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowInstance = useReactFlow();
    
    const [flowNameInput, setFlowNameInput] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('none');
    
    // Efeito para carregar dados quando um fluxo ativo é passado
    useEffect(() => {
        if (activeFlow) {
            setFlowNameInput(activeFlow.name);
            setSelectedCampaignId(String(activeFlow.campaignId || 'none'));
            const flowElements = activeFlow.elements || { nodes: [], edges: [] };
            setNodes(flowElements.nodes.map(n => ({ ...n, dragHandle: '.node-header' })));
            setEdges(flowElements.edges);
            setTimeout(() => reactFlowInstance.fitView({ duration: 200 }), 50);
        } else {
            setNodes([]);
            setEdges([]);
            setFlowNameInput('');
            setSelectedCampaignId('none');
        }
    }, [activeFlow, setNodes, setEdges, reactFlowInstance]);

    const handleSave = () => {
        if (!flowNameInput.trim()) {
            alert('O nome do fluxo é obrigatório.');
            return;
        }
        onSave({
            name: flowNameInput.trim(),
            status: activeFlow?.status || 'draft',
            campaignId: selectedCampaignId === 'none' ? null : Number(selectedCampaignId),
            elements: { nodes, edges } // Usa diretamente o estado
        });
    };

    const nodeTypes = useMemo(() => ({ textMessage: TextMessageNode, endFlow: EndFlowNode }), []);

    const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b">
                {activeFlow ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Input value={flowNameInput} onChange={(e) => setFlowNameInput(e.target.value)} placeholder="Nome do Fluxo" className="h-8"/>
                            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                                <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Vincular Campanha..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sem Campanha</SelectItem>
                                    {campaignList.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button onClick={() => onToggleStatus(activeFlow.status === 'active' ? 'inactive' : 'active')} variant="outline" size="sm" disabled={isLoading}>
                                {activeFlow.status === 'active' ? <Square className="w-4 h-4 mr-2 text-red-500"/> : <Play className="w-4 h-4 mr-2 text-green-500"/>}
                                {activeFlow.status === 'active' ? 'Desativar' : 'Ativar'}
                             </Button>
                            <Button onClick={handleSave} size="sm" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                <span className="ml-2">Salvar</span>
                            </Button>
                        </div>
                    </>
                ) : <div className="text-sm text-muted-foreground">Selecione um fluxo para editar.</div>}
            </div>
            <ReactFlow
                nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                onConnect={onConnect} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
            >
                <Controls />
                <Background />
            </ReactFlow>
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

    // Query unificada para campanhas
    const { data: campaignList = [], isLoading: isLoadingCampaigns } = useQuery<CampaignSelectItem[]>({
        queryKey: ['campaignsForWhatsAppPage'],
        queryFn: async () => {
            if (!auth.isAuthenticated) return [];
            const response = await apiRequest('GET', '/api/campaigns');
            if (!response.ok) throw new Error('Falha ao buscar campanhas');
            const data: CampaignType[] = await response.json();
            return data.map(c => ({ id: String(c.id), name: c.name }));
        },
        enabled: !!auth.isAuthenticated,
    });

    // Query para a lista de fluxos
    const { data: flowsList = [], isLoading: isLoadingFlows, refetch: refetchFlows } = useQuery<FlowData[]>({
        queryKey: ['flows'],
        queryFn: async () => {
            if (!auth.isAuthenticated) return [];
            const response = await apiRequest('GET', '/api/flows');
            if (!response.ok) throw new Error('Falha ao buscar fluxos');
            return response.json();
        },
        enabled: !!auth.isAuthenticated,
        onSuccess: (data) => {
            if (data && data.length > 0 && !activeFlowId) {
                setActiveFlowId(String(data[0].id));
            }
        }
    });

    // Encontra o fluxo ativo com base no ID
    const activeFlow = useMemo(() => flowsList.find(f => String(f.id) === activeFlowId), [flowsList, activeFlowId]);

    // Mutações
    const updateFlowMutation = useMutation({
        mutationFn: (flowData: any) => apiRequest('PUT', `/api/flows?id=${activeFlowId}`, flowData),
        onSuccess: () => {
            toast({ title: "Fluxo salvo com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ['flows'] });
        },
        onError: (error: any) => toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    });

    const createFlowMutation = useMutation({
        mutationFn: (flowData: { name: string, campaign_id: number | null }) => apiRequest('POST', '/api/flows', flowData),
        onSuccess: (newFlow: FlowData) => {
            toast({ title: "Fluxo criado!" });
            queryClient.invalidateQueries({ queryKey: ['flows'] });
            setActiveFlowId(String(newFlow.id));
            setActiveTab('flow-builder');
        },
        onError: (error: any) => toast({ title: "Erro ao criar fluxo", description: error.message, variant: "destructive" })
    });
    
    // ... (restante da lógica de mock para a aba de conversas)

    return (
        <div className="space-y-6 p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="connection">Conectar</TabsTrigger>
                    <TabsTrigger value="conversations" disabled>Conversas (Mocado)</TabsTrigger>
                    <TabsTrigger value="flows">Fluxos Salvos</TabsTrigger>
                    <TabsTrigger value="flow-builder">Editor Visual</TabsTrigger>
                </TabsList>
                <TabsContent value="connection"><WhatsAppConnection /></TabsContent>
                <TabsContent value="flows">
                    <Card>
                        <CardHeader><Button onClick={() => createFlowMutation.mutate({ name: "Novo Fluxo", campaign_id: null })}><Plus className="mr-2 h-4 w-4"/>Criar Novo Fluxo</Button></CardHeader>
                        <CardContent>
                            {isLoadingFlows ? <Loader2 className="animate-spin"/> :
                            <div className="space-y-2">
                                {flowsList.map(flow => (
                                    <div key={flow.id} onClick={() => {setActiveFlowId(String(flow.id)); setActiveTab('flow-builder');}}
                                        className={cn("p-2 rounded-md cursor-pointer border", activeFlowId === String(flow.id) ? "border-primary bg-muted" : "hover:bg-muted/50")}>
                                        <p className="font-semibold">{flow.name}</p>
                                        <p className="text-sm text-muted-foreground">{campaignList.find(c => c.id === String(flow.campaignId))?.name || "Sem campanha"}</p>
                                    </div>
                                ))}
                            </div>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="flow-builder" className="h-[calc(100vh-200px)]">
                    <ReactFlowProvider>
                        <FlowEditorInner
                            activeFlow={activeFlow}
                            campaignList={campaignList}
                            onSave={(data) => updateFlowMutation.mutate(data)}
                            onToggleStatus={(status) => updateFlowMutation.mutate({ status })}
                            isLoading={updateFlowMutation.isPending}
                        />
                    </ReactFlowProvider>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default WhatsApp;
