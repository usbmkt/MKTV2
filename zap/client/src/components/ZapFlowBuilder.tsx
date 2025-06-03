import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Edge, Node, Panel, NodeTypes, ReactFlowProvider, useReactFlow, NodeProps, BackgroundVariant } from '@xyflow/react';

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
import GptQueryNodeComponent from '@zap_client/components/flow_builder_nodes/GptQueryNode'; // Corrigido Case
import AiDecisionNodeComponent from '@zap_client/components/flow_builder_nodes/AiDecisionNode';
import ClonedVoiceNodeComponent from '@zap_client/components/flow_builder_nodes/ClonedVoiceNode';
import TagContactNodeComponent from '@zap_client/components/flow_builder_nodes/TagContactNode';
import SetVariableNodeComponent from '@zap_client/components/flow_builder_nodes/SetVariableNode';
import ExternalDataNodeComponent from '@zap_client/components/flow_builder_nodes/ExternalDataNode'; // Corrigido Case
import ApiCallNodeComponent from '@zap_client/components/flow_builder_nodes/ApiCallNode';
import EndNodeComponent from '@zap_client/components/flow_builder_nodes/EndNode';

// Importações de Tipos (usando alias @zap_client)
import {
  FlowNodeType,
  CustomFlowNode, // Usar este tipo para os nós
  CustomFlowEdge, // Usar este tipo para as arestas
  FlowData,       // Para a estrutura geral do fluxo
  FlowNodeData,   // Tipo base para `node.data`
  TriggerNodeData,
  TextMessageNodeData,
  QuestionNodeData,
  ListMessageNodeData,
  ButtonsMessageNodeData,
  MediaMessageNodeData,
  ConditionNodeData,
  DelayNodeData,
  ActionNodeData,
  GptQueryNodeData, // Corrigido Case
  AiDecisionNodeData,
  ClonedVoiceNodeData,
  TagContactNodeData,
  SetVariableNodeData,
  ExternalDataNodeData, // Corrigido Case
  ApiCallNodeData,
  EndNodeData,
} from '@zap_client/features/types/whatsapp_flow_types'; // Corrigido para o caminho dentro do zap

import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Card, CardContent } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Separator } from '@zap_client/components/ui/separator';
import { PlusCircle, Save, Upload, Download, Eraser, Search, Settings, Play, Zap, Maximize, Minimize } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useToast } from '@zap_client/hooks/use-toast'; // Corrigido para o caminho dentro do zap

// Definição dos tipos de nó para ReactFlow
// O ReactFlow espera um objeto onde as chaves são os nomes dos tipos de nó
// e os valores são os componentes React para renderizá-los.
// A tipagem para ComponentType<NodeProps<T>> onde T é o tipo de data específico é importante.
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
  initialFlowData?: FlowData; // Para carregar um fluxo existente
  onSaveFlow: (flowData: FlowData) => Promise<void>; // Função para salvar o fluxo
  // Outras props, como ID do fluxo atual, modo read-only, etc.
  flowId?: string;
}

const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ initialFlowData, onSaveFlow, flowId }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialFlowData?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>(initialFlowData?.edges || []);
  const [flowName, setFlowName] = useState(initialFlowData?.name || 'Novo Fluxo');
  const [flowDescription, setFlowDescription] = useState(initialFlowData?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const reactFlowInstance = useReactFlow<FlowNodeData, FlowEdgeData>();
  const { toast } = useToast();

  useEffect(() => {
    if (initialFlowData) {
      setNodes(initialFlowData.nodes as Node<FlowNodeData>[]); // Cast para Node<FlowNodeData>
      setEdges(initialFlowData.edges as Edge<FlowEdgeData>[]); // Cast para Edge<FlowEdgeData>
      setFlowName(initialFlowData.name || 'Novo Fluxo');
      setFlowDescription(initialFlowData.description || '');
    }
  }, [initialFlowData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds as Edge<FlowEdgeData>[])), // Cast para Edge<FlowEdgeData>
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

      const newNodeData: Partial<FlowNodeData> = { // Usar FlowNodeData para o tipo base
        id: getNodeId(), // ID lógico interno ao data, o React Flow usará seu próprio ID único
        label: type, // Default label
        nodeType: type,
      };

      // Adicionar dados default específicos para cada tipo de nó
      switch (type) {
        case FlowNodeType.TRIGGER:
          (newNodeData as Partial<TriggerNodeData>).triggerType = 'keyword';
          (newNodeData as Partial<TriggerNodeData>).keywords = ['oi'];
          newNodeData.label = 'Gatilho';
          break;
        case FlowNodeType.TEXT_MESSAGE:
          (newNodeData as Partial<TextMessageNodeData>).message = 'Olá!';
          newNodeData.label = 'Mensagem Texto';
          break;
        // Adicionar outros defaults aqui
        default:
          newNodeData.label = `Novo ${type}`;
      }

      const newNode: CustomFlowNode = { // Usar CustomFlowNode
        id: newNodeData.id!, // React Flow ID, pode ser o mesmo que o data.id
        type,
        position,
        data: newNodeData as FlowNodeData, // Cast para o tipo base
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
      nodes: reactFlowInstance.getNodes() as CustomFlowNode[], // Cast para CustomFlowNode
      edges: reactFlowInstance.getEdges() as CustomFlowEdge[],   // Cast para CustomFlowEdge
      // Adicionar outras propriedades como variáveis etc.
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
    const elem = document.documentElement; // Ou um elemento wrapper específico do builder
    if (!isFullScreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullScreen(!isFullScreen);
  };
  
  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);


  return (
    <div className={`flex flex-col h-[calc(100vh-220px)] border rounded-lg shadow-sm ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'relative'}`}>
      {/* Cabeçalho do Builder */}
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
          {/* Outros botões: Importar, Exportar, Limpar Canvas */}
        </div>
      </div>
       <Input
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            placeholder="Descrição breve do fluxo..."
            className="text-xs border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-1.5 neu-input-flat"
        />


      <div className="flex-grow flex">
        {/* Sidebar de Nós */}
        {!isFullScreen && (
          <Card className="w-60 border-0 border-r rounded-none p-0">
            <CardContent className="p-2 h-full">
              <p className="text-xs font-semibold mb-2 px-1">Arraste os Nós:</p>
              <ScrollArea className="h-[calc(100%-30px)]">
                <div className="space-y-2 p-1">
                  <SidebarNodeItem type={FlowNodeType.TRIGGER} label="Gatilho" icon={Play} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.TEXT_MESSAGE} label="Msg. Texto" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.QUESTION} label="Pergunta" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.LIST_MESSAGE} label="Msg. Lista" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.BUTTONS_MESSAGE} label="Msg. Botões" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.MEDIA_MESSAGE} label="Msg. Mídia" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.CLONED_VOICE_NODE} label="Voz Clonada" icon={Zap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.CONDITION} label="Condição" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.DELAY} label="Aguardar" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.ACTION} label="Ação" icon={Zap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.SET_VARIABLE} label="Definir Variável" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.TAG_CONTACT} label="Etiquetar Contato" icon={Zap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.GPT_QUERY} label="Consulta GPT" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.AI_DECISION} label="Decisão IA" icon={Zap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.API_CALL} label="Chamada API" icon={Zap} />
                  <SidebarNodeItem type={FlowNodeType.EXTERNAL_DATA} label="Dados Externos" icon={Zap} />
                  <Separator />
                  <SidebarNodeItem type={FlowNodeType.END} label="Fim do Fluxo" icon={Zap} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Área do ReactFlow */}
        <div className="flex-grow h-full" onDrop={onDrop} onDragOver={onDragOver}>
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
            <Background variant={BackgroundVariant.Dots} gap
