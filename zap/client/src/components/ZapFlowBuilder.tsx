// zap/client/src/components/ZapFlowBuilder.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
  NodeTypes,
  Panel,
  MarkerType,
  useReactFlow,
  getConnectedEdges,
  ControlButton,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@zap_client/lib/api';
import { 
    type FlowElementData, 
    type FlowNode as ZapFlowNodeDataDefinition, // Renomear para evitar conflito com Node de ReactFlow
    type FlowEdge as ZapFlowEdgeDataDefinition,
    type TextMessageNodeData,
    type ConditionNodeData, type Condition as FlowCondition,
    type ApiCallNodeData,
    type ButtonsMessageNodeData, type ButtonOptionData as FlowButtonOptionData,
    type QuestionNodeData,
    type MediaMessageNodeData,
    type ListMessageNodeDataFE, type ListSectionData as FlowListSectionData, type ListItemData as FlowListItemData, // Tipos para ListMessage
    type ExternalDataFetchNodeDataFE // Tipo para ExternalDataFetch
} from '@zap_client/features/types/whatsapp_flow_types';
import { Loader2, Save, Plus, Settings, Trash2, MessageSquareText, HelpCircle, GitBranch, Clock, Zap as ZapIcon, MapPin, User, Activity, Mic, ArrowLeft, Maximize, Minimize, CloudCog, MessageCircleMore, RadioButton, ListChecks, DownloadCloud } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';

// Nós Customizados
import TextMessageNode from './flow_builder_nodes/TextMessageNode';
import ConditionNode from './flow_builder_nodes/ConditionNode';
import ApiCallNode from './flow_builder_nodes/ApiCallNode';
import ButtonsMessageNode from './flow_builder_nodes/ButtonsMessageNode';
import QuestionNode from './flow_builder_nodes/QuestionNode';
import MediaMessageNode from './flow_builder_nodes/MediaMessageNode';
import ListMessageNode from './flow_builder_nodes/ListMessageNode'; // Importado
import ExternalDataFetchNode from './flow_builder_nodes/ExternalDataFetchNode'; // Importado


export const availableNodeTypesConfig = [
    { type: 'triggerNode', label: 'Gatilho Inicial', icon: ZapIcon, group: 'Controle', defaultData: { label: 'Início do Fluxo', triggerType: 'manual', config: {} }, inputs: 0, outputs: 1 },
    { type: 'textMessageNode', label: 'Enviar Texto', icon: MessageSquareText, group: 'Mensagens', defaultData: { label: 'Mensagem de Texto', messageText: 'Olá!' } },
    { type: 'buttonsMessageNode', label: 'Msg. com Botões', icon: MessageCircleMore, group: 'Mensagens', defaultData: { label: 'Pergunta com Botões', messageText: 'Escolha:', buttons: [{id: `btn_${Date.now()}`, label:'Opção 1'}], footerText:'' } },
    { type: 'listMessageNode', label: 'Msg. com Lista', icon: ListChecks, group: 'Mensagens', defaultData: { label: 'Menu em Lista', messageText: 'Selecione:', buttonText: 'Ver Opções', sections: [{title: 'Seção 1', rows: [{id:`item_${Date.now()}`, title:'Item 1'}]}], footerText:'' } },
    { type: 'mediaMessageNode', label: 'Enviar Mídia', icon: ImageIcon, group: 'Mensagens', defaultData: { label: 'Anexo de Mídia', mediaType: 'image', url: '', caption: '' } },
    { type: 'questionNode', label: 'Coletar Resposta', icon: HelpCircle, group: 'Interação', defaultData: { label: 'Pergunta ao Usuário', questionText: 'Qual seu e-mail?', variableToSave: 'user_email' } },
    { type: 'conditionNode', label: 'Condição (Se/Então)', icon: GitBranch, group: 'Lógica', defaultData: { label: 'Decisão Lógica', conditions: [{ id: `cond_${Date.now()}`, variable: '', operator: 'equals', value: '', outputLabel: 'Verdadeiro' }], defaultOutputLabel: 'Falso' } },
    { type: 'apiCallNode', label: 'Chamada de API', icon: CloudCog, group: 'IA & Externo', defaultData: { label: 'Requisição HTTP', method: 'GET', url: '', headers:'{}', body:'{}', saveResponseTo: 'apiResult' } },
    { type: 'externalDataFetchNode', label: 'Buscar Dados Externos', icon: DownloadCloud, group: 'IA & Externo', defaultData: { label: 'Coleta Externa', url: '', method: 'GET', saveToVariable: 'externalData', headers: '{}' } },
    { type: 'delayNode', label: 'Aguardar Tempo', icon: Clock, group: 'Lógica', defaultData: { label: 'Pausa Programada', delaySeconds: 5 } },
    { type: 'setVariableNode', label: 'Definir Variável', icon: Settings, group: 'Lógica', defaultData: { label: 'Atribuir Valor', variableName: 'minhaVar', value: 'valor' } },
    { type: 'endNode', label: 'Fim do Fluxo', icon: MapPin, group: 'Controle', defaultData: { label: 'Encerrar Conversa' } },
];

const PlaceholderNodeComponentInternal: React.FC<any & {defaultIcon: React.ElementType, defaultLabel: string}> = ({ data, type, selected, defaultIcon: DefaultIcon, defaultLabel }) => { /* ... como antes ... */ return <div>...</div>};

const nodeTypes: NodeTypes = {
  textMessageNode: TextMessageNode,
  conditionNode: ConditionNode,
  apiCallNode: ApiCallNode,
  buttonsMessageNode: ButtonsMessageNode,
  questionNode: QuestionNode,
  mediaMessageNode: MediaMessageNode,
  listMessageNode: ListMessageNode, // Adicionado
  externalDataFetchNode: ExternalDataFetchNode, // Adicionado
  triggerNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={ZapIcon} defaultLabel="Gatilho Inicial"/>,
  endNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={MapPin} defaultLabel="Fim do Fluxo"/>,
  delayNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={Clock} defaultLabel="Aguardar"/>,
  setVariableNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={Settings} defaultLabel="Definir Variável"/>,
};

const initialNodesData: Node<any>[] = [ { id: 'startNode_initial', type: 'triggerNode', data: { label: 'Início do Fluxo', triggerType: 'manual', config:{} }, position: { x: 150, y: 50 }, deletable: false }];
interface ZapFlowBuilderProps { flowId: number | null; initialFlowName?: string; onSaveSuccess?: (flowId: number, flowName: string) => void; onCloseEditor?: () => void; }
let idCounter = 0;
const getUniqueNodeId = (type = 'node') => `${type}_${Date.now()}_${idCounter++}`;

type AllNodeDataTypes = TextMessageNodeData | ConditionNodeData | ApiCallNodeData | ButtonsMessageNodeData | QuestionNodeData | MediaMessageNodeData | ListMessageNodeDataFE | ExternalDataFetchNodeDataFE | BaseNodeData;


const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ flowId, initialFlowName, onSaveSuccess, onCloseEditor }) => {
  const { screenToFlowPosition, fitView, getNodes, getEdges, deleteElements } = useReactFlow();
  const queryClientHook = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesData);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState<Node<AllNodeDataTypes> | null>(null);
  const [flowName, setFlowName] = useState(initialFlowName || 'Novo Fluxo');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ... (useQuery para loadedFlow, saveFlowMutation como antes) ...

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);
  const handleSaveFlow = () => { /* ... como antes ... */ };
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNodeForEdit(node as Node<AllNodeDataTypes>), []);
  const onPaneClick = useCallback(() => setSelectedNodeForEdit(null), []);
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback( (event: React.DragEvent) => { /* ... como antes ... */ }, [screenToFlowPosition, setNodes]);
  
  const handleNodeDataChange = (key: string, value: any, subId?: string, subKey?: string, subIndex?: number, subSubIndex?: number, subSubKey?: string) => {
    if (!selectedNodeForEdit) return;
    let newSpecificData = { ...selectedNodeForEdit.data };

    if (selectedNodeForEdit.type === 'conditionNode' && subId && subKey && typeof subIndex === 'number') { /* ... */ }
    else if (selectedNodeForEdit.type === 'buttonsMessageNode' && subId && subKey && typeof subIndex === 'number') { /* ... */ }
    else if (selectedNodeForEdit.type === 'listMessageNode') {
        if (key === 'sections' && typeof subIndex === 'number') { // Editar título da seção ou remover seção
            const currentSections = (newSpecificData.sections || []) as FlowListSectionData[];
            if (subKey === '_removeSection') {
                 newSpecificData.sections = currentSections.filter((_, idx) => idx !== subIndex);
            } else if (subKey === 'title') {
                 newSpecificData.sections = currentSections.map((sec, idx) => idx === subIndex ? {...sec, title: value} : sec );
            }
        } else if (key === 'sections.rows' && typeof subIndex === 'number' && typeof subSubIndex === 'number' && subSubKey) { // Editar item da lista
            const currentSections = (newSpecificData.sections || []) as FlowListSectionData[];
            newSpecificData.sections = currentSections.map((sec, secIdx) => {
                if (secIdx === subIndex) {
                    return {
                        ...sec,
                        rows: (sec.rows || []).map((row, rowIdx) => 
                            rowIdx === subSubIndex ? {...row, [subSubKey]: value} : row
                        )
                    };
                }
                return sec;
            });
        } else if (key === '_addSection') {
            const currentSections = (newSpecificData.sections || []) as FlowListSectionData[];
            newSpecificData.sections = [...currentSections, { title: `Nova Seção ${currentSections.length + 1}`, rows: [{id: `item_${Date.now()}`, title: 'Novo Item'}]}];
        } else if (key === '_addRowToSection' && typeof subIndex === 'number') {
            const currentSections = (newSpecificData.sections || []) as FlowListSectionData[];
             newSpecificData.sections = currentSections.map((sec, idx) => 
                idx === subIndex ? {...sec, rows: [...(sec.rows || []), {id: `item_${Date.now()}`, title: `Novo Item ${ (sec.rows?.length || 0) + 1}`}] } : sec
             );
        } else if (key === '_removeRowFromSection' && typeof subIndex === 'number' && typeof subSubIndex === 'number') {
             const currentSections = (newSpecificData.sections || []) as FlowListSectionData[];
             newSpecificData.sections = currentSections.map((sec, idx) => 
                idx === subIndex ? {...sec, rows: (sec.rows || []).filter((_, rowIdx) => rowIdx !== subSubIndex) } : sec
             );
        }
        else { newSpecificData[key] = value; }
    } else {
        newSpecificData[key] = value;
    }
    
    const updatedNode = { ...selectedNodeForEdit, data: newSpecificData };
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeForEdit.id ? updatedNode : n)));
    setSelectedNodeForEdit(updatedNode);
  };

  const addCondition = () => { /* ... */ };
  const removeCondition = (conditionIdToRemove: string) => { /* ... */ };
  const addButtonToNode = () => { /* ... */ };
  const removeButtonFromNode = (buttonIdToRemove: string) => { /* ... */ };
  const deleteSelectedNode = () => { /* ... */ };

  if (isLoadingFlow && flowId) { /* ... */ }
  if (flowError && flowId) { /* ... */ }

  return (
      <div className="h-[calc(100vh-180px)] w-full flex flex-col md:flex-row border rounded-lg shadow-md bg-card neu-card overflow-hidden" ref={reactFlowWrapper}>
        {/* Paleta de Nós (como antes) */}
        <Card className="w-full md:w-60 ..."> {/* ... */} </Card>

        {/* Canvas do React Flow (como antes) */}
        <div className="flex-grow relative h-full min-h-[400px] md:min-h-0" onDrop={onDrop} onDragOver={onDragOver}> {/* ... */} </div>

        {/* Painel de Propriedades */}
        <Card className={cn("w-full md:w-72 ...", selectedNodeForEdit ? "..." : "...")}>
             <CardHeader className="p-3 border-b sticky top-0 bg-card z-10"> /* ... */ </CardHeader>
            <CardContent className="p-3">
                <ScrollArea className="h-[calc(100vh-250px)] md:h-[calc(100vh-220px)] pr-1">
                {selectedNodeForEdit ? (
                    <div className="space-y-3">
                        {/* Label do Nó (Comum a todos) */}
                        <div><Label className="text-xs">Título do Nó*</Label><Input value={selectedNodeForEdit.data.label || ''} onChange={(e) => handleNodeDataChange('label', e.target.value)} className="h-8 ..."/></div>

                        {/* Propriedades específicas por tipo de nó */}
                        {selectedNodeForEdit.type === 'textMessageNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'conditionNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'apiCallNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'buttonsMessageNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'questionNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'mediaMessageNode' && ( /* ... painel como antes ... */ )}
                        
                        {selectedNodeForEdit.type === 'listMessageNode' && (
                            <div className="space-y-3 border-t pt-3 mt-3">
                                <h5 className="text-xs font-medium text-muted-foreground">Mensagem com Lista</h5>
                                <div><Label className="text-xs">Texto Principal*</Label><Textarea value={(selectedNodeForEdit.data as ListMessageNodeDataFE).messageText || ''} onChange={(e) => handleNodeDataChange('messageText', e.target.value)} rows={2} className="text-xs ..."/></div>
                                <div><Label className="text-xs">Texto do Botão Lista*</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).buttonText || ''} onChange={(e) => handleNodeDataChange('buttonText', e.target.value)} className="h-8 ..."/></div>
                                <div><Label className="text-xs">Título da Lista</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).title || ''} onChange={(e) => handleNodeDataChange('title', e.target.value)} className="h-8 ..."/></div>
                                <div><Label className="text-xs">Rodapé</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).footerText || ''} onChange={(e) => handleNodeDataChange('footerText', e.target.value)} className="h-8 ..."/></div>
                                
                                <Label className="text-xs font-medium pt-2 block">Seções e Itens:</Label>
                                {((selectedNodeForEdit.data as ListMessageNodeDataFE).sections || []).map((section, sectionIdx) => (
                                    <Card key={`section-${sectionIdx}`} className="p-2 space-y-1.5 bg-muted/40 neu-inset-card">
                                        <div className="flex justify-between items-center">
                                            <Input value={section.title} onChange={(e) => handleNodeDataChange('sections', e.target.value, undefined, 'title', sectionIdx)} placeholder={`Título Seção ${sectionIdx + 1}`} className="h-7 text-xxs flex-grow mr-1"/>
                                            <Button variant="ghost" size="xs" onClick={() => handleNodeDataChange('sections', '', undefined, '_removeSection', sectionIdx)} className="text-destructive h-6 w-6 p-0"><Trash2 className="w-3 h-3"/></Button>
                                        </div>
                                        {(section.rows || []).map((row, rowIdx) => (
                                            <Card key={row.id || `row-${sectionIdx}-${rowIdx}`} className="p-1.5 pl-2 space-y-1 bg-card/50">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xxs">Item {rowIdx+1}</Label>
                                                    <Button variant="ghost" size="xs" onClick={() => handleNodeDataChange('sections.rows', '', undefined, '_removeRowFromSection', sectionIdx, rowIdx)} className="text-destructive h-5 w-5 p-0"><Trash2 className="w-2.5 h-2.5"/></Button>
                                                </div>
                                                <Input value={row.title} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'title', sectionIdx, rowIdx, 'title')} placeholder="Título do Item" className="h-6 text-xxs"/>
                                                <Input value={row.description || ''} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'description', sectionIdx, rowIdx, 'description')} placeholder="Descrição (opcional)" className="h-6 text-xxs"/>
                                                <Input value={row.id} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'id', sectionIdx, rowIdx, 'id')} placeholder="ID do Item (valor da resposta)" className="h-6 text-xxs font-mono"/>
                                            </Card>
                                        ))}
                                        <Button variant="outline" size="xs" onClick={() => handleNodeDataChange('sections.rows', '', undefined, '_addRowToSection', sectionIdx)} className="w-full text-xxs h-6"><Plus className="w-3 h-3 mr-1"/>Adicionar Item à Seção</Button>
                                    </Card>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => handleNodeDataChange('sections', '', undefined, '_addSection')} className="w-full text-xs neu-button"><Plus className="w-3.5 h-3.5 mr-1.5"/>Adicionar Seção</Button>
                            </div>
                        )}

                        {selectedNodeForEdit.type === 'externalDataFetchNode' && (
                            <div className="space-y-3 border-t pt-3 mt-3">
                                <h5 className="text-xs font-medium text-muted-foreground">Buscar Dados Externos</h5>
                                <div><Label className="text-xs">URL*</Label><Input value={(selectedNodeForEdit.data as ExternalDataFetchNodeDataFE).url || ''} onChange={(e) => handleNodeDataChange('url', e.target.value)} className="h-8 ..."/></div>
                                <div><Label className="text-xs">Método</Label><Select value={(selectedNodeForEdit.data as ExternalDataFetchNodeDataFE).method || 'GET'} onValueChange={(val) => handleNodeDataChange('method', val as 'GET')}><SelectTrigger className="h-8 ..."><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GET">GET</SelectItem></SelectContent></Select></div>
                                <div><Label className="text-xs">Cabeçalhos (JSON)</Label><Textarea value={(selectedNodeForEdit.data as ExternalDataFetchNodeDataFE).headers || '{}'} onChange={(e) => handleNodeDataChange('headers', e.target.value)} placeholder='{ "X-API-Key": "valor" }' rows={2} className="text-xs ... font-mono"/></div>
                                <div><Label className="text-xs">Salvar Resposta na Variável*</Label><Input value={(selectedNodeForEdit.data as ExternalDataFetchNodeDataFE).saveToVariable || ''} onChange={(e) => handleNodeDataChange('saveToVariable', e.target.value)} className="h-8 ..."/></div>
                                {/* TODO: Adicionar UI para Data Mapping se necessário */}
                            </div>
                        )}
                        
                        {/* ... (Placeholder para outros tipos e botão Deletar Nó como antes) ... */}
                    </div>
                ) : ( <p className="text-xs text-muted-foreground text-center py-10">Selecione um nó...</p> )}
                </ScrollArea>
            </CardContent>
        </Card>
      </div>
  );
};

const ZapFlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = (props) => ( /* ... como antes ... */ );
export default ZapFlowBuilderWrapper;

type ZapFlow = { /* ... como antes ... */ };