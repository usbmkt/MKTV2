import { Node } from '@xyflow/react';

// Definição base para todos os dados de nós customizados
export interface BaseNodeData {
  label?: string;
  [key: string]: any;
}

// ===========================================
// TIPOS CORRIGIDOS PARA OS NÓS
// ===========================================

// --- ActionNode ---
export interface ActionNodeData extends BaseNodeData {
  actionType?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  databaseOperation?: 'insert' | 'update' | 'select' | 'delete';
  tableName?: string;
  dataToInsert?: string;
  updateCriteria?: string;
  dataToUpdate?: string;
  selectQuery?: string;
  deleteCriteria?: string;
  messageContent?: string;
  recipientVariable?: string;
}
export type ActionNodeType = Node<ActionNodeData> & { type: 'actionNode' };

// --- AiDecisionNode ---
export interface AiDecisionNodeData extends BaseNodeData {
  prompt?: string;
  variableToStoreDecision?: string;
  possibleOutcomes?: Array<{ outcome: string; description: string }>;
  apiKeyVariable?: string;
}
export type AiDecisionNodeType = Node<AiDecisionNodeData> & { type: 'aiDecisionNode' };

// --- ApiCallNode ---
export interface ApiCallNodeData extends BaseNodeData {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  responseVariable?: string;
  timeout?: number;
}
export type ApiCallNodeType = Node<ApiCallNodeData> & { type: 'apiCallNode' };

// --- ButtonsMessageNode ---
export interface ButtonItem {
  id: string;
  text: string;
  payload?: string;
}

// ADICIONADO: ButtonOptionData que estava faltando
export interface ButtonOptionData {
  id: string;
  text: string;
  payload?: string;
}

export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText?: string;
  buttons?: ButtonItem[];
  footerText?: string;
}
export type ButtonsMessageNodeType = Node<ButtonsMessageNodeData> & { type: 'buttonsMessageNode' };

// --- ClonedVoiceNode ---
export interface ClonedVoiceNodeData extends BaseNodeData {
  textToSpeak?: string;
  voiceId?: string;
  apiKeyVariable?: string;
  language?: string;
  outputFormat?: 'mp3' | 'wav';
  variableToStoreUrl?: string;
}
export type ClonedVoiceNodeType = Node<ClonedVoiceNodeData> & { type: 'clonedVoiceNode' };

// --- ConditionNode ---
export interface Condition {
  variableName?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean;
}
export interface ConditionNodeData extends BaseNodeData {
  conditions?: Condition[];
  logicalOperator?: 'AND' | 'OR';
}
export type ConditionNodeType = Node<ConditionNodeData> & { type: 'conditionNode' };

// --- DelayNode ---
export interface DelayNodeData extends BaseNodeData {
  delayValue?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours';
}
export type DelayNodeType = Node<DelayNodeData> & { type: 'delayNode' };

// --- EndNode ---
export interface EndNodeData extends BaseNodeData {
  endMessage?: string;
  status?: 'completed' | 'failed' | 'terminated';
}
export type EndNodeType = Node<EndNodeData> & { type: 'endNode' };

// --- ExternalDataNode ---
export interface ExternalDataNodeData extends BaseNodeData {
  dataSourceUrl?: string;
  requestType?: 'GET' | 'POST';
  requestBody?: string;
  headers?: Array<{ key: string; value: string }>;
  variableToStoreData?: string;
}
export type ExternalDataNodeType = Node<ExternalDataNodeData> & { type: 'externalDataNode' };

// ADICIONADO: ExternalDataFetchNodeDataFE que estava faltando
export interface ExternalDataFetchNodeDataFE extends ExternalDataNodeData {
  // Propriedades específicas do frontend, se necessário
}

// --- GptQueryNode ---
export interface GptQueryNodeData extends BaseNodeData {
  prompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  variableToStoreResponse?: string;
  apiKeyVariable?: string;
}
export type GptQueryNodeType = Node<GptQueryNodeData> & { type: 'gptQueryNode' };

// --- ListMessageNode ---
export interface ListItem {
  id: string;
  title: string;
  description?: string;
}
export interface ListSection {
  title: string;
  rows: ListItem[];
}
export interface ListMessageNodeData extends BaseNodeData {
  messageText?: string;
  buttonText?: string;
  footerText?: string;
  sections?: ListSection[];
}
export type ListMessageNodeType = Node<ListMessageNodeData> & { type: 'listMessageNode' };

// --- MediaMessageNode ---
export interface MediaMessageNodeData extends BaseNodeData {
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}
export type MediaMessageNodeType = Node<MediaMessageNodeData> & { type: 'mediaMessageNode' };

// --- QuestionNode ---
export interface QuickReply {
  id: string;
  text: string;
  payload?: string;
}
export interface QuestionNodeData extends BaseNodeData {
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply';
  variableToSaveAnswer?: string;
  quickReplies?: QuickReply[];
  listOptions?: ListItem[];
  validationRegex?: string;
  errorMessage?: string;
}
export type QuestionNodeType = Node<QuestionNodeData> & { type: 'questionNode' };

// --- SetVariableNode ---
export interface VariableAssignment {
  variableName?: string;
  value?: string | number | boolean | null;
  source?: 'static' | 'expression' | 'contact_data';
  expression?: string;
  contactField?: string;
}
export interface SetVariableNodeData extends BaseNodeData {
  assignments?: VariableAssignment[];
}
export type SetVariableNodeType = Node<SetVariableNodeData> & { type: 'setVariableNode' };

// --- TagContactNode ---
export interface TagContactNodeData extends BaseNodeData {
  tagOperation?: 'add' | 'remove';
  tagName?: string;
}
export type TagContactNodeType = Node<TagContactNodeData> & { type: 'tagContactNode' };

// --- TextMessageNode ---
export interface TextMessageNodeData extends BaseNodeData {
  message?: string;
  useVariables?: boolean;
}
export type TextMessageNodeType = Node<TextMessageNodeData> & { type: 'textMessageNode' };

// --- TriggerNode ---
export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  scheduleDateTime?: string;
  exactMatch?: boolean;
}
export type TriggerNodeType = Node<TriggerNodeData> & { type: 'triggerNode' };

// ===========================================
// TIPOS PARA API E DADOS
// ===========================================

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

export interface FlowElementData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  triggerType?: string;
}

// CORRIGIDO: Adicionado avgTimeToComplete que estava faltando
export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  avgTimeToComplete?: number; // PROPRIEDADE FALTANTE ADICIONADA
  averageDurationSeconds?: number;
}

// ===========================================
// TIPOS PARA WHATSAPP TEMPLATES
// ===========================================

export interface TemplateParameter {
  type: string;
  text?: string;
}

export interface TemplateComponent {
  type: string;
  parameters?: TemplateParameter[];
}

export interface TemplateExample {
  header_text?: string[];
  body_text?: string[][];
}

export interface TemplateCategory {
  id: string;
  name: string;
}

export interface TemplateLanguage {
  code: string;
  name: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: TemplateComponent[];
}

// ===========================================
// TIPOS PARA CONVERSAS
// ===========================================

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: string;
  messageType?: 'text' | 'image' | 'audio' | 'document';
  mediaUrl?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName?: string;
  contactPhone: string;
  status: 'active' | 'resolved' | 'pending';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

// ===========================================
// FLOW RESPONSE TYPE
// ===========================================

export interface FlowResponse {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nodes: any[];
  edges: any[];
}

// ===========================================
// UNIÕES DE TIPOS
// ===========================================

export type AnyNodeData =
  | ActionNodeData
  | AiDecisionNodeData
  | ApiCallNodeData
  | ButtonsMessageNodeData
  | ClonedVoiceNodeData
  | ConditionNodeData
  | DelayNodeData
  | EndNodeData
  | ExternalDataNodeData
  | GptQueryNodeData
  | ListMessageNodeData
  | MediaMessageNodeData
  | QuestionNodeData
  | SetVariableNodeData
  | TagContactNodeData
  | TextMessageNodeData
  | TriggerNodeData;

export type AllFlowNodes =
  | ActionNodeType
  | AiDecisionNodeType
  | ApiCallNodeType
  | ButtonsMessageNodeType
  | ClonedVoiceNodeType
  | ConditionNodeType
  | DelayNodeType
  | EndNodeType
  | ExternalDataNodeType
  | GptQueryNodeType
  | ListMessageNodeType
  | MediaMessageNodeType
  | QuestionNodeType
  | SetVariableNodeType
  | TagContactNodeType
  | TextMessageNodeType
  | TriggerNodeType;
