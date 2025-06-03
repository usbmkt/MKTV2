// MKTV2/zap/client/src/features/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node } from '@xyflow/react';

// --- Tipos Gerais ---
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// Para listar fluxos na UI do Zap
export interface FlowListElement { 
  id: string; 
  name: string;
  description?: string;
  trigger?: string; 
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'draft' | 'archived'; // Adicionado do seu ZapFlowsList
  campaign_id?: string | null; 
  updatedAt?: string; // Era updated_at no seu ZapFlowsList
  triggerType?: string; // Do seu ZapFlowsList
  // Adicione outras props que você usa para exibir a lista de fluxos
}

// (FlowPerformanceData e CampaignSelectItem mantidos como antes, se necessários)
export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // Em porcentagem
  avgTimeToComplete?: number; // Adicionado do seu ZapAnalytics (era avgDurationSeconds)
  // Outras métricas relevantes
}


// --- DEFINIÇÕES DE DADOS PARA NÓS CUSTOMIZADOS ---
export interface BaseNodeData {
  label?: string; 
  // Manter [key: string]: any; do seu arquivo original se for estritamente necessário
  // para alguns nós, mas tentaremos evitar.
  // [key: string]: any; 
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
  message?: string; // Usado em seu TextMessageNode.tsx (era messageText em seu types original)
}

export interface ButtonOption { // Renomeado de ButtonOptionData
  id: string; 
  displayText: string; // Era 'label' no seu types original, mas 'displayText' no ButtonsMessageNode.tsx
  value?: string; 
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText?: string; // Do seu types original
  buttons?: ButtonOption[]; // Do seu types original
  headerText?: string; // Do seu ButtonsMessageNode.tsx
  footerText?: string; // Do seu types original
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

export interface DelayNodeData extends BaseNodeData { // Do seu zap/DelayNode.tsx
  delayAmount?: number; 
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface ListItem { // Renomeado de ListItemData
  id: string; 
  title: string; 
  description?: string; 
}
export interface ListSection { // Renomeado de ListSectionData
  id: string; // Adicionado id para key e manipulação
  title: string; 
  rows: ListItem[]; 
}
// Corrigido nome para ListMessageNodeData (era ListMessageNodeDataFE e causava erro no ZapFlowBuilder)
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

export interface Condition { // Do seu types original
    id: string; 
    variable?: string; 
    operator?: string; 
    value?: string; 
    outputLabel?: string; 
}
export interface ConditionNodeData extends BaseNodeData { // Do seu types original
  // Se for a estrutura com múltiplas conditions:
  conditions?: Condition[]; 
  defaultOutputLabel?: string;
  // Se for a estrutura mais simples do seu ConditionNode.tsx:
  variableToCheck?: string; 
  // operator?: 'equals' | 'not_equals' | ... (já definido na Condition, mas pode ser duplicado aqui se a UI for simples)
  valueToCompare?: string; 
}


export interface TimeConditionNodeData extends BaseNodeData {
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
}

export interface ApiCallNodeData extends BaseNodeData { // Do seu types original
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: string; // JSON string
  body?: string;    // JSON string ou texto
  saveResponseTo?: string; // Era responseMapping no seu componente ApiCallNode.tsx
  // responseMapping?: string; // Se preferir este nome
}

export interface WebhookCallNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET' | 'POST';
  headers?: string;
  body?: string;
  saveResponseTo?: string;
}

// Corrigido nome para GPTQueryNodeData (era GptQueryNodeData e causava erro no ZapFlowBuilder)
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

export interface EndNodeData extends BaseNodeData { // Do seu zap/EndNode.tsx
  endStateType?: 'completed' | 'abandoned' | 'error_fallback' | string; 
  message?: string; 
}

export interface GoToFlowNodeData extends BaseNodeData {
  targetFlowId?: string; 
}

export interface TagContactNodeData extends BaseNodeData { // Do seu zap/TagContactNode.tsx
  tagName?: string;
  tagOperation?: 'add' | 'remove'; 
}

export interface LoopNodeData extends BaseNodeData {
  repetitions?: number;
}

export interface QuickReply { // Do seu zap/QuestionNode.tsx
    id: string;
    text: string;
    payload?: string;
}
export interface QuestionNodeData extends BaseNodeData { // Do seu types original e QuestionNode.tsx
  questionText?: string;
  variableToSave?: string; // Do seu types original
  variableToSaveAnswer?: string; // Do seu QuestionNode.tsx
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply' | ''; // Do seu QuestionNode.tsx
  quickReplies?: QuickReply[]; // Do seu QuestionNode.tsx
}

export interface MediaMessageNodeData extends BaseNodeData { // Do seu types original e MediaMessageNode.tsx
  mediaType?: 'image' | 'video' | 'audio' | 'document' | '';
  url?: string; // Do seu types original (era mediaUrl no componente)
  mediaUrl?: string; // Do seu MediaMessageNode.tsx
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

// Corrigido nome para ExternalDataFetchNodeData (era ExternalDataFetchNodeDataFE e causava erro no ZapFlowBuilder)
export interface ExternalDataFetchNodeData extends BaseNodeData { 
  url?: string;
  method?: 'GET'; 
  saveToVariable?: string; 
}

export interface ActionNodeData extends BaseNodeData { // Do seu zap/ActionNode.tsx
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | string;
  tagName?: string; 
  agentId?: string; 
  emailTemplateId?: string; 
  contactPropertyName?: string; 
  contactPropertyValue?: string | number | boolean; 
  apiUrl?: string; 
}

export interface AiDecisionNodeData extends BaseNodeData { // Do seu zap/AiDecisionNode.tsx
  inputVariable?: string; 
  decisionCategories?: Array<{ id: string; name: string; keywords?: string; }>; 
}

export interface ClonedVoiceNodeData extends BaseNodeData { // Do seu zap/ClonedVoiceNode.tsx
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

// Definição da estrutura do fluxo para o FlowBuilder
export interface FlowDefinition { // Era FlowElementData no seu types/zap.ts
  nodes: ZapFlowNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Tipos que estavam no seu whatsapp_flow_types.ts original
export interface FlowNode { // Este é o seu FlowNode original
  id: string;
  type?: string; 
  data: BaseNodeData; // Usando BaseNodeData aqui, pois CustomNodeDataType é para o <Node> do ReactFlow
  position: { x: number; y: number };
}
export interface FlowEdge { // Este é o seu FlowEdge original
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

// Reexportar tipos do React Flow para conveniência
export type { NodeProps, Edge }; // Node já está reexportado como ZapFlowNode
