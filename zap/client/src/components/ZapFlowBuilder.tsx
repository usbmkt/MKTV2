import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
    NodeProps,
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
  FlowNodeData,   // Tipo para `node.data`
  TriggerNodeData,
  TextMessageNodeData,
  QuestionNodeData,
  ListMessageNodeData,
  ButtonsMessageNodeData,
  MediaMessageNodeData,
  ConditionNodeData,
  DelayNodeData,
  ActionNodeData,
  ActionType, // Adicionado para uso em default node data
  GptQueryNodeData,
  AiDecisionNodeData,
  ClonedVoiceNodeData,
  TagContactNodeData,
  SetVariableNodeData,
  ExternalDataNodeData,
  ApiCallNodeData,
  EndNodeData,
  FlowEdgeData, 
  CustomFlowNodeType, // Adicionado para cast em onDrop
} from '@zap_client/features/types/whatsapp_flow_types';

import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Card, CardContent } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Separator } from '@zap_client/components/ui/separator';
import { PlusCircle, Save, Upload, Download, Eraser, Search, Settings, Play, Zap, Maximize, Minimize, MessageSquareText, List, MousePointerClick, Image as ImageIcon, Headphones, Share2, Clock, Shuffle, Tag, VariableIcon, CloudCog, DatabaseZap, LogOut, HelpCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useToast } from '@zap_client/hooks/use-toast'; // Mantendo @zap_client, verificar build e existência do arquivo


// Correção: Tipar explicitamente os componentes para NodeTypes
// NodeProps<T> onde T é o tipo específico de data do nó.
const nodeTypes: NodeTypes = {
  [FlowNodeType.TRIGGER]: TriggerNodeComponent as React.ComponentType<NodeProps<TriggerNodeData>>,
  [FlowNodeType.TEXT_MESSAGE]: TextMessageNodeComponent as React.ComponentType<NodeProps<TextMessageNodeData>>,
  [FlowNodeType.QUESTION]: QuestionNodeComponent as React.ComponentType<NodeProps<QuestionNodeData>>,
  [FlowNodeType.LIST_MESSAGE]: ListMessageNodeComponent as React.ComponentType<NodeProps<ListMessageNodeData>>,
  [FlowNodeType.BUTTONS_MESSAGE]: ButtonsMessageNodeComponent as React.ComponentType<NodeProps<ButtonsMessageNodeData>>,
  [FlowNodeType.MEDIA_MESSAGE]: MediaMessageNodeComponent as React.ComponentType<NodeProps<MediaMessageNodeData>>,
  [FlowNodeType.CONDITION]: ConditionNodeComponent as React.ComponentType<NodeProps<ConditionNodeData>>,
  [FlowNodeType.DELAY]: DelayNodeComponent as React.ComponentType<NodeProps<DelayNodeData>>,
  [FlowNodeType.ACTION]: ActionNodeComponent as React.ComponentType<NodeProps<ActionNodeData>>,
  [FlowNodeType.GPT_QUERY]: GptQueryNodeComponent as React.ComponentType<NodeProps<GptQueryNodeData>>,
  [FlowNodeType.AI_DECISION]: AiDecisionNodeComponent as React.ComponentType<NodeProps<AiDecisionNodeData>>,
  [FlowNodeType.CLONED_VOICE_NODE]: ClonedVoiceNodeComponent as React.ComponentType<NodeProps<ClonedVoiceNodeData>>,
  [FlowNodeType.TAG_CONTACT]: TagContactNodeComponent as React.ComponentType<NodeProps<TagContactNodeData>>,
  [FlowNodeType.SET_VARIABLE]: SetVariableNodeComponent as React.ComponentType<NodeProps<SetVariableNodeData>>,
  [FlowNodeType.EXTERNAL_DATA]: ExternalDataNodeComponent as React.ComponentType<NodeProps<ExternalDataNodeData>>,
  [FlowNodeType.API_CALL]: ApiCallNodeComponent as React.ComponentType<NodeProps<ApiCallNodeData>>,
  [FlowNodeType.END]: EndNodeComponent as React.ComponentType<NodeProps<EndNodeData>>,
};

interface ZapFlowBuilderProps {
  initialFlowData?: FlowData;
  onSaveFlow: (flowData: FlowData) => Promise<void>;
  flowId?: string;
}

const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ initialFlowData, onSaveFlow, flowId }) => {
  // Correção: `useNodesState` e `useEdgesState` são genéricos sobre o TIPO DE DADOS do nó/aresta, não o objeto Node/Edge completo.
  // No entanto, o estado que eles gerenciam É um array de Node<TData> ou Edge<EData>.
  // O `initialFlowData?.nodes` já é CustomFlowNode[] (ou seja, Node<FlowNodeData>[]).
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowData?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowData?.edges || []);
  
  const [flowName, setFlowName] = useState(initialFlowData?.name || 'Novo Fluxo');
  const [flowDescription, setFlowDescription] = useState(initialFlowData?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const reactFlowInstance = useReactFlow<FlowNodeData, FlowEdgeData>(); // Tipos de dados para os genéricos
  const { toast } = useToast();

  useEffect(() => {
    if (initialFlowData) {
      // O estado inicial já deve ser do tipo Node<FlowNodeData>[] e Edge<FlowEdgeData>[]
      setNodes(initialFlowData.nodes);
      setEdges(initialFlowData.edges);
      setFlowName(initialFlowData.name || 'Novo Fluxo');
      setFlowDescription(initialFlowData.description || '');
    }
  }, [initialFlowData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const getNodeId = () => `dndnode_${nanoid()}`;

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
      
      const baseId = getNodeId();
      let specificNodeData: FlowNodeData; // Tipo base para todos os dados de nó

      // Default data para cada tipo de nó
      switch (type) {
        case FlowNodeType.TRIGGER:
          specificNodeData = { id: baseId, label: 'Gatilho', nodeType: type, triggerType: 'keyword', keywords: ['oi'] } as TriggerNodeData;
          break;
        case FlowNodeType.TEXT_MESSAGE:
          specificNodeData = { id: baseId, label: 'Mensagem Texto', nodeType: type, message: 'Olá!' } as TextMessageNodeData;
          break;
        case FlowNodeType.QUESTION:
          specificNodeData = { id: baseId, label: 'Pergunta', nodeType: type, questionText: 'Qual sua dúvida?', expectedResponseType: 'text', variableToStoreAnswer: 'user_reply' } as QuestionNodeData;
          break;
        case FlowNodeType.LIST_MESSAGE:
          specificNodeData = { id: baseId, label: 'Mensagem Lista', nodeType: type, bodyText: 'Selecione uma opção:', buttonText: 'Opções', sections: [{ title: 'Seção 1', rows: [{id: 'item1', title: 'Item 1'}]}] } as ListMessageNodeData;
          break;
        case FlowNodeType.BUTTONS_MESSAGE:
          specificNodeData = { id: baseId, label: 'Mensagem Botões', nodeType: type, bodyText: 'Escolha uma ação:', buttons: [{id: 'btn1', type: 'reply', title: 'Opção A'}] } as ButtonsMessageNodeData;
          break;
        case FlowNodeType.MEDIA_MESSAGE:
          specificNodeData = { id: baseId, label: 'Mensagem Mídia', nodeType: type, mediaType: 'image', media: { url: 'https://via.placeholder.com/150', caption: 'Exemplo de imagem' } } as MediaMessageNodeData;
          break;
        case FlowNodeType.CONDITION:
          specificNodeData = { id: baseId, label: 'Condição', nodeType: type, branchConfigs: [{ handleId: 'trueOutput', label: 'Verdadeiro', rules: [], logicalOperator: 'AND' }] } as ConditionNodeData;
          break;
        case FlowNodeType.DELAY:
          specificNodeData = { id: baseId, label: 'Aguardar', nodeType: type, delayDuration: 5, delayUnit: 'seconds' } as DelayNodeData;
          break;
        case FlowNodeType.ACTION:
          specificNodeData = { id: baseId, label: 'Ação', nodeType: type, actionType: ActionType.ADD_TAG, actionParams: { tagName: 'novo_lead' } } as ActionNodeData;
          break;
        // Adicionar outros cases conforme necessário, garantindo que 'id', 'label', e 'nodeType' estejam presentes.
        default:
          specificNodeData = { id: baseId, label: `Novo ${type.replace('Node', '')}`, nodeType: type } as FlowNodeData; // Fallback genérico
      }

      const newNode: CustomFlowNode = {
        id: baseId, 
        type: type as CustomFlowNodeType,
        position,
        data: specificNodeData, // Agora specificNodeData é do tipo FlowNodeData (união de todos os ...NodeData)
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleSave = async () => {
    setIsSaving(true);
    const flowToSave: FlowData = {
      id: flowId || initialFlowData?.id || `flow_${nanoid()}`,
      name: flowName,
      description: flowDescription,
      nodes: reactFlowInstance.getNodes(), // reactFlowInstance.getNodes() já retorna Node<FlowNodeData>[]
      edges: reactFlowInstance.getEdges(),   // reactFlowInstance.getEdges() já retorna Edge<FlowEdgeData>[]
    };
    try {
      await onSaveFlow(flowToSave);
      toast({ title: 'Fluxo Salvo!', description: 'Suas alterações foram salvas com sucesso.' });
    } catch (error) {
      console.error("Erro ao salvar fluxo:", error);
      toast({ title: 'Erro ao Salvar', description: 'Não foi possível salvar o fluxo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const SidebarNodeItem = ({ type, label, icon: Icon }: { type: FlowNodeType; label: string; icon: React.ElementType }) => (
    <div
      onDragStart={(event) => {
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
    if (!isFullScreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.error("Erro ao entrar em tela cheia:", err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Erro ao sair da tela cheia:", err));
      }
    }
    // O estado isFullScreen será atualizado pelo event listener
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
            onChange={(e) => setFlowName(e.target.value)}
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
            onChange={(e) => setFlowDescription(e.target.value)}
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
                  <SidebarNodeItem type={FlowNodeType.MEDIA_MESSAGE} label="Msg. Mídia" icon={ImageIcon} />
                  <SidebarNodeItem type={FlowNodeType.CLONED_VOICE_NODE} label="Voz Clonada" icon={Headphones} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.CONDITION} label="Condição" icon={Share2} />
                  <SidebarNodeItem type={FlowNodeType.DELAY} label="Aguardar" icon={Clock} />
                  <SidebarNodeItem type={FlowNodeType.ACTION} label="Ação" icon={Settings} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.SET_VARIABLE} label="Definir Variável" icon={VariableIcon} />
                  <SidebarNodeItem type={FlowNodeType.TAG_CONTACT} label="Etiquetar Contato" icon={Tag} />
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
        <div className="flex-grow h-full" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background dark:bg-gray-800" // Garante que o fundo do ReactFlow corresponda ao tema
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Panel position="top-right">
              {/* Futuro painel de configuração de nó */}
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
