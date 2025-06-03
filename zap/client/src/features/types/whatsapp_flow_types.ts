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
  // Adicionando a assinatura de índice para resolver o erro TS2344 em CustomNodeDataType
  // Isso permite que qualquer propriedade string seja adicionada, o que é flexível,
  // mas menos seguro. Idealmente, cada NodeData seria estritamente tipado.
  [key: string]: any; 
}

export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled' | '';
  keywords?: string[]; 
  formId?: string;
  webhookUrl?: string; 
  scheduleDateTime?: string; 
  exactMatch?: boolean;
}

export interface TextMessageNodeData extends BaseNodeData {
  message?: string; 
}

export interface ButtonOption { 
  id: string; 
  displayText: string; 
  value?: string; 
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText?: string;
  buttons?: ButtonOption[];
  headerText?: string;
  footerText?: string;
}

export interface ImageNodeData extends BaseNodeData {
  url?: string;
  caption?: string;
}

export interface AudioNodeData extends BaseNodeData {
  url?: string;
  caption?: string; 
  ptt?: boolean;    
}

export interface FileNodeData extends BaseNodeData {
  url?: string;
  fileName?: string; 
  mimeType?: string; 
  caption?: string;
}

export interface LocationNodeData extends BaseNodeData {
  latitude?: string; 
  longitude?: string; 
  name?: string;
  address?: string;
}

export interface DelayNodeData extends BaseNodeData { 
  delayAmount?: number; 
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface ListItem { 
  id: string; 
  title: string; 
  description?: string; 
}
export interface ListSection { 
  id: string; 
  title: string; 
  rows: ListItem[]; 
}
// Nome CORRIGIDO para corresponder ao que ZapFlowBuilder.tsx espera após o "Did you mean?"
export interface ListMessageNodeData extends BaseNodeData { 
  messageText?: string; 
  buttonText?: string; 
  title?: string; 
  footerText?: string; 
  sections?: ListSection[]; 
}

export interface WaitInputNodeData extends BaseNodeData {
  variableName?: string;
  message?: string; 
  timeoutSeconds?: number;
}

export interface VariableAssignment { 
    variableName: string;
    value?: string; 
    source?: 'static' | 'expression' | 'contact_data' | 'message_data'; 
    expression?: string; 
    contactField?: string; 
    messagePath?: string; 
}
export interface SetVariableNodeData extends BaseNodeData { 
  assignments?: VariableAssignment[];
}

export interface ConditionNodeData extends BaseNodeData { 
  variableToCheck?: string; 
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'endsWith' | 'isSet' | 'isNotSet' | 'regex';
  valueToCompare?: string; 
}

export interface TimeConditionNodeData extends BaseNodeData {
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
}

export interface ApiCallNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string; 
  body?: string;    
  responseMapping?: string; 
}

export interface WebhookCallNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET' | 'POST';
  headers?: string;
  body?: string;
  saveResponseTo?: string;
}

// Nome CORRIGIDO para corresponder ao que ZapFlowBuilder.tsx espera após o "Did you mean?"
export interface GPTQueryNodeData extends BaseNodeData { 
  promptTemplate?: string; 
  variableToSaveResult?: string; 
  apiKeyVariable?: string; 
  systemMessage?: string; 
  model?: string; 
  temperature?: number; 
  maxTokens?: number; 
}

export interface AssignAgentNodeData extends BaseNodeData {
  department?: string;
  agentId?: string;
  message?: string; 
}

export interface EndNodeData extends BaseNodeData { 
  endStateType?: 'completed' | 'abandoned' | 'error_fallback' | string; 
  message?: string; 
}

export interface GoToFlowNodeData extends BaseNodeData {
  targetFlowId?: string; 
}

export interface TagContactNodeData extends BaseNodeData { 
  tagName?: string;
  tagOperation?: 'add' | 'remove'; 
}

export interface LoopNodeData extends BaseNodeData {
  repetitions?: number;
}

export interface QuickReply { 
    id: string;
    text: string;
    payload?: string;
}
export interface QuestionNodeData extends BaseNodeData { 
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply' | '';
  variableToSaveAnswer?: string;
  quickReplies?: QuickReply[];
}

// Nome CORRIGIDO para corresponder ao que ZapFlowBuilder.tsx espera após o "Did you mean?"
// (Assumindo que MediaMessageNodeData era o que você queria, e não ListMessageNodeData como sugerido pelo erro, pois são diferentes)
export interface MediaMessageNodeData extends BaseNodeData { 
  mediaType?: 'image' | 'video' | 'audio' | 'document' | '';
  mediaUrl?: string; 
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

// Nome CORRIGIDO para corresponder ao que ZapFlowBuilder.tsx espera após o "Did you mean?"
export interface ExternalDataFetchNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET'; 
  saveToVariable?: string; 
}

export interface ActionNodeData extends BaseNodeData { 
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | string;
  tagName?: string; 
  agentId?: string; 
  emailTemplateId?: string; 
  contactPropertyName?: string; 
  contactPropertyValue?: string | number | boolean; 
  apiUrl?: string; 
}

export interface AiDecisionNodeData extends BaseNodeData { 
  inputVariable?: string; 
  decisionCategories?: Array<{ id: string; name: string; keywords?: string; }>; 
}

export interface ClonedVoiceNodeData extends BaseNodeData { 
  textToSpeak?: string; 
  voiceId?: string; 
}

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
  | ListMessageNodeData 
  | DelayNodeData
  | WaitInputNodeData
  | SetVariableNodeData
  | ConditionNodeData
  | TimeConditionNodeData
  | ApiCallNodeData
  | WebhookCallNodeData
  | GPTQueryNodeData 
  | AssignAgentNodeData
  | EndNodeData
  | GoToFlowNodeData
  | TagContactNodeData
  | LoopNodeData
  | QuestionNodeData
  | MediaMessageNodeData 
  | ExternalDataFetchNodeData 
  | ActionNodeData
  | AiDecisionNodeData
  | ClonedVoiceNodeData;

export type ZapFlowNode = Node<CustomNodeDataType, string | undefined>;

export interface FlowDefinition {
  nodes: ZapFlowNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Seus tipos FlowNode e FlowEdge originais (mantidos para compatibilidade se usados em outro lugar)
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

export type { NodeProps, Edge };
