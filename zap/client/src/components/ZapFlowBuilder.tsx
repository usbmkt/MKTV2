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
  XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // Estilos base do React Flow

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
    type FlowNode as ZapFlowNodeDefinition,
    type FlowEdge as ZapFlowEdgeDataDefinition,
    type TextMessageNodeData,
    type ConditionNodeData, type Condition as FlowCondition,
    type ApiCallNodeData,
    type ButtonsMessageNodeData, type ButtonOptionData as FlowButtonOptionData,
    type QuestionNodeData,
    type MediaMessageNodeData,
    type ListMessageNodeDataFE, type ListSectionData as FlowListSectionData, type ListItemData as FlowListItemData,
    type ExternalDataFetchNodeDataFE
} from '@zap_client/features/types/whatsapp_flow_types';
import { Loader2, Save, Plus, Settings, Trash2, MessageSquareText, HelpCircle, GitBranch, Clock, Zap as ZapIcon, MapPin, User, Activity, Mic, ArrowLeft, Maximize, Minimize, CloudCog, MessageCircleMore, RadioButton, ListChecks, DownloadCloud, Edit2, ChevronsUpDown } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';

// Nós Customizados
import TextMessageNode from './flow_builder_nodes/TextMessageNode';
import ConditionNode from './flow_builder_nodes/ConditionNode';
import ApiCallNode from './flow_builder_nodes/ApiCallNode';
import ButtonsMessageNode from './flow_builder_nodes/ButtonsMessageNode';
import QuestionNode from './flow_builder_nodes/QuestionNode';
import MediaMessageNode from './flow_builder_nodes/MediaMessageNode';
import ListMessageNode from './flow_builder_nodes/ListMessageNode';
import ExternalDataFetchNode from './flow_builder_nodes/ExternalDataFetchNode';
import DelayNode, { type DelayNodeData } from './flow_builder_nodes/DelayNode';
import SetVariableNode, { type SetVariableNodeData } from './flow_builder_nodes/SetVariableNode';

// Configuração dos tipos de nós disponíveis na paleta e para o React Flow
// Adicionando todos os nós que têm componentes visuais ou placeholders definidos
export const availableNodeTypesConfig = [
    { type: 'triggerNode', label: 'Gatilho Inicial', icon: ZapIcon, group: 'Controle', defaultData: { label: 'Início do Fluxo', triggerType: 'manual', config: {} }, inputs: 0, outputs: 1 },
    { type: 'textMessageNode', label: 'Enviar Texto', icon: MessageSquareText, group: 'Mensagens', defaultData: { label: 'Mensagem de Texto', messageText: 'Olá!' } },
    { type: 'buttonsMessageNode', label: 'Msg. com Botões', icon: MessageCircleMore, group: 'Mensagens', defaultData: { label: 'Pergunta com Botões', messageText: 'Escolha:', buttons: [{id: `btn_${Date.now()}`, label:'Opção 1'}], footerText:'' } },
    { type: 'listMessageNode', label: 'Msg. com Lista', icon: ListChecks, group: 'Mensagens', defaultData: { label: 'Menu em Lista', messageText: 'Selecione:', buttonText: 'Ver Opções', sections: [{title: 'Seção Principal', rows: [{id:`item_${Date.now()}`, title:'Item 1'}]}], footerText:'' } },
    { type: 'mediaMessageNode', label: 'Enviar Mídia', icon: ImageIcon, group: 'Mensagens', defaultData: { label: 'Anexo de Mídia', mediaType: 'image', url: '', caption: '' } },
    { type: 'questionNode', label: 'Coletar Resposta', icon: HelpCircle, group: 'Interação', defaultData: { label: 'Pergunta ao Usuário', questionText: 'Qual seu e-mail?', variableToSave: 'user_email' } },
    { type: 'conditionNode', label: 'Condição (Se/Então)', icon: GitBranch, group: 'Lógica', defaultData: { label: 'Decisão Lógica', conditions: [{ id: `cond_${Date.now()}`, variable: '', operator: 'equals', value: '', outputLabel: 'Verdadeiro' }], defaultOutputLabel: 'Falso' } },
    { type: 'apiCallNode', label: 'Chamada de API', icon: CloudCog, group: 'IA & Externo', defaultData: { label: 'Requisição HTTP', method: 'GET', url: '', headers:'{}', body:'{}', saveResponseTo: 'apiResult' } },
    { type: 'externalDataFetchNode', label: 'Buscar Dados Externos', icon: DownloadCloud, group: 'IA & Externo', defaultData: { label: 'Coleta Externa', url: '', method: 'GET', saveToVariable: 'externalData', headers: '{}' } },
    { type: 'delayNode', label: 'Aguardar Tempo', icon: Clock, group: 'Lógica', defaultData: { label: 'Pausa Programada', delaySeconds: 5 } },
    { type: 'setVariableNode', label: 'Definir Variável', icon: Settings2, group: 'Lógica', defaultData: { label: 'Atribuir Valor', variableName: 'minhaVariavel', value: 'meuValor' } },
    // Placeholders para nós futuros ou mais complexos
    // { type: 'aiDecisionNode', label: 'Decisão com IA', icon: Activity, group: 'IA & Externo', defaultData: { label: 'Análise IA', prompt: '', categories: [] } },
    // { type: 'gptQueryNode', label: 'Consulta GPT/IA', icon: Bot, group: 'IA & Externo', defaultData: { label: 'Texto Gerado por IA', prompt: '', variableToSave: '' } },
    // { type: 'clonedVoiceMessageNode', label: 'Mensagem de Voz (IA)', icon: Mic, group: 'IA & Externo', defaultData: { label: 'Áudio IA', textToSpeak: '', voiceId: '' } },
    // { type: 'tagContactNode', label: 'Adicionar Tag', icon: UserPlus, group: 'Ações', defaultData: { label: 'Etiquetar Contato', tagName: '' } },
    { type: 'endNode', label: 'Fim do Fluxo', icon: MapPin, group: 'Controle', defaultData: { label: 'Encerrar Conversa' } },
];

const PlaceholderNodeComponentInternal: React.FC<NodeProps<any> & {defaultIcon: React.ElementType, defaultLabel: string}> = ({ data, type, selected, defaultIcon: DefaultIcon, defaultLabel }) => {
    const config = availableNodeTypesConfig.find(n => n.type === type);
    const Icon = config?.icon || DefaultIcon || HelpCircle;
    const nodeColor = config?.color || 'border-gray-500/70'; // Não usado diretamente aqui, mas para referência
    const iconColor = config?.color?.replace('bg-','text-').replace('-500','-600') || 'text-gray-600';

    return (
      <div className={cn("p-3 border rounded-md shadow-md bg-card w-60 hover:shadow-lg transition-shadow", nodeColor, selected && `ring-2 ${nodeColor.replace('border-','ring-').replace('/70','')} ring-offset-1`)}>
        <Handle type="target" position={Position.Left} className="!bg-slate-400 w-2.5 h-2.5" />
        <div className="flex items-center font-semibold text-sm mb-1 text-foreground">
          <Icon className={cn("w-4 h-4 mr-2 flex-shrink-0", iconColor)} />
          {data.label || config?.label || defaultLabel}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          { (type === 'textMessageNode' && data.messageText) || 
            (type === 'questionNode' && data.questionText) ||
            (type === 'mediaMessageNode' && data.url) ||
            (type === 'apiCallNode' && data.url) ||
            'Clique para configurar...'}
        </p>
        { (config?.outputs !== 0) && <Handle type="source" position={Position.Right} className="!bg-slate-400 w-2.5 h-2.5" />}
      </div>
    );
};

const nodeTypes: NodeTypes = {
  textMessageNode: TextMessageNode,
  conditionNode: ConditionNode,
  apiCallNode: ApiCallNode,
  buttonsMessageNode: ButtonsMessageNode,
  questionNode: QuestionNode,
  mediaMessageNode: MediaMessageNode,
  listMessageNode: ListMessageNode,
  externalDataFetchNode: ExternalDataFetchNode,
  delayNode: DelayNode,
  setVariableNode: SetVariableNode,
  // Placeholders para tipos ainda não totalmente customizados mas na paleta
  triggerNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={ZapIcon} defaultLabel="Gatilho Inicial"/>,
  endNode: (props) => <PlaceholderNodeComponentInternal {...props} defaultIcon={MapPin} defaultLabel="Fim do Fluxo"/>,
  // Adicionar mais placeholders se houver outros tipos na 'availableNodeTypesConfig' sem componente customizado
};

const initialNodesData: Node<any>[] = [ { id: 'startNode_initial', type: 'triggerNode', data: { label: 'Início do Fluxo', triggerType: 'manual', config:{} }, position: { x: 150, y: 50 }, deletable: false }];
interface ZapFlowBuilderProps { flowId: number | null; initialFlowName?: string; onSaveSuccess?: (flowId: number, flowName: string) => void; onCloseEditor?: () => void; }
let idCounter = 0;
const getUniqueNodeId = (type = 'node') => `${type}_${Date.now()}_${idCounter++}`;

type AllNodeDataTypes = TextMessageNodeData | ConditionNodeData | ApiCallNodeData | ButtonsMessageNodeData | QuestionNodeData | MediaMessageNodeData | ListMessageNodeDataFE | ExternalDataFetchNodeDataFE | DelayNodeData | SetVariableNodeData | BaseNodeData;

const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ flowId, initialFlowName, onSaveSuccess, onCloseEditor }) => {
  const { screenToFlowPosition, fitView, getNodes, getEdges, deleteElements, project } = useReactFlow();
  const queryClientHook = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesData);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState<Node<AllNodeDataTypes> | null>(null);
  const [flowName, setFlowName] = useState(initialFlowName || 'Novo Fluxo');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(true);


  const { data: loadedFlow, isLoading: isLoadingFlow, error: flowError } = useQuery<ZapFlow, ApiError>({
    queryKey: ['zapFlowDefinition', flowId],
    queryFn: async () => {
      if (!flowId) throw new Error("ID do Fluxo não fornecido.");
      return apiRequest({ url: `/whatsapp/flows/${flowId}/editor-data`, method: 'GET' });
    },
    enabled: !!flowId,
    onSuccess: (data) => {
      if (data && data.elements) {
        setFlowName(data.name || `Fluxo ${flowId}`);
        const flowElements = data.elements;
        const typedNodes = flowElements.nodes.map(n => ({...n, type: nodeTypes[n.type || ''] ? n.type : 'triggerNode' }));
        setNodes(typedNodes);
        setEdges(flowElements.edges || []);
        if (flowElements.viewport) {
            setTimeout(() => {
                const { x, y, zoom } = flowElements.viewport!;
                setViewport({ x, y, zoom }, { duration: 300 });
            }, 100);
        } else {
            setTimeout(() => fitView({padding:0.2, duration:300}), 100); 
        }
      } else if (flowId) {
         setNodes(initialNodesData); setEdges([]);
         setTimeout(() => fitView({padding:0.2, duration:300}), 100); 
      }
    },
  });

  const saveFlowMutation = useMutation<ZapFlow, ApiError, { flowIdToSave: number, name: string, elements: FlowElementData }>({
    mutationFn: ({ flowIdToSave, name, elements }) => 
      apiRequest({ url: `/whatsapp/flows/${flowIdToSave}/editor-data`, method: 'PUT', data: { name, elements } }),
    onSuccess: (savedFlowData) => {
      queryClientHook.invalidateQueries({ queryKey: ['zapFlows'] });
      queryClientHook.setQueryData(['zapFlowDefinition', savedFlowData.id], savedFlowData);
      alert("Fluxo Salvo com Sucesso!");
      if (onSaveSuccess) onSaveSuccess(savedFlowData.id, savedFlowData.name);
    },
    onError: (error) => alert(`Erro ao Salvar Fluxo: ${error.message}`)
  });

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);
  
  const handleSaveFlow = () => {
    if (!flowId) { alert("Erro: ID do fluxo não definido."); return; }
    const currentViewport = project({x:0,y:0}); // Simplificado, idealmente pegar o viewport real.
    const currentFlowData: FlowElementData = { 
        nodes: getNodes(), 
        edges: getEdges(),
        viewport: {x: currentViewport.x, y: currentViewport.y, zoom: currentViewport.zoom} // Salvar viewport
    };
    saveFlowMutation.mutate({ flowIdToSave: flowId, name: flowName, elements: currentFlowData });
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeForEdit(node as Node<AllNodeDataTypes>);
    setIsPropertiesPanelOpen(true); // Abre o painel ao clicar no nó
  }, []);
  const onPaneClick = useCallback(() => setSelectedNodeForEdit(null), []);

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback( (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current) return;
      const type = event.dataTransfer.getData('application/reactflow-nodetype');
      const nodeConfig = availableNodeTypesConfig.find(n => n.type === type);
      if (!type || !nodeConfig) return;
      
      const position = screenToFlowPosition({ 
          x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left, 
          y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top 
      });
      const newNode: Node = { id: getUniqueNodeId(type), type, position, data: { label: nodeConfig.label, ...(nodeConfig.defaultData || {}) }};
      setNodes((nds) => nds.concat(newNode));
    }, [screenToFlowPosition, setNodes]
  );
  
  const handleNodeDataChange = (key: string, value: any, subId?: string, subKey?: string, subIndex?: number, subSubIndex?: number, subSubKey?: string) => {
    if (!selectedNodeForEdit) return;
    let newSpecificData = { ...selectedNodeForEdit.data };

    if (selectedNodeForEdit.type === 'conditionNode' && subId && subKey && typeof subIndex === 'number') { /* ...como antes... */ }
    else if (selectedNodeForEdit.type === 'buttonsMessageNode' && subId && subKey && typeof subIndex === 'number') { /* ...como antes... */ }
    else if (selectedNodeForEdit.type === 'listMessageNode') { /* ...como antes... */ }
    else { newSpecificData[key] = value; }
    
    const updatedNode = { ...selectedNodeForEdit, data: newSpecificData };
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeForEdit.id ? updatedNode : n)));
    setSelectedNodeForEdit(updatedNode);
  };

  const addCondition = () => { /* ... como antes ... */ };
  const removeCondition = (conditionIdToRemove: string) => { /* ... como antes ... */ };
  const addButtonToNode = () => { /* ... como antes ... */ };
  const removeButtonFromNode = (buttonIdToRemove: string) => { /* ... como antes ... */ };
  
  const addListSection = () => { if(selectedNodeForEdit?.type === 'listMessageNode') handleNodeDataChange('sections', '', undefined, '_addSection'); };
  const removeListSection = (sectionIdx: number) => { if(selectedNodeForEdit?.type === 'listMessageNode') handleNodeDataChange('sections', '', undefined, '_removeSection', sectionIdx);};
  const addListItemToSection = (sectionIdx: number) => { if(selectedNodeForEdit?.type === 'listMessageNode') handleNodeDataChange('sections.rows', '', undefined, '_addRowToSection', sectionIdx);};
  const removeListItemFromSection = (sectionIdx: number, itemIdx: number) => { if(selectedNodeForEdit?.type === 'listMessageNode') handleNodeDataChange('sections.rows', '', undefined, '_removeRowFromSection', sectionIdx, itemIdx);};


  const deleteSelectedNode = () => {
    if (selectedNodeForEdit && selectedNodeForEdit.id !== 'startNode_initial') {
      const nodeToDelete = nodes.find(n => n.id === selectedNodeForEdit.id);
      if (nodeToDelete) { deleteElements({ nodes: [nodeToDelete] }); setSelectedNodeForEdit(null); }
    }
  };
  
  if (isLoadingFlow && flowId) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary"/> Carregando...</div>;
  if (flowError && flowId) return <div className="p-4 text-destructive">Erro ao carregar fluxo: {flowError.message}</div>;

  return (
      <div className="h-[calc(100vh-180px)] w-full flex flex-col md:flex-row border rounded-lg shadow-md bg-card neu-card overflow-hidden" ref={reactFlowWrapper}>
        <Card className="w-full md:w-64 border-none md:border-r rounded-none md:rounded-l-lg shadow-none md:shadow-sm flex-shrink-0">
            <CardHeader className="p-3 border-b flex justify-between items-center">
                <CardTitle className="text-sm font-semibold text-foreground">Componentes</CardTitle>
                <Input type="search" placeholder="Buscar nó..." className="h-7 text-xs w-28 neu-input hidden"/> {/* TODO: Implementar busca de nós */}
            </CardHeader>
            <CardContent className="p-2">
                <ScrollArea className="h-full max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-240px)] pr-1">
                    {Object.entries(
                        availableNodeTypesConfig.reduce((acc, curr) => {
                            acc[curr.group] = [...(acc[curr.group] || []), curr];
                            return acc;
                        }, {} as Record<string, typeof availableNodeTypesConfig>)
                    ).map(([groupName, nodesInGroup]) => (
                        <div key={groupName}>
                            <h5 className="text-xs font-medium text-muted-foreground my-1.5 px-1 uppercase tracking-wider">{groupName}</h5>
                            {nodesInGroup.map(nodeConfig => {
                                const Icon = nodeConfig.icon;
                                return ( <Button key={nodeConfig.type} variant="ghost" size="sm"
                                    className="w-full justify-start text-xs h-8 neu-button hover:bg-muted"
                                    onDragStart={(event) => { /* ... */ }} draggable title={`Arraste ${nodeConfig.label}`}>
                                    <Icon className="w-3.5 h-3.5 mr-2 flex-shrink-0" /> {nodeConfig.label}
                                </Button> )
                            })}
                        </div>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>

        <div className="flex-grow relative h-full min-h-[400px] md:min-h-0" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} fitView fitViewOptions={{padding:0.2, duration: 300}}
            className="bg-background dark:bg-slate-900" proOptions={{hideAttribution: true}}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={0.7} color="hsl(var(--border))" />
            <Controls className="neu-controls [&>button]:bg-card [&>button]:border-border [&>button:hover]:bg-muted">
                 <ControlButton onClick={() => fitView({duration: 300})} title="Ajustar Visualização"><Maximize className="w-4 h-4"/></ControlButton>
                 {/* <ControlButton onClick={() => console.log("Undo")} title="Desfazer"><Undo className="w-4 h-4"/></ControlButton>
                 <ControlButton onClick={() => console.log("Redo")} title="Refazer"><Redo className="w-4 h-4"/></ControlButton> */}
            </Controls>
            <MiniMap nodeStrokeWidth={3} nodeColor={(n: Node) => '#999'} className="!bg-card border border-border rounded shadow-md" pannable zoomable/>
            <Panel position="top-left" className="p-2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-md border">
                {onCloseEditor && <Button variant="ghost" size="icon" onClick={onCloseEditor} className="h-7 w-7 neu-button" title="Voltar"><ArrowLeft className="h-4 w-4"/></Button>}
                <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Nome do Fluxo" className="inline-flex w-auto h-8 text-xs neu-input flex-grow min-w-[150px] max-w-[300px]" />
                 <Button variant="ghost" size="icon" className="h-7 w-7 neu-button" onClick={() => setIsPropertiesPanelOpen(prev => !prev)} title={isPropertiesPanelOpen ? "Esconder Painel" : "Mostrar Painel"}>
                    {isPropertiesPanelOpen ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                 </Button>
            </Panel>
            <Panel position="top-right" className="p-2">
                <Button onClick={handleSaveFlow} size="sm" disabled={saveFlowMutation.isPending || !flowId} className="neu-button-primary">
                    {saveFlowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5"/> : <Save className="w-4 h-4 mr-1.5" />} Salvar Fluxo
                </Button>
            </Panel>
          </ReactFlow>
        </div>

        <Card className={cn("w-full md:w-72 border-none md:border-l rounded-none md:rounded-r-lg shadow-none md:shadow-sm flex-shrink-0 transition-all duration-300 ease-in-out", isPropertiesPanelOpen && selectedNodeForEdit ? "opacity-100 md:translate-x-0" : "opacity-0 -translate-x-full md:translate-x-0 md:w-0 md:p-0 md:opacity-0 pointer-events-none md:pointer-events-auto")}>
             <CardHeader className="p-3 border-b sticky top-0 bg-card z-10">
                <CardTitle className="text-sm font-semibold text-foreground">
                    {selectedNodeForEdit ? `Editar: ${selectedNodeForEdit.data.label || selectedNodeForEdit.type}` : "Propriedades"}
                </CardTitle>
                {selectedNodeForEdit && <CardDescription className="text-xs">ID do Nó: {selectedNodeForEdit.id}</CardDescription>}
            </CardHeader>
            <CardContent className="p-3">
                <ScrollArea className="h-[calc(100vh-250px)] md:h-[calc(100vh-220px)] pr-1">
                {selectedNodeForEdit ? (
                    <div className="space-y-4">
                        <div><Label className="text-xs">Título do Nó*</Label><Input value={selectedNodeForEdit.data.label || ''} onChange={(e) => handleNodeDataChange('label', e.target.value)} className="h-8 ..."/></div>

                        {selectedNodeForEdit.type === 'textMessageNode' && ( <div className="space-y-2 border-t pt-3 mt-3"> <h5 className="text-xs ...">Conteúdo da Mensagem</h5> <Label className="text-xs">Texto Principal*</Label> <Textarea value={(selectedNodeForEdit.data as TextMessageNodeData).messageText || ''} onChange={(e) => handleNodeDataChange('messageText', e.target.value)} rows={5} className="text-xs ..."/> </div> )}
                        {selectedNodeForEdit.type === 'conditionNode' && ( <div className="space-y-2 border-t pt-3 mt-3"> <h5 className="text-xs ...">Configurar Condições</h5> {((selectedNodeForEdit.data as ConditionNodeData).conditions || []).map((cond, index) => ( <Card key={cond.id || index} className="p-2 ..."> {/* ... campos da condição ... */} <Button variant="ghost" size="xs" onClick={() => removeCondition(cond.id!)} className="..."><Trash2 className="w-3 h-3"/></Button> </Card> ))} <Button variant="outline" size="xs" onClick={addCondition} className="..."><Plus className="w-3 h-3"/>Adicionar Condição</Button> </div> )}
                        {selectedNodeForEdit.type === 'apiCallNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Chamada de API</h5> {/* ... campos como method, url, headers, body, saveResponseTo ... */} </div> )}
                        {selectedNodeForEdit.type === 'buttonsMessageNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Mensagem com Botões</h5> {/* ... campos como messageText, footerText, e a UI para adicionar/editar botões (usando addButtonToNode, removeButtonFromNode) ... */} </div> )}
                        {selectedNodeForEdit.type === 'questionNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Configurar Pergunta</h5> {/* ... campos como questionText, variableToSave ... */} </div> )}
                        {selectedNodeForEdit.type === 'mediaMessageNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Envio de Mídia</h5> {/* ... campos como mediaType, url, caption, fileName, etc. ... */} </div> )}
                        {selectedNodeForEdit.type === 'listMessageNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Mensagem com Lista</h5> {/* ... campos como messageText, buttonText, title, footerText, e UI para seções/itens ... */} </div> )}
                        {selectedNodeForEdit.type === 'externalDataFetchNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Buscar Dados Externos</h5> {/* ... campos como url, method, headers, saveToVariable ... */} </div> )}
                        {selectedNodeForEdit.type === 'delayNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Atraso</h5> {/* ... campo delaySeconds ... */} </div> )}
                        {selectedNodeForEdit.type === 'setVariableNode' && ( <div className="space-y-3 border-t pt-3 mt-3"> <h5 className="text-xs ...">Definir Variável</h5> {/* ... campos variableName, value ... */} </div> )}
                        
                        {!Object.keys(nodeTypes).includes(selectedNodeForEdit.type || '') && selectedNodeForEdit.type !== 'triggerNode' && selectedNodeForEdit.type !== 'endNode' && (
                             <div className="space-y-2 border-t pt-3 mt-3"><h5 className="text-xs ...">Configuração</h5><p className="text-xs ...">Painel para '{selectedNodeForEdit.type}' não implementado.</p></div>
                        )}

                        <details className="mt-3 pt-3 border-t"><summary className="text-xs ...">Dados brutos (JSON)</summary><Textarea value={JSON.stringify(selectedNodeForEdit.data, null, 2)} readOnly rows={8} className="text-xs ..."/></details>
                        {selectedNodeForEdit.id !== 'startNode_initial' && <Button variant="destructive" size="sm" className="w-full ..." onClick={deleteSelectedNode}><Trash2 className="w-3.5 ..."/>Deletar Nó</Button>}
                    </div>
                ) : ( <p className="text-xs text-muted-foreground text-center py-10">Selecione um nó no canvas para editar.</p> )}
                </ScrollArea>
            </CardContent>
        </Card>
      </div>
  );
};

const ZapFlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = (props) => ( <ReactFlowProvider> <ZapFlowBuilderInternal {...props} /> </ReactFlowProvider> );
export default ZapFlowBuilderWrapper;

type ZapFlow = { id: number; name: string; elements: FlowElementData; mktv2UserId: number; status: string; triggerType: string; triggerConfig: any; };