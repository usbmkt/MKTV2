// ARQUIVO: client/src/types/whatsapp_flow_types.ts

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
  trigger?: string; // Pode ser o tipo do TriggerNodeData.triggerType
  isActive?: boolean;
  campaign_id?: string | null;
  updated_at?: string;
  definition?: FlowDefinition; // Para carregar o fluxo no editor
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

interface BaseNodeData {
  label?: string; 
}

export interface TriggerNodeData extends BaseNodeData {
  triggerType: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled' | ''; // '' para não selecionado
  keywords?: string[]; // Array de strings para palavras-chave
  formId?: string;
  webhookUrl?: string; // Geralmente gerado pelo sistema e apenas para exibição no nó
  scheduleDateTime?: string; // Formato ISO ou datetime-local
  exactMatch?: boolean; // Para keyword trigger
}

export interface TextMessageNodeData extends BaseNodeData {
  message: string; // Renomeado de messageText para consistência com seu TextMessageNode.tsx
}

export interface ButtonOptionData {
  id: string; 
  displayText: string; // Do seu ButtonsMessageNode.tsx
  // value?: string; // Se o valor enviado for diferente do texto exibido
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText: string;
  buttons: ButtonOptionData[];
  headerText?: string; 
  footerText?: string;
}

export interface ImageNodeData extends BaseNodeData { // Do flow.tsx
  url: string;
  caption?: string;
}

export interface AudioNodeData extends BaseNodeData { // Do flow.tsx
  url: string;
  // caption?: string; // Seu MediaMessageNode.tsx tem caption, mas o AudioNode do flow.tsx não. Decida.
  ptt?: boolean; 
}

export interface FileNodeData extends BaseNodeData { // Do flow.tsx
  url: string;
  filename?: string;
  // mimeType?: string; // Seu MediaMessageNode.tsx tem, o FileNode do flow.tsx não. Decida.
}

export interface LocationNodeData extends BaseNodeData { // Do flow.tsx
  latitude: string; 
  longitude: string; 
  // name?: string;
  // address?: string;
}

export interface DelayNodeData extends BaseNodeData { // Combinado do seu DelayNode.tsx e flow.tsx
  delayAmount: number; // Do seu DelayNode.tsx
  unit: 'seconds' | 'minutes' | 'hours' | 'days'; // Do seu DelayNode.tsx (era duration e unit no flow.tsx)
}

export interface ListItemData { 
  id: string; 
  title: string; 
  description?: string; 
}
export interface ListSectionData { 
  id: string; // Adicionado ID para a seção, útil para React keys e manipulação
  title: string; 
  rows: ListItemData[]; 
}
export interface ListMessageNodeData extends BaseNodeData { // Do seu ListMessageNode.tsx e flow.tsx
  messageText: string; // Era 'text' no flow.tsx
  buttonText: string; 
  title?: string; // Título da lista em si (opcional, era obrigatório no flow.tsx)
  footerText?: string; 
  sections: ListSectionData[];
}

export interface WaitInputNodeData extends BaseNodeData { // Do flow.tsx
  variableName: string;
  message?: string; 
  timeoutSeconds?: number;
}

export interface VariableAssignment { // Do seu SetVariableNode.tsx
    variableName: string;
    value: string; // Pode ser estático ou uma expressão {{var}}
    source: 'static' | 'expression' | 'contact_data' | 'message_data'; // Adicionado message_data
    expression?: string; // Se source for 'expression'
    contactField?: string; // Se source for 'contact_data' (ex: 'name', 'phone')
    messagePath?: string; // Se source for 'message_data' (ex: 'body.text', 'button.payload')
}
export interface SetVariableNodeData extends BaseNodeData { // Do seu SetVariableNode.tsx
  assignments: VariableAssignment[];
}

export interface ConditionNodeData extends BaseNodeData { // Combinado do seu ConditionNode.tsx e flow.tsx
  // Do seu ConditionNode.tsx (mais simples, duas saídas)
  variableToCheck: string; // Era variableName no flow.tsx
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'isSet' | 'isNotSet' | 'regex'; // Adicionado mais operadores do flow.tsx
  valueToCompare?: string; // Era value no flow.tsx

  // Ou a estrutura mais complexa do seu zap/.../types/whatsapp_flow_types.ts (múltiplas condições)
  // conditions?: Array<{ id: string; variable?: string; operator?: string; value?: string; outputLabel?: string; }>;
  // defaultOutputLabel?: string;
}

export interface TimeConditionNodeData extends BaseNodeData { // Do flow.tsx
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface ApiCallNodeData extends BaseNodeData { // Combinado do seu ApiCallNode.tsx e flow.tsx
  url: string; // Era apiUrl no flow.tsx
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string; // JSON string
  body?: string;    // JSON string ou texto
  responseMapping?: string; // Do seu ApiCallNode.tsx (era saveResponseTo no flow.tsx)
  // saveResponseTo?: string; // Do flow.tsx
  timeoutMs?: number; // Do flow.tsx
}

export interface WebhookCallNodeData extends BaseNodeData { // Do flow.tsx
  url: string;
  method: 'GET' | 'POST';
  headers?: string;
  body?: string;
  saveResponseTo?: string;
}

export interface GPTQueryNodeData extends BaseNodeData { // Combinado do seu GptQueryNode.tsx e flow.tsx
  promptTemplate: string; // Era prompt no flow.tsx
  // inputVariables?: string[]; // Do seu GptQueryNode.tsx (se usar array)
  variableToSaveResult: string; // Era saveResponseTo no flow.tsx
  apiKeyVariable?: string; // Do flow.tsx
  systemMessage?: string; // Do types/zap.ts
  model?: string; // Do types/zap.ts
  temperature?: number; // Do types/zap.ts
  maxTokens?: number; // Do types/zap.ts
}

export interface AssignAgentNodeData extends BaseNodeData { // Do flow.tsx
  department?: string;
  agentId?: string;
  message?: string; 
}

export interface EndNodeData extends BaseNodeData { // Do seu EndNode.tsx
  endStateType: 'completed' | 'abandoned' | 'error_fallback' | string; // string para flexibilidade
  message?: string; // Mensagem final
  // reason?: string; // Do flow.tsx (era opcional)
}

export interface GoToFlowNodeData extends BaseNodeData { // Do flow.tsx
  targetFlowId: string; 
}

export interface TagContactNodeData extends BaseNodeData { // Do seu TagContactNode.tsx
  tagName: string;
  tagOperation: 'add' | 'remove'; // Era 'action' no flow.tsx
}

export interface LoopNodeData extends BaseNodeData { // Do flow.tsx
  repetitions: number;
}

export interface QuestionNodeData extends BaseNodeData { // Do seu QuestionNode.tsx
  questionText: string;
  expectedResponseType: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply' | '';
  variableToSaveAnswer?: string;
  quickReplies?: Array<{ id: string; text: string; payload?: string }>;
  listOptions?: ListMessageNodeData; // Se a resposta for uma lista, pode reusar a estrutura
}

export interface MediaMessageNodeData extends BaseNodeData { // Do seu MediaMessageNode.tsx
  mediaType: 'image' | 'video' | 'audio' | 'document' | '';
  mediaUrl: string; // Era 'url'
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

export interface ExternalDataFetchNodeData extends BaseNodeData { // Do seu ExternalDataNode.tsx (era ExternalDataFetchNodeDataFE)
  url: string;
  method?: 'GET'; // Geralmente GET
  // headers?: string; // Pode ser necessário
  saveToVariable: string; 
}

export interface ActionNodeData extends BaseNodeData { // Do seu ActionNode.tsx
  actionType: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | string;
  tagName?: string; 
  agentId?: string; 
  emailTemplateId?: string; 
  contactPropertyName?: string; 
  contactPropertyValue?: string | number | boolean; // Permitir diferentes tipos
  apiUrl?: string; // Para actionType 'call_api'
  // Adicionar outras propriedades específicas de cada actionType
}

export interface AiDecisionNodeData extends BaseNodeData { // Do seu AiDecisionNode.tsx
  inputVariable: string; 
  decisionCategories: Array<{ id: string; name: string; keywords?: string; /* handleId: string; */ }>; // Adicionar handleId se for diferente do id
  // model?: string;
  // decisionPrompt?: string;
}

export interface ClonedVoiceNodeData extends BaseNodeData { // Do seu ClonedVoiceNode.tsx
  textToSpeak: string; 
  voiceId: string; 
  // apiKeyVariable?: string; 
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

export type ZapFlowNode = Node<CustomNodeDataType & { nodeTitle?: string }, string | undefined>; // Adicionado nodeTitle para consistência com alguns dos seus nós

export interface FlowDefinition {
  nodes: ZapFlowNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type { NodeProps, Edge, Node };
