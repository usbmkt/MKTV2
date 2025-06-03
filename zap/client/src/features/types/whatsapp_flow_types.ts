import type { Node } from '@xyflow/react'; // Ensure this import is correct based on your project setup

// Definição base para todos os dados de nós customizados
export interface BaseNodeData {
  label?: string;
  [key: string]: any; // Consider making this more specific if possible
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
export type ActionNodeType = Node<ActionNodeData, 'actionNode'>;

// --- AiDecisionNode ---
export interface AiDecisionNodeData extends BaseNodeData {
  prompt?: string;
  variableToStoreDecision?: string;
  possibleOutcomes?: Array<{ outcome: string; description: string }>;
  apiKeyVariable?: string;
}
export type AiDecisionNodeType = Node<AiDecisionNodeData, 'aiDecisionNode'>;

// --- ApiCallNode ---
export interface ApiCallNodeData extends BaseNodeData {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  responseVariable?: string;
  timeout?: number;
}
export type ApiCallNodeType = Node<ApiCallNodeData, 'apiCallNode'>;

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
export type ButtonsMessageNodeType = Node<ButtonsMessageNodeData, 'buttonsMessageNode'>;

// --- ClonedVoiceNode ---
export interface ClonedVoiceNodeData extends BaseNodeData {
  textToSpeak?: string;
  voiceId?: string;
  apiKeyVariable?: string;
  language?: string;
  outputFormat?: 'mp3' | 'wav';
  variableToStoreUrl?: string;
}
export type ClonedVoiceNodeType = Node<ClonedVoiceNodeData, 'clonedVoiceNode'>;

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
export type ConditionNodeType = Node<ConditionNodeData, 'conditionNode'>;

// --- DelayNode ---
export interface DelayNodeData extends BaseNodeData {
  delayValue?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours';
}
export type DelayNodeType = Node<DelayNodeData, 'delayNode'>;

// --- EndNode ---
export interface EndNodeData extends BaseNodeData {
  endMessage?: string;
  status?: 'completed' | 'failed' | 'terminated';
}
export type EndNodeType = Node<EndNodeData, 'endNode'>;

// --- ExternalDataNode ---
export interface ExternalDataNodeData extends BaseNodeData {
  dataSourceUrl?: string;
  requestType?: 'GET' | 'POST';
  requestBody?: string;
  headers?: Array<{ key: string; value: string }>;
  variableToStoreData?: string;
}
export type ExternalDataNodeType = Node<ExternalDataNodeData, 'externalDataNode'>;

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
export type GptQueryNodeType = Node<GptQueryNodeData, 'gptQueryNode'>;

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
export type ListMessageNodeType = Node<ListMessageNodeData, 'listMessageNode'>;

// Added based on error TS2724, assuming it's a frontend-specific variant
export interface ListMessageNodeDataFE extends ListMessageNodeData {
    // Frontend-specific properties for ListMessageNodeData, if any
}


// --- MediaMessageNode ---
export interface MediaMessageNodeData extends BaseNodeData {
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}
export type MediaMessageNodeType = Node<MediaMessageNodeData, 'mediaMessageNode'>;

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
  listOptions?: ListItem[]; // Assuming ListItem defined for ListMessageNode can be reused
  validationRegex?: string;
  errorMessage?: string;
}
export type QuestionNodeType = Node<QuestionNodeData, 'questionNode'>;

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
export type SetVariableNodeType = Node<SetVariableNodeData, 'setVariableNode'>;

// --- TagContactNode ---
export interface TagContactNodeData extends BaseNodeData {
  tagOperation?: 'add' | 'remove';
  tagName?: string;
}
export type TagContactNodeType = Node<TagContactNodeData, 'tagContactNode'>;

// --- TextMessageNode ---
export interface TextMessageNodeData extends BaseNodeData {
  message?: string;
  useVariables?: boolean;
}
export type TextMessageNodeType = Node<TextMessageNodeData, 'textMessageNode'>;

// --- TriggerNode ---
export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  scheduleDateTime?: string; // Ensure this is a string representation, e.g., ISO 8601
  exactMatch?: boolean;
}
export type TriggerNodeType = Node<TriggerNodeData, 'triggerNode'>;

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
  createdAt: string; // Consider using Date type if objects are instantiated, string for JSON
  updatedAt: string; // Consider using Date type
  status: 'draft' | 'active' | 'inactive' | 'archived';
  triggerType?: string; // Or a more specific union of trigger types
}

export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  // CORRIGIDO: Adicionado avgTimeToComplete que estava faltando
  avgTimeToComplete?: number; // PROPRIEDADE FALTANTE ADICIONADA (in seconds or a specific unit)
  averageDurationSeconds?: number; // This seems redundant if avgTimeToComplete is present and defined
}

// ===========================================
// TIPOS PARA WHATSAPP TEMPLATES
// ===========================================

export interface TemplateParameter {
  type: string; // e.g., 'text', 'currency', 'date_time', 'document', 'image', 'video'
  text?: string;
  // Add other parameter types as needed, e.g., for media:
  // document?: { link: string; filename: string; };
  // image?: { link: string; };
  // video?: { link: string; };
}

export interface TemplateButtonParameter {
  type: 'text'; // Typically, button parameters are text
  text: string;
}
export interface TemplateButton {
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'FLOW'; // Add other WhatsApp button types as needed
    text: string;
    url?: string; // For URL buttons
    phone_number?: string; // For PHONE_NUMBER buttons
    example?: string[]; // For variable URL buttons
    flow_id?: string; // For FLOW buttons
    flow_action?: string; // For FLOW buttons
    // copy_code_text?: string; // For COPY_CODE if it's different from button text
}


export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION'; // For HEADER
  text?: string; // For HEADER (format TEXT), BODY, FOOTER
  example?: TemplateExample; // For components with variables
  buttons?: TemplateButton[]; // For BUTTONS component
  parameters?: TemplateParameter[]; // Generally used for sending, not defining structure usually.
                                   // The 'example' field handles placeholders during template creation.
}

export interface TemplateExample { // More specific example structure
  header_handle?: string[]; // For media template header variables
  header_text?: string[];   // For text template header variables
  body_text?: string[][];   // For body variables
  // Buttons examples are usually part of the button definition itself if they contain variables
}


export interface TemplateCategory { // This is usually a string, not an object with id/name
  // WhatsApp typically uses predefined strings like 'MARKETING', 'UTILITY', 'AUTHENTICATION'
  // If you define your own categories, this structure is fine.
  id: string;
  name: string;
}

export interface TemplateLanguage { // This is usually a string code, e.g., 'en_US', 'pt_BR'
  // If you define your own language objects, this structure is fine.
  code: string;
  name: string;
}

export interface WhatsAppTemplate {
  id: string; // ID from WhatsApp/Meta after submission
  name: string; // Template name
  category: string; // e.g., 'MARKETING', 'UTILITY' (WhatsApp predefined categories)
  language: string; // e.g., 'en_US', 'pt_BR' (WhatsApp language code)
  status: string; // e.g., 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'
  components: TemplateComponent[];
}

// ===========================================
// TIPOS PARA CONVERSAS
// ===========================================

export interface Message {
  id: string;
  conversationId: string;
  content: string; // Or a more complex object if messages can have rich content beyond text
  sender: 'user' | 'bot' | 'agent'; // Added 'agent' if applicable
  timestamp: string; // Consider Date type
  messageType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'template';
  mediaUrl?: string;
  fileName?: string; // For documents
  mimeType?: string; // For media/documents
  // Add other message-specific fields, e.g., for interactive messages, location, etc.
}

export interface Conversation {
  id: string;
  contactId: string; // ID of the contact/user
  contactName?: string;
  contactPhone: string; // E.164 format
  status: 'active' | 'resolved' | 'pending' | 'archived' | 'spam';
  lastMessage?: string; // Snippet of the last message
  lastMessageTime?: string; // Consider Date type
  unreadCount?: number;
  // Add other relevant conversation metadata, e.g., assignedAgentId, tags, etc.
}

// ===========================================
// FLOW RESPONSE TYPE
// ===========================================

export interface FlowResponse { // This is likely the response when fetching a specific flow definition
  id: string;
  name: string;
  description?: string;
  status: string; // e.g., 'draft', 'published' - same as FlowElementData.status?
  createdAt: string; // Consider Date
  updatedAt: string; // Consider Date
  nodes: AllFlowNodes[]; // Array of actual node objects
  edges: any[]; // Define Edge type from React Flow if needed: Edge[]
  // Add other flow-specific metadata
}

// ===========================================
// UNIÕES DE TIPOS
// ===========================================

// Union of all possible node data types
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
  | ExternalDataFetchNodeDataFE // Added
  | GptQueryNodeData
  | ListMessageNodeData
  | ListMessageNodeDataFE // Added
  | MediaMessageNodeData
  | QuestionNodeData
  | SetVariableNodeData
  | TagContactNodeData
  | TextMessageNodeData
  | TriggerNodeData;

// Union of all possible fully-typed flow node types
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
  // If ExternalDataFetchNodeDataFE corresponds to a distinct node type:
  // | Node<ExternalDataFetchNodeDataFE, 'externalDataFetchFENode'> 
  | GptQueryNodeType
  | ListMessageNodeType
  // If ListMessageNodeDataFE corresponds to a distinct node type:
  // | Node<ListMessageNodeDataFE, 'listMessageFENode'>
  | MediaMessageNodeType
  | QuestionNodeType
  | SetVariableNodeType
  | TagContactNodeType
  | TextMessageNodeType
  | TriggerNodeType;
