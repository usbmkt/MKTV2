// NOVO ARQUIVO: client/src/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node } from '@xyflow/react';

// --- Tipos Gerais ---
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

export interface FlowUIData {
  id: string; 
  name: string;
  description?: string;
  trigger?: string; 
  isActive?: boolean;
  campaign_id?: string | null;
  updated_at?: string;
  definition?: FlowDefinition; 
}

export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  avgDurationSeconds?: number;
}

export interface CampaignSelectItem { 
  id: string; 
  name: string; 
}

// --- DEFINIÇÕES DE DADOS PARA NÓS CUSTOMIZADOS ---
// Baseado no seu zap/client/src/features/types/whatsapp_flow_types.ts
// e nos componentes de nó fornecidos.

interface BaseNodeData {
  label?: string; 
  [key: string]: any; // Mantido do seu tipo original para flexibilidade, mas tentaremos ser específicos.
}

export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled' | '';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string; // Para exibição
  scheduleDateTime?: string;
  exactMatch?: boolean;
}

export interface TextMessageNodeData extends BaseNodeData {
  message?: string; // Era messageText no seu tipo, mas TextMessageNode.tsx usa 'message'
}

export interface ButtonOptionData { // Do seu zap/.../types
  id: string; 
  displayText: string; // Do seu ButtonsMessageNode.tsx
  value?: string; 
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText?: string;
  buttons?: ButtonOptionData[];
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
  fileName?: string; // Era filename no flow.tsx
  mimeType?: string; // Era mimetype no flow.tsx
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

export interface ListItemData { 
  id: string; 
  title: string; 
  description?: string; 
}
export interface ListSectionData { 
  id: string; // Adicionado id para key e manipulação
  title: string; 
  rows: ListItemData[]; 
}
export interface ListMessageNodeData extends BaseNodeData { // Era ListMessageNodeDataFE
  messageText?: string; 
  buttonText?: string; 
  title?: string; 
  footerText?: string; 
  sections?: ListSectionData[]; 
}

export interface WaitInputNodeData extends BaseNodeData {
  variableName?: string;
  message?: string; 
  timeoutSeconds?: number;
}

export interface VariableAssignment {
    variableName: string;
    value: string; 
    source: 'static' | 'expression' | 'contact_data' | 'message_data'; 
    expression?: string; 
    contactField?: string; 
    messagePath?: string; 
}
export interface SetVariableNodeData extends BaseNodeData {
  assignments?: VariableAssignment[];
}

export interface ConditionNodeData extends BaseNodeData { // Do seu ConditionNode.tsx (zap)
  variableToCheck?: string; 
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'isSet' | 'isNotSet' | 'regex'; // Adicionado do flow.tsx
  valueToCompare?: string; 
}

export interface TimeConditionNodeData extends BaseNodeData {
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
}

export interface ApiCallNodeData extends BaseNodeData { // Do seu ApiCallNode.tsx (zap)
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string; // JSON string
  body?: string;    // JSON string ou texto
  responseMapping?: string; // Onde/como salvar a resposta. Ex: "data.token para var {{api_token}}"
                           // Ou poderia ser saveResponseToVariable?: string; e um campo para o JSONPath
}

export interface WebhookCallNodeData extends BaseNodeData { // Do flow.tsx
  url?: string;
  method?: 'GET' | 'POST';
  headers?: string;
  body?: string;
  saveResponseTo?: string;
}

export interface GPTQueryNodeData extends BaseNodeData { // Do seu GptQueryNode.tsx (zap)
  promptTemplate?: string; 
  variableToSaveResult?: string; 
  apiKeyVariable?: string; // Adicionado do flow.tsx
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

export interface EndNodeData extends BaseNodeData { // Do seu EndNode.tsx (zap)
  endStateType?: 'completed' | 'abandoned' | 'error_fallback' | string; 
  message?: string; 
}

export interface GoToFlowNodeData extends BaseNodeData {
  targetFlowId?: string; 
}

export interface TagContactNodeData extends BaseNodeData { // Do seu TagContactNode.tsx (zap)
  tagName?: string;
  tagOperation?: 'add' | 'remove'; 
}

export interface LoopNodeData extends BaseNodeData {
  repetitions?: number;
}

export interface QuickReply { // Do seu QuestionNode.tsx (zap)
    id: string;
    text: string;
    payload?: string;
}
export interface QuestionNodeData extends BaseNodeData { // Do seu QuestionNode.tsx (zap)
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply' | '';
  variableToSaveAnswer?: string;
  quickReplies?: QuickReply[];
  // listOptions?: ListMessageNodeData; // Se for usar a estrutura de lista para resposta
}

export interface MediaMessageNodeData extends BaseNodeData { // Do seu MediaMessageNode.tsx (zap)
  mediaType?: 'image' | 'video' | 'audio' | 'document' | '';
  mediaUrl?: string; 
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

export interface ExternalDataFetchNodeData extends BaseNodeData { // Do seu ExternalDataNode.tsx (zap), era ExternalDataFetchNodeDataFE
  url?: string;
  method?: 'GET'; 
  saveToVariable?: string; 
}

export interface ActionNodeData extends BaseNodeData { // Do seu ActionNode.tsx (zap)
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | string;
  tagName?: string; 
  agentId?: string; 
  emailTemplateId?: string; 
  contactPropertyName?: string; 
  contactPropertyValue?: string | number | boolean; 
  apiUrl?: string; 
}

export interface AiDecisionNodeData extends BaseNodeData { // Do seu AiDecisionNode.tsx (zap)
  inputVariable?: string; 
  decisionCategories?: Array<{ id: string; name: string; keywords?: string; }>; 
}

export interface ClonedVoiceNodeData extends BaseNodeData { // Do seu ClonedVoiceNode.tsx (zap)
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

export type { NodeProps, Edge, Node };
