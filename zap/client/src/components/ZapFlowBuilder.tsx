// zap/client/src/components/ZapFlowBuilder.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  MarkerType,
  NodeTypes,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button'; // Ajuste se o caminho estiver incorreto
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  Clock,
  Zap as ZapIconLucide, // Renomeado para evitar conflito com o nome do módulo
  Play,
  Save,
  Eye,
  Plus,
  Edit2,
  Trash2,
  Settings,
  MousePointer,
  Share2,
  Terminal,
  Brain,
  RadioTower,
  Languages,
  Bot,
  Voicemail,
  FileText,
  ImageIcon as ImageIconLucide,
  VideoIcon,
  ListIcon,
  ToggleLeft,
  SlidersHorizontal,
  Webhook,
  Database,
  Tags,
} from 'lucide-react';

// Importando os nós customizados
import TriggerNode from './flow_builder_nodes/TriggerNode';
import TextMessageNode from './flow_builder_nodes/TextMessageNode';
import ButtonsMessageNode from './flow_builder_nodes/ButtonsMessageNode';
import ListMessageNode from './flow_builder_nodes/ListMessageNode';
import MediaMessageNode from './flow_builder_nodes/MediaMessageNode';
import QuestionNode from './flow_builder_nodes/QuestionNode';
import ConditionNode from './flow_builder_nodes/ConditionNode';
import DelayNode from './flow_builder_nodes/DelayNode';
import ActionNode from './flow_builder_nodes/ActionNode';
import GptQueryNode from './flow_builder_nodes/GptQueryNode';
import AiDecisionNode from './flow_builder_nodes/AiDecisionNode';
import ClonedVoiceNode from './flow_builder_nodes/ClonedVoiceNode';
import SetVariableNode from './flow_builder_nodes/SetVariableNode';
import ApiCallNode from './flow_builder_nodes/ApiCallNode';
import ExternalDataNode from './flow_builder_nodes/ExternalDataNode';
import TagContactNode from './flow_builder_nodes/TagContactNode';
import EndNode from './flow_builder_nodes/EndNode';

// Tipos de Nós Customizados
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  textMessage: TextMessageNode,
  buttonsMessage: ButtonsMessageNode,
  listMessage: ListMessageNode,
  mediaMessage: MediaMessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  delay: DelayNode,
  action: ActionNode,
  gptQuery: GptQueryNode,
  aiDecision: AiDecisionNode,
  clonedVoice: ClonedVoiceNode,
  setVariable: SetVariableNode,
  apiCall: ApiCallNode,
  externalData: ExternalDataNode,
  tagContact: TagContactNode,
  end: EndNode,
};

const initialNodes: Node[] = [
  {
    id: 'start-node',
    type: 'trigger',
    position: { x: 100, y: 150 },
    data: { label: 'Início do Fluxo' },
  },
];

interface ZapFlowBuilderProps {
  flowId?: string; // Para carregar um fluxo existente
  initialNodesData?: Node[];
  initialEdgesData?: Edge[];
  onSaveFlow?: (nodes: Node[], edges: Edge[]) => void;
}

const ZapFlowBuilderComponent: React.FC<ZapFlowBuilderProps> = ({
  flowId,
  initialNodesData,
  initialEdgesData,
  onSaveFlow,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesData || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdgesData || []);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null); // Usar 'any' se o tipo exato for complexo

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNodeId = `node_${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onSave = () => {
    if (onSaveFlow) {
      onSaveFlow(nodes, edges);
    } else {
      console.log('Fluxo para salvar:', { nodes, edges });
      alert('Fluxo salvo no console!');
    }
  };

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const sidebarNodeTypes = [
    { type: 'trigger', label: 'Gatilho', icon: RadioTower, description: 'Inicia o fluxo baseado em um evento.' },
    { type: 'textMessage', label: 'Texto', icon: MessageSquare, description: 'Envia uma mensagem de texto simples.' },
    { type: 'buttonsMessage', label: 'Botões', icon: ToggleLeft, description: 'Envia mensagem com botões de resposta rápida.' },
    { type: 'listMessage', label: 'Lista', icon: ListIcon, description: 'Envia uma mensagem com uma lista de opções.' },
    { type: 'mediaMessage', label: 'Mídia', icon: ImageIconLucide, description: 'Envia imagem, vídeo, áudio ou documento.' },
    { type: 'question', label: 'Pergunta', icon: HelpCircle, description: 'Faz uma pergunta e aguarda resposta do usuário.' },
    { type: 'condition', label: 'Condição', icon: GitBranch, description: 'Desvia o fluxo baseado em condições.' },
    { type: 'delay', label: 'Aguardar', icon: Clock, description: 'Pausa o fluxo por um tempo determinado.' },
    { type: 'action', label: 'Ação Zap', icon: ZapIconLucide, description: 'Executa uma ação específica do WhatsApp (ex: ler msg).' },
    { type: 'gptQuery', label: 'Consulta GPT', icon: Brain, description: 'Envia um prompt para o GPT e usa a resposta.' },
    { type: 'aiDecision', label: 'Decisão IA', icon: Bot, description: 'Permite à IA tomar uma decisão de fluxo.' },
    { type: 'clonedVoice', label: 'Voz Clonada', icon: Voicemail, description: 'Envia uma mensagem de voz usando TTS clonado.' },
    { type: 'setVariable', label: 'Definir Variável', icon: SlidersHorizontal, description: 'Define ou atualiza uma variável de contato/fluxo.' },
    { type: 'apiCall', label: 'Chamada API', icon: Webhook, description: 'Faz uma requisição para uma API externa.' },
    { type: 'externalData', label: 'Dados Externos', icon: Database, description: 'Busca ou envia dados para sistemas externos (planilhas, CRM).' },
    { type: 'tagContact', label: 'Etiquetar Contato', icon: Tags, description: 'Adiciona ou remove etiquetas do contato.' },
    { type: 'end', label: 'Fim do Fluxo', icon: Play, description: 'Marca o final de um caminho do fluxo.' }, // Ícone Play invertido como Fim
  ];


  return (
    <div className="flex h-full w-full">
      <aside className="w-64 p-4 border-r bg-card space-y-3 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-3">Blocos de Fluxo</h3>
        {sidebarNodeTypes.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.type}
              className="p-3 border rounded-md cursor-grab neu-card hover:shadow-lg transition-shadow flex items-start gap-3"
              onDragStart={(event) => onDragStart(event, node.type)}
              draggable
            >
              <Icon className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">{node.label}</div>
                <p className="text-xs text-muted-foreground">{node.description}</p>
              </div>
            </div>
          );
        })}
      </aside>
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Controls />
          <MiniMap />
          <Background gap={16} color="hsl(var(--border))" />
          <Panel position="top-right">
            <Button onClick={onSave} size="sm" className="neu-button m-2">
              <Save className="mr-2 h-4 w-4" /> Salvar Fluxo
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

const FlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = (props) => (
  <ReactFlowProvider>
    <ZapFlowBuilderComponent {...props} />
  </ReactFlowProvider>
);

export default FlowBuilderWrapper;
