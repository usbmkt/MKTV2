// MKTV2/zap/client/src/components/ZapFlowBuilder.tsx
import React, { useState, useCallback, useEffect, useRef, ComponentType } from 'react'; // Adicionado ComponentType
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  MiniMap,
  BackgroundVariant,
  Panel,
  NodeProps,
  ReactFlowInstance,
  NodeTypes 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TextMessageNode from '@zap_client/components/flow_builder_nodes/TextMessageNode';
import QuestionNode from '@zap_client/components/flow_builder_nodes/QuestionNode';
import ConditionNode from '@zap_client/components/flow_builder_nodes/ConditionNode';
import ActionNode from '@zap_client/components/flow_builder_nodes/ActionNode';
import DelayNode from '@zap_client/components/flow_builder_nodes/DelayNode';
import TriggerNode from '@zap_client/components/flow_builder_nodes/TriggerNode';
import EndNode from '@zap_client/components/flow_builder_nodes/EndNode';
import ListMessageNode from '@zap_client/components/flow_builder_nodes/ListMessageNode';
import ButtonsMessageNode from '@zap_client/components/flow_builder_nodes/ButtonsMessageNode';
import MediaMessageNode from '@zap_client/components/flow_builder_nodes/MediaMessageNode';
import GPTQueryNode from '@zap_client/components/flow_builder_nodes/GptQueryNode'; // Corrigido para GPTQueryNode
import AiDecisionNode from '@zap_client/components/flow_builder_nodes/AiDecisionNode';
import ClonedVoiceNode from '@zap_client/components/flow_builder_nodes/ClonedVoiceNode';
import TagContactNode from '@zap_client/components/flow_builder_nodes/TagContactNode';
import SetVariableNode from '@zap_client/components/flow_builder_nodes/SetVariableNode';
import ExternalDataNode from '@zap_client/components/flow_builder_nodes/ExternalDataNode';
import ApiCallNode from '@zap_client/components/flow_builder_nodes/ApiCallNode';

import {
  TriggerNodeData, TextMessageNodeData, QuestionNodeData, ConditionNodeData,
  ActionNodeData, DelayNodeData, EndNodeData, ListMessageNodeData, 
  ButtonsMessageNodeData, MediaMessageNodeData, GPTQueryNodeData, // Corrigido para GPTQueryNodeData
  AiDecisionNodeData, ClonedVoiceNodeData, TagContactNodeData, SetVariableNodeData, 
  ExternalDataFetchNodeData, 
  ApiCallNodeData,
  CustomNodeDataType, // Importar a união
  ZapFlowNode // Importar o tipo de nó customizado
} from '@zap_client/features/types/whatsapp_flow_types';

import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input'; 
import { PlusCircle, Save, Trash2, Loader2 } from 'lucide-react'; 

export interface ZapFlowBuilderProps {
  flowId: string;
  initialNodes?: ZapFlowNode[]; // Usar ZapFlowNode
  initialEdges?: Edge[];
  initialFlowName?: string | null;
  onSaveFlow?: (flowId: string, nodes: ZapFlowNode[], edges: Edge[], name?: string) => Promise<void>;
  onLoadFlow?: (flowId: string) => Promise<{ nodes: ZapFlowNode[], edges: Edge[], name?: string } | null>;
  onCloseEditor?: () => void;
  onSaveSuccess?: (flowId: string, flowName: string) => void;
}

// Tipagem mais precisa para NodeTypes
// O ReactFlow espera ComponentType<NodeProps<T>> onde T são os dados do nó.
const nodeTypes: NodeTypes = {
  trigger: TriggerNode as ComponentType<NodeProps<TriggerNodeData>>,
  textMessage: TextMessageNode as ComponentType<NodeProps<TextMessageNodeData>>,
  question: QuestionNode as ComponentType<NodeProps<QuestionNodeData>>,
  listMessage: ListMessageNode as ComponentType<NodeProps<ListMessageNodeData>>,
  buttonsMessage: ButtonsMessageNode as ComponentType<NodeProps<ButtonsMessageNodeData>>,
  mediaMessage: MediaMessageNode as ComponentType<NodeProps<MediaMessageNodeData>>,
  condition: ConditionNode as ComponentType<NodeProps<ConditionNodeData>>,
  delay: DelayNode as ComponentType<NodeProps<DelayNodeData>>,
  action: ActionNode as ComponentType<NodeProps<ActionNodeData>>,
  gptQuery: GPTQueryNode as ComponentType<NodeProps<GPTQueryNodeData>>,
  aiDecision: AiDecisionNode as ComponentType<NodeProps<AiDecisionNodeData>>,
  clonedVoice: ClonedVoiceNode as ComponentType<NodeProps<ClonedVoiceNodeData>>,
  tagContact: TagContactNode as ComponentType<NodeProps<TagContactNodeData>>,
  setVariable: SetVariableNode as ComponentType<NodeProps<SetVariableNodeData>>,
  externalData: ExternalDataNode as ComponentType<NodeProps<ExternalDataFetchNodeData>>,
  apiCall: ApiCallNode as ComponentType<NodeProps<ApiCallNodeData>>,
  end: EndNode as ComponentType<NodeProps<EndNodeData>>,
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };

const ZapFlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = ({
  flowId,
  initialNodes: initialNodesProp,
  initialEdges: initialEdgesProp,
  initialFlowName,
  onSaveFlow,
  onLoadFlow,
  onCloseEditor,
  onSaveSuccess,
}) => {
  const [nodes, setNodes] = useState<ZapFlowNode[]>(initialNodesProp || []); // Usar ZapFlowNode
  const [edges, setEdges] = useState<Edge[]>(initialEdgesProp || []);
  const [flowName, setFlowName] = useState(initialFlowName || `Fluxo ${flowId}`);
  const [isLoading, setIsLoading] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<CustomNodeDataType, Edge> | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      // Garantir que defaultInitialNodes use ZapFlowNode e TriggerNodeData
      const defaultInitialNodes: ZapFlowNode[] = [{ 
        id: 'trigger_0', 
        type: 'trigger', 
        position: { x: 250, y: 5 }, 
        data: { label: 'Início do Fluxo' } as TriggerNodeData // Cast para o tipo de dados específico
      }];
      
      if (onLoadFlow && flowId && flowId !== 'new') {
        try {
          const loadedData = await onLoadFlow(flowId);
          if (loadedData) {
            setNodes(loadedData.nodes || defaultInitialNodes);
            setEdges(loadedData.edges || []);
            if(loadedData.name) setFlowName(loadedData.name);
            else setFlowName(`Fluxo ${flowId}`);
          } else {
            setNodes(defaultInitialNodes);
            setEdges([]);
            setFlowName(initialFlowName || `Novo Fluxo`);
          }
        } catch (error) {
          console.error("Erro ao carregar fluxo:", error);
           setNodes(defaultInitialNodes);
           setEdges([]);
           setFlowName(initialFlowName || `Fluxo (Erro ao Carregar)`);
        }
      } else {
         setNodes(defaultInitialNodes);
         setEdges([]);
         setFlowName(initialFlowName || `Novo Fluxo`);
      }
      setIsLoading(false);
    };
    if(flowId) load(); else setIsLoading(false);
  }, [flowId, onLoadFlow, initialFlowName]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const addNode = (type: keyof typeof nodeTypes) => {
    const newNodeId = `${type}_${nodes.length + Date.now()}`;
    let initialData: Partial<CustomNodeDataType> = { label: `Novo ${type}` }; 

    const newNode: ZapFlowNode = { 
      id: newNodeId,
      type,
      position: {
        x: Math.random() * (reactFlowWrapper.current?.clientWidth || 800) * 0.7,
        y: Math.random() * (reactFlowWrapper.current?.clientHeight || 600) * 0.7,
      },
      data: initialData as CustomNodeDataType, 
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = async () => {
    if (onSaveFlow) {
      setIsLoading(true);
      try {
        if (flowName) {
            await onSaveFlow(flowId, nodes, edges, flowName);
            if (onSaveSuccess) onSaveSuccess(flowId, flowName);
            alert('Fluxo salvo com sucesso!'); // Substituir por toast
        } else {
            alert('Nome do fluxo é necessário para salvar.'); // Substituir por toast
        }
      } catch (error) {
        console.error("Erro ao salvar fluxo:", error);
        alert('Falha ao salvar o fluxo.'); // Substituir por toast
      }
      setIsLoading(false);
    }
  };
  
  const handleDeleteFlow = () => {
    if (window.confirm(`Tem certeza que deseja excluir o fluxo "${flowName}"?`)) {
      console.log("Excluir fluxo:", flowId);
      if (onCloseEditor) onCloseEditor();
    }
  };

  if (isLoading && flowId && flowId !== 'new') {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /> Carregando fluxo...</div>;
  }

  return (
    <div className="h-[calc(100vh-250px)] md:h-[calc(100vh-200px)] w-full border rounded-lg shadow-md neu-card overflow-hidden" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes} 
        defaultViewport={defaultViewport}
        fitView
        onInit={setRfInstance as (instance: ReactFlowInstance<any, any>) => void}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Panel position="top-left" className="p-2 space-x-2 flex bg-background/80 rounded-md shadow">
            <Input 
                value={flowName} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFlowName(e.target.value)} 
                placeholder="Nome do Fluxo"
                className="border-border w-auto text-xs h-8 neu-input"
            />
        </Panel>
        <Panel position="top-right" className="p-2 space-x-1 flex bg-background/80 rounded-md shadow">
          <Button onClick={() => addNode('trigger')} size="sm" variant="outline" className="neu-button text-xs">Trigger</Button>
          <Button onClick={() => addNode('textMessage')} size="sm" variant="outline" className="neu-button text-xs">Texto</Button>
          <Button onClick={() => addNode('condition')} size="sm" variant="outline" className="neu-button text-xs">Condição</Button>
          <Button onClick={() => addNode('end')} size="sm" variant="outline" className="neu-button text-xs">Fim</Button>
          
          <Button onClick={handleSave} size="sm" variant="default" className="neu-button-primary text-xs" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Salvar
          </Button>
          {flowId && flowId !== 'new' && ( 
            <Button onClick={handleDeleteFlow} size="sm" variant="destructive" className="text-xs">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
            </Button>
          )}
           {onCloseEditor && (
             <Button onClick={onCloseEditor} size="sm" variant="outline" className="neu-button text-xs">
                Fechar
             </Button>
           )}
        </Panel>
      </ReactFlow>
    </div>
  );
};
export default ZapFlowBuilderWrapper;
