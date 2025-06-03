import React, { memo, useCallback, useEffect, useMemo, useState, ChangeEvent, KeyboardEvent } from 'react'; // Adicionado ChangeEvent, KeyboardEvent
import { 
    ReactFlow, 
    MiniMap, 
    Controls, 
    Background, 
    useNodesState, 
    useEdgesState, 
    addEdge, 
    Connection, 
    Edge, 
    Node, 
    Panel, 
    NodeTypes, 
    ReactFlowProvider, 
    useReactFlow, 
    NodeProps as ReactFlowNodeProps, // Renomeado para evitar conflito
    BackgroundVariant 
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import '@xyflow/react/dist/base.css';


// Importações de Nós Customizados (usando alias @zap_client)
import TriggerNodeComponent from '@zap_client/components/flow_builder_nodes/TriggerNode';
import TextMessageNodeComponent from '@zap_client/components/flow_builder_nodes/TextMessageNode';
import QuestionNodeComponent from '@zap_client/components/flow_builder_nodes/QuestionNode';
import ListMessageNodeComponent from '@zap_client/components/flow_builder_nodes/ListMessageNode';
import ButtonsMessageNodeComponent from '@zap_client/components/flow_builder_nodes/ButtonsMessageNode';
import MediaMessageNodeComponent from '@zap_client/components/flow_builder_nodes/MediaMessageNode';
import ConditionNodeComponent from '@zap_client/components/flow_builder_nodes/ConditionNode';
import DelayNodeComponent from '@zap_client/components/flow_builder_nodes/DelayNode';
import ActionNodeComponent from '@zap_client/components/flow_builder_nodes/ActionNode';
import GptQueryNodeComponent from '@zap_client/components/flow_builder_nodes/GptQueryNode'; 
import AiDecisionNodeComponent from '@zap_client/components/flow_builder_nodes/AiDecisionNode';
import ClonedVoiceNodeComponent from '@zap_client/components/flow_builder_nodes/ClonedVoiceNode';
import TagContactNodeComponent from '@zap_client/components/flow_builder_nodes/TagContactNode';
import SetVariableNodeComponent from '@zap_client/components/flow_builder_nodes/SetVariableNode';
import ExternalDataNodeComponent from '@zap_client/components/flow_builder_nodes/ExternalDataNode'; 
import ApiCallNodeComponent from '@zap_client/components/flow_builder_nodes/ApiCallNode';
import EndNodeComponent from '@zap_client/components/flow_builder_nodes/EndNode';

// Importações de Tipos (usando alias @zap_client)
import {
  FlowNodeType,
  CustomFlowNode, 
  CustomFlowEdge, 
  FlowData,       
  FlowNodeData,   
  TriggerNodeData,
  TextMessageNodeData,
  QuestionNodeData,
  ListMessageNodeData,
  ButtonsMessageNodeData,
  MediaMessageNodeData,
  ConditionNodeData,
  DelayNodeData,
  ActionNodeData,
  ActionType, 
  GptQueryNodeData,
  AiDecisionNodeData,
  ClonedVoiceNodeData,
  TagContactNodeData,
  SetVariableNodeData,
  ExternalDataNodeData,
  ApiCallNodeData,
  EndNodeData,
  FlowEdgeData, 
  CustomFlowNodeType, 
} from '@zap_client/features/types/whatsapp_flow_types';

import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Card, CardContent } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Separator } from '@zap_client/components/ui/separator';
import { PlusCircle, Save, Upload, Download, Eraser, Search, Settings, Play, Zap, Maximize, Minimize, MessageSquareText, List, MousePointerClick, Image as ImageIconLJ, Headphones, Share2, Clock, Shuffle, Tag as TagIconLJ, VariableIcon, CloudCog, DatabaseZap, LogOut, HelpCircle, Webhook } from 'lucide-react'; // Renomeado ícones para evitar conflito
// CORRIGIDO: Tentativa de caminho relativo para useToast
import { useToast } from '../hooks/use-toast'; 


const nodeTypes: NodeTypes = {
  // Usar ReactFlowNodeProps<T> para os componentes de nó
  [FlowNodeType.TRIGGER]: TriggerNodeComponent as React.ComponentType<ReactFlowNodeProps<TriggerNodeData>>,
  [FlowNodeType.TEXT_MESSAGE]: TextMessageNodeComponent as React.ComponentType<ReactFlowNodeProps<TextMessageNodeData>>,
  [FlowNodeType.QUESTION]: QuestionNodeComponent as React.ComponentType<ReactFlowNodeProps<QuestionNodeData>>,
  [FlowNodeType.LIST_MESSAGE]: ListMessageNodeComponent as React.ComponentType<ReactFlowNodeProps<ListMessageNodeData>>,
  [FlowNodeType.BUTTONS_MESSAGE]: ButtonsMessageNodeComponent as React.ComponentType<ReactFlowNodeProps<ButtonsMessageNodeData>>,
  [FlowNodeType.MEDIA_MESSAGE]: MediaMessageNodeComponent as React.ComponentType<ReactFlowNodeProps<MediaMessageNodeData>>,
  [FlowNodeType.CONDITION]: ConditionNodeComponent as React.ComponentType<ReactFlowNodeProps<ConditionNodeData>>,
  [FlowNodeType.DELAY]: DelayNodeComponent as React.ComponentType<ReactFlowNodeProps<DelayNodeData>>,
  [FlowNodeType.ACTION]: ActionNodeComponent as React.ComponentType<ReactFlowNodeProps<ActionNodeData>>,
  [FlowNodeType.GPT_QUERY]: GptQueryNodeComponent as React.ComponentType<ReactFlowNodeProps<GptQueryNodeData>>,
  [FlowNodeType.AI_DECISION]: AiDecisionNodeComponent as React.ComponentType<ReactFlowNodeProps<AiDecisionNodeData>>,
  [FlowNodeType.CLONED_VOICE_NODE]: ClonedVoiceNodeComponent as React.ComponentType<ReactFlowNodeProps<ClonedVoiceNodeData>>,
  [FlowNodeType.TAG_CONTACT]: TagContactNodeComponent as React.ComponentType<ReactFlowNodeProps<TagContactNodeData>>,
  [FlowNodeType.SET_VARIABLE]: SetVariableNodeComponent as React.ComponentType<ReactFlowNodeProps<SetVariableNodeData>>,
  [FlowNodeType.EXTERNAL_DATA]: ExternalDataNodeComponent as React.ComponentType<ReactFlowNodeProps<ExternalDataNodeData>>,
  [FlowNodeType.API_CALL]: ApiCallNodeComponent as React.ComponentType<ReactFlowNodeProps<ApiCallNodeData>>,
  [FlowNodeType.END]: EndNodeComponent as React.ComponentType<ReactFlowNodeProps<EndNodeData>>,
};

interface ZapFlowBuilderProps {
  initialFlowData?: FlowData; 
  onSaveFlow: (flowData: FlowData) => Promise<void>; 
  flowId?: string;
}

const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ initialFlowData, onSaveFlow, flowId }) => {
  const initialNodes = useMemo(() => initialFlowData?.nodes || [], [initialFlowData]);
  const initialEdges = useMemo(() => initialFlowData?.edges || [], [initialFlowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [flowName, setFlowName] = useState(initialFlowData?.name || 'Novo Fluxo');
  const [flowDescription, setFlowDescription] = useState(initialFlowData?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const reactFlowInstance = useReactFlow<FlowNodeData, FlowEdgeData | undefined>(); // Ajustado para FlowEdgeData | undefined
  const { toast } = useToast();

  useEffect(() => {
    if (initialFlowData) {
      setNodes(initialFlowData.nodes);
      setEdges(initialFlowData.edges);
      setFlowName(initialFlowData.name || 'Novo Fluxo');
      setFlowDescription(initialFlowData.description || '');
    } else { 
        setNodes([]);
        setEdges([]);
        setFlowName('Novo Fluxo');
        setFlowDescription('');
    }
  }, [initialFlowData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | CustomFlowEdge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const getNodeId = () => `zapnode_${nanoid(8)}`;

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType;
      if (!type || !Object.values(FlowNodeType).includes(type)) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNodeId = getNodeId();
      let nodeSpecificData: FlowNodeData; 

      const baseData: BaseNodeData = { label: type.replace('Node',''), nodeType: type };

      switch (type) {
        case FlowNodeType.TRIGGER:
          nodeSpecificData = { ...baseData, label: 'Gatilho', triggerType: 'keyword', keywords: ['oi'] } as TriggerNodeData;
          break;
        case FlowNodeType.TEXT_MESSAGE:
          nodeSpecificData = { ...baseData, label: 'Mensagem Texto', message: 'Olá!' } as TextMessageNodeData;
          break;
        case FlowNodeType.QUESTION:
          nodeSpecificData = { ...baseData, label: 'Pergunta', questionText: 'Qual sua dúvida?', expectedResponseType: 'text', variableToStoreAnswer: 'user_reply', options: [{id: 'opt1', label:'Opção 1', value: 'val1'}] } as QuestionNodeData;
          break;
        case FlowNodeType.LIST_MESSAGE:
          nodeSpecificData = { ...baseData, label: 'Mensagem Lista', bodyText: 'Selecione uma opção:', buttonText: 'Opções', sections: [{ id: 'sec1', title: 'Seção 1', rows: [{id: 'item1', title: 'Item 1'}]}] } as ListMessageNodeData;
          break;
        case FlowNodeType.BUTTONS_MESSAGE:
          nodeSpecificData = { ...baseData, label: 'Mensagem Botões', bodyText: 'Escolha uma ação:', buttons: [{id: 'btn1', type: 'reply', title: 'Opção A'}] } as ButtonsMessageNodeData;
          break;
         case FlowNodeType.MEDIA_MESSAGE:
          nodeSpecificData = { ...baseData, label: 'Mensagem Mídia', mediaType: 'image', media: { url: '', caption: '' } } as MediaMessageNodeData;
          break;
        case FlowNodeType.CONDITION:
          nodeSpecificData = { ...baseData, label: 'Condição', branchConfigs: [{ id: `branch-${newNodeId}-true`, handleId: `output-true-${newNodeId}`, label: 'Verdadeiro', rules: [], logicalOperator: 'AND' }, { id: `branch-${newNodeId}-false`, handleId: `output-false-${newNodeId}`, label: 'Falso', rules: [], logicalOperator: 'AND' }] } as ConditionNodeData;
          break;
        case FlowNodeType.DELAY:
          nodeSpecificData = { ...baseData, label: 'Aguardar', delayDuration: 5, delayUnit: 'seconds' } as DelayNodeData;
          break;
        case FlowNodeType.ACTION:
          nodeSpecificData = { ...baseData, label: 'Ação', actionType: ActionType.ADD_TAG, actionParams: { tagName: 'novo_lead' } } as ActionNodeData;
          break;
        case FlowNodeType.SET_VARIABLE:
            nodeSpecificData = { ...baseData, label: 'Definir Variável', assignments: [{id: 'asg1', variableName: 'myVar', value: '', sourceType: 'static'}] } as SetVariableNodeData;
            break;
        case FlowNodeType.TAG_CONTACT:
            nodeSpecificData = { ...baseData, label: 'Etiquetar Contato', tagName: 'tagged', tagOperation: 'add' } as TagContactNodeData;
            break;
        case FlowNodeType.GPT_QUERY:
            nodeSpecificData = { ...baseData, label: 'Consulta GPT', prompt: 'Resuma: {{userInput}}', variableToStoreResponse: 'gpt_response' } as GptQueryNodeData;
            break;
        case FlowNodeType.API_CALL:
            nodeSpecificData = { ...baseData, label: 'Chamada API', apiUrl: '', method: 'GET', variableToStoreResponse: 'api_data' } as ApiCallNodeData;
            break;
        case FlowNodeType.AI_DECISION:
            nodeSpecificData = { ...baseData, label: 'Decisão IA', contextPrompt: 'O usuário quer comprar ou pedir suporte?', possibleOutcomes: [{id: 'out1', label: 'Comprar', value: 'buy', handleId: `buy-${newNodeId}`}, {id: 'out2', label: 'Suporte', value: 'support', handleId: `support-${newNodeId}`}] } as AiDecisionNodeData;
            break;
        case FlowNodeType.EXTERNAL_DATA:
            nodeSpecificData = { ...baseData, label: 'Dados Externos', dataSourceUrl: '', requestType: 'GET', responseMapping: []} as ExternalDataNodeData;
            break;
        case FlowNodeType.CLONED_VOICE_NODE:
            nodeSpecificData = { ...baseData, label: 'Voz Clonada', textToSpeak: 'Olá, como posso ajudar?', voiceId: 'default' } as ClonedVoiceNodeData;
            break;
        case FlowNodeType.END:
            nodeSpecificData = { ...baseData, label: 'Fim do Fluxo', endStateType: 'completed' } as EndNodeData;
            break;
        default: 
          const exhaustiveCheck: never = type; 
          nodeSpecificData = { ...baseData, label: `Novo ${type.replace('Node', '')}` }; // Fallback, mas type deve ser FlowNodeType
      }

      const newNode: CustomFlowNode = {
        id: newNodeId, 
        type: type as CustomFlowNodeType, // Cast é seguro devido à checagem acima
        position,
        data: nodeSpecificData, 
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes] // Removido 'options' se não estiver definido globalmente
  );

  const handleSave = async () => {
    setIsSaving(true);
    const currentNodes: CustomFlowNode[] = reactFlowInstance.getNodes();
    const currentEdges: CustomFlowEdge[] = reactFlowInstance.getEdges();

    const flowToSave: FlowData = {
      id: flowId || initialFlowData?.id || `flow_${nanoid()}`,
      name: flowName,
      description: flowDescription,
      nodes: currentNodes, 
      edges: currentEdges,   
    };
    try {
      await onSaveFlow(flowToSave);
      toast({ title: 'Fluxo Salvo!', description: 'Suas alterações foram salvas com sucesso.' });
    } catch (error) {
      console.error("Erro ao salvar fluxo:", error);
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar o fluxo: ${String(error)}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const SidebarNodeItem = ({ type, label, icon: Icon }: { type: FlowNodeType; label: string; icon: React.ElementType }) => (
    <div
      onDragStart={(event: React.DragEvent<HTMLDivElement>) => { // Tipado event
        event.dataTransfer.setData('application/reactflow', type);
        event.dataTransfer.effectAllowed = 'move';
      }}
      draggable
      className="p-2 border rounded-md cursor-grab flex items-center gap-2 hover:bg-muted neu-card-sm"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs">{label}</span>
    </div>
  );

  const toggleFullScreen = () => {
    const elem = document.querySelector('.reactflow-wrapper-fullscreen-target') || document.documentElement;
    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err: Error) => console.error("Erro ao entrar em tela cheia:", err)); // Tipado err
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err: Error) => console.error("Erro ao sair da tela cheia:", err)); // Tipado err
      }
    }
  };
  
  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);


  return (
    <div className={`flex flex-col h-[calc(100vh-220px)] border rounded-lg shadow-sm ${isFullScreen ? 'fixed inset-0 z-[100] bg-background reactflow-wrapper-fullscreen-target' : 'relative reactflow-wrapper-fullscreen-target'}`}>
      <div className="p-2 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <Input
            value={flowName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFlowName(e.target.value)}
            placeholder="Nome do Fluxo"
            className="text-md font-semibold h-9 w-auto max-w-xs neu-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} size="sm" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
            {isSaving ? <Save className="h-4 w-4 mr-1 animate-pulse" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar Fluxo
          </Button>
          <Button onClick={toggleFullScreen} variant="outline" size="sm">
            {isFullScreen ? <Minimize className="h-4 w-4 mr-1" /> : <Maximize className="h-4 w-4 mr-1" />}
             {isFullScreen ? "Sair Tela Cheia" : "Tela Cheia"}
          </Button>
        </div>
      </div>
       <Input
            value={flowDescription}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFlowDescription(e.target.value)}
            placeholder="Descrição breve do fluxo..."
            className="text-xs border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-1.5 neu-input-flat"
        />
      <div className="flex-grow flex">
        {!isFullScreen && (
          <Card className="w-60 border-0 border-r rounded-none p-0">
            <CardContent className="p-2 h-full">
              <p className="text-xs font-semibold mb-2 px-1">Arraste os Nós:</p>
              <ScrollArea className="h-[calc(100%-30px)]">
                <div className="space-y-2 p-1">
                  <SidebarNodeItem type={FlowNodeType.TRIGGER} label="Gatilho" icon={Play} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.TEXT_MESSAGE} label="Msg. Texto" icon={MessageSquareText} />
                  <SidebarNodeItem type={FlowNodeType.QUESTION} label="Pergunta" icon={HelpCircle} />
                  <SidebarNodeItem type={FlowNodeType.LIST_MESSAGE} label="Msg. Lista" icon={List} />
                  <SidebarNodeItem type={FlowNodeType.BUTTONS_MESSAGE} label="Msg. Botões" icon={MousePointerClick} />
                  <SidebarNodeItem type={FlowNodeType.MEDIA_MESSAGE} label="Msg. Mídia" icon={ImageIconLJ} /> {/* Renomeado para ImageIconLJ */}
                  <SidebarNodeItem type={FlowNodeType.CLONED_VOICE_NODE} label="Voz Clonada" icon={Headphones} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.CONDITION} label="Condição" icon={Share2} />
                  <SidebarNodeItem type={FlowNodeType.DELAY} label="Aguardar" icon={Clock} />
                  <SidebarNodeItem type={FlowNodeType.ACTION} label="Ação" icon={Settings} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.SET_VARIABLE} label="Definir Variável" icon={VariableIcon} />
                  <SidebarNodeItem type={FlowNodeType.TAG_CONTACT} label="Etiquetar Contato" icon={TagIconLJ} /> {/* Renomeado para TagIconLJ */}
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.GPT_QUERY} label="Consulta GPT" icon={CloudCog} />
                  <SidebarNodeItem type={FlowNodeType.AI_DECISION} label="Decisão IA" icon={Shuffle} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.API_CALL} label="Chamada API" icon={Webhook} />
                  <SidebarNodeItem type={FlowNodeType.EXTERNAL_DATA} label="Dados Externos" icon={DatabaseZap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.END} label="Fim do Fluxo" icon={LogOut} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        <div className="flex-grow h-full" onDrop={onDrop} onDragOver={onDragOver}> {/* Corrigido ondragover para onDragOver */}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background dark:bg-gray-800"
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Panel position="top-right">
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

const ZapFlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ZapFlowBuilderInternal {...props} />
    </ReactFlowProvider>
  );
};

export default memo(ZapFlowBuilderWrapper);
