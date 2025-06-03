// MKTV2/zap/client/src/features/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node } from '@xyflow/react';

// --- Tipos Gerais ---
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

export interface FlowListElement { 
  id: string; 
  name: string;
  description?: string;
  trigger?: string; 
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'draft' | 'archived';
  campaign_id?: string | null; 
  updatedAt?: string; 
  triggerType?: string; 
}

export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; 
  avgTimeToComplete?: number; 
}

// --- DEFINIÇÕES DE DADOS PARA NÓS CUSTOMIZADOS ---
export interface BaseNodeData {
  label?: string; 
  [key: string]: any; // Restaurado temporariamente para resolver TS2344 no CustomNodeDataType
}

// ... (TODAS as outras interfaces ...NodeData que definimos na penúltima mensagem permanecem aqui) ...
// Garantindo que os nomes exportados sejam:
// ListMessageNodeData (NÃO ListMessageNodeDataFE)
// GPTQueryNodeData (NÃO GptQueryNodeData)
// ExternalDataFetchNodeData (NÃO ExternalDataFetchNodeDataFE)

// Exemplo (mantendo as correções de nome):
export interface ListMessageNodeData extends BaseNodeData { 
  messageText?: string; 
  buttonText?: string; 
  title?: string; 
  footerText?: string; 
  sections?: ListSection[]; 
}

export interface GPTQueryNodeData extends BaseNodeData { 
  promptTemplate?: string; 
  variableToSaveResult?: string; 
  apiKeyVariable?: string; 
  systemMessage?: string; 
  model?: string; 
  temperature?: number; 
  maxTokens?: number; 
}

export interface ExternalDataFetchNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET'; 
  saveToVariable?: string; 
}

// ... (TODAS AS OUTRAS ...NodeData interfaces da penúltima mensagem vão aqui) ...
// TriggerNodeData, TextMessageNodeData, ButtonsMessageNodeData, ImageNodeData, etc.
// ... (certifique-se de que TODAS as 17+ interfaces de nó estejam aqui)

// (COPIE E COLE TODAS AS INTERFACES ...NodeData DA MINHA PENÚLTIMA MENSAGEM AQUI,
//  APENAS GARANTINDO QUE ListMessageNodeData, GPTQueryNodeData, e ExternalDataFetchNodeData
//  ESTEJAM COM OS NOMES CORRIGIDOS COMO MOSTRADO ACIMA)

// --- União de todos os tipos de dados de nós ---
export type CustomNodeDataType =
  | BaseNodeData 
  | TriggerNodeData
  | TextMessageNodeData
  | ButtonsMessageNodeData
  | ImageNodeData
  | AudioNodeData
  | FileNodeData
  | LocationNodeData
  | ListMessageNodeData // Nome corrigido
  | DelayNodeData
  | WaitInputNodeData
  | SetVariableNodeData
  | ConditionNodeData
  | TimeConditionNodeData
  | ApiCallNodeData
  | WebhookCallNodeData
  | GPTQueryNodeData // Nome corrigido
  | AssignAgentNodeData
  | EndNodeData
  | GoToFlowNodeData
  | TagContactNodeData
  | LoopNodeData
  | QuestionNodeData
  | MediaMessageNodeData
  | ExternalDataFetchNodeData // Nome corrigido
  | ActionNodeData
  | AiDecisionNodeData
  | ClonedVoiceNodeData;

export type ZapFlowNode = Node<CustomNodeDataType, string | undefined>;

export interface FlowDefinition {
  nodes: ZapFlowNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Seus tipos FlowNode e FlowEdge originais (se ainda usados em outro lugar no módulo zap)
export interface FlowNode {
  id: string;
  type?: string; 
  data: BaseNodeData; 
  position: { x: number; y: number };
}
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; 
  targetHandle?: string | null; 
  label?: string;
  animated?: boolean;
  type?: 'smoothstep' | 'default' | string; 
  markerEnd?: any; 
}

export type { NodeProps, Edge }; // Node já está coberto por ZapFlowNode
