// zap/client/src/components/ZapFlowBuilder.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from '@xyflow/react'; // Alterado para @xyflow/react
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
import GptQueryNode from '@zap_client/components/flow_builder_nodes/GptQueryNode';
import AiDecisionNode from '@zap_client/components/flow_builder_nodes/AiDecisionNode';
import ClonedVoiceNode from '@zap_client/components/flow_builder_nodes/ClonedVoiceNode';
import TagContactNode from '@zap_client/components/flow_builder_nodes/TagContactNode';
import SetVariableNode from '@zap_client/components/flow_builder_nodes/SetVariableNode';
import ExternalDataNode from '@zap_client/components/flow_builder_nodes/ExternalDataNode';
import ApiCallNode from '@zap_client/components/flow_builder_nodes/ApiCallNode';

import { Button } from '@zap_client/components/ui/button'; // Corrigido para @zap_client
import { PlusCircle, Save, Trash2, Zap } from 'lucide-react';

// Defina ZapFlowBuilderProps aqui ou importe se estiver em outro lugar
export interface ZapFlowBuilderProps {
  flowId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialFlowName?: string | null; // Adicionado
  onSaveFlow?: (flowId: string, nodes: Node[], edges: Edge[], name?: string) => Promise<void>;
  onLoadFlow?: (flowId: string) => Promise<{ nodes: Node[], edges: Edge[], name?: string } | null>;
  onCloseEditor?: () => void;
  onSaveSuccess?: (flowId: string, flowName: string) => void;
}

const nodeTypes = {
  trigger: TriggerNode,
  textMessage: TextMessageNode,
  question: QuestionNode,
  listMessage: ListMessageNode,
  buttonsMessage: ButtonsMessageNode,
  mediaMessage: MediaMessageNode,
  condition: ConditionNode,
  delay: DelayNode,
  action: ActionNode,
  gptQuery: GptQueryNode,
  aiDecision: AiDecisionNode,
  clonedVoice: ClonedVoiceNode,
  tagContact: TagContactNode,
  setVariable: SetVariableNode,
  externalData: ExternalDataNode,
  apiCall: ApiCallNode,
  end: EndNode,
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
  const [nodes, setNodes] = useState<Node[]>(initialNodesProp || []);
  const [edges, setEdges] = useState<Edge[]>(initialEdgesProp || []);
  const [flowName, setFlowName] = useState(initialFlowName || `Fluxo ${flowId}`);
  const [isLoading, setIsLoading] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      if (onLoadFlow && flowId !== 'new') {
        try {
          const loadedData = await onLoadFlow(flowId);
          if (loadedData) {
            setNodes(loadedData.nodes || []);
            setEdges(loadedData.edges || []);
            if(loadedData.name) setFlowName(loadedData.name);
          } else {
            // Fluxo não encontrado ou novo, começar com nó Trigger
            setNodes([{ id: 'trigger_0', type: 'trigger', position: { x: 250, y: 5 }, data: { label: 'Início do Fluxo' } }]);
            setEdges([]);
            setFlowName(`Novo Fluxo ${new Date().toLocaleTimeString()}`);
          }
        } catch (error) {
          console.error("Erro ao carregar fluxo:", error);
           setNodes([{ id: 'trigger_0', type: 'trigger', position: { x: 250, y: 5 }, data: { label: 'Início do Fluxo (Erro ao Carregar)' } }]);
        }
      } else {
         setNodes([{ id: 'trigger_0', type: 'trigger', position: { x: 250, y: 5 }, data: { label: 'Novo Fluxo' } }]);
         setEdges([]);
         setFlowName(initialFlowName || `Novo Fluxo`);
      }
      setIsLoading(false);
    };
    load();
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

  const addNode = (type: string) => {
    const newNodeId = `${type}_${nodes.length + 1}`;
    const newNode: Node = {
      id: newNodeId,
      type,
      position: {
        x: Math.random() * (reactFlowWrapper.current?.clientWidth || 800) * 0.7,
        y: Math.random() * (reactFlowWrapper.current?.clientHeight || 600) * 0.7,
      },
      data: { label: `Novo ${type}` },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = async () => {
    if (onSaveFlow) {
      setIsLoading(true);
      try {
        const currentFlowName = prompt("Nome do Fluxo:", flowName);
        if (currentFlowName) {
            setFlowName(currentFlowName);
            await onSaveFlow(flowId, nodes, edges, currentFlowName);
            if (onSaveSuccess) onSaveSuccess(flowId, currentFlowName);
            alert('Fluxo salvo com sucesso!');
        } else {
            alert('Salvamento cancelado. Nome do fluxo é necessário.');
        }
      } catch (error) {
        console.error("Erro ao salvar fluxo:", error);
        alert('Falha ao salvar o fluxo.');
      }
      setIsLoading(false);
    }
  };
  
  const handleDeleteFlow = () => {
    if (window.confirm(`Tem certeza que deseja excluir o fluxo "${flowName}"?`)) {
      // Adicionar lógica para chamar API de exclusão
      console.log("Excluir fluxo:", flowId);
      if (onCloseEditor) onCloseEditor();
    }
  };


  if (isLoading && flowId !== 'new') {
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
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Panel position="top-left" className="p-2 space-x-2 flex">
            <Input 
                value={flowName} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFlowName(e.target.value)} 
                placeholder="Nome do Fluxo"
                className="bg-background/80 border-border w-auto text-xs h-8"
            />
        </Panel>
        <Panel position="top-right" className="p-2 space-x-2 flex">
          <Button onClick={() => addNode('textMessage')} size="sm" variant="outline" className="neu-button text-xs">
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Msg Texto
          </Button>
          <Button onClick={() => addNode('question')} size="sm" variant="outline" className="neu-button text-xs">
             <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Pergunta
          </Button>
           <Button onClick={() => addNode('condition')} size="sm" variant="outline" className="neu-button text-xs">
             <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Condição
          </Button>
          <Button onClick={handleSave} size="sm" variant="default" className="neu-button-primary text-xs" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Salvar
          </Button>
          {flowId !== 'new' && (
            <Button onClick={handleDeleteFlow} size="sm" variant="destructive" className="text-xs">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
            </Button>
          )}
           {onCloseEditor && (
             <Button onClick={onCloseEditor} size="sm" variant="outline" className="neu-button text-xs">
                Fechar Editor
             </Button>
           )}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default ZapFlowBuilderWrapper;