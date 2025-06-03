import { Node, Edge, Position, XYPosition, OnNodesChange, OnEdgesChange, OnConnect, NodeProps as ReactFlowNodeProps, EdgeProps as ReactFlowEdgeProps } from '@xyflow/react';

// -----------------------------------------------------------------------------
// ENUMS E TIPOS BÁSICOS
// -----------------------------------------------------------------------------

export enum FlowNodeType {
  TRIGGER = 'triggerNode',
  TEXT_MESSAGE = 'textMessageNode',
  QUESTION = 'questionNode',
  LIST_MESSAGE = 'listMessageNode',
  BUTTONS_MESSAGE = 'buttonsMessageNode',
  MEDIA_MESSAGE = 'mediaMessageNode',
  CLONED_VOICE_NODE = 'clonedVoiceNode',
  CONDITION = 'conditionNode',
  DELAY = 'delayNode',
  ACTION = 'actionNode',
  SET_VARIABLE = 'setVariableNode',
  TAG_CONTACT = 'tagContactNode',
  GPT_QUERY = 'gptQueryNode',
  API_CALL = 'apiCallNode',
  AI_DECISION = 'aiDecisionNode',
  EXTERNAL_DATA = 'externalDataNode',
  END = 'endNode',
}

export enum ActionType {
  START_FLOW = 'START_FLOW',
  ASSIGN_TO_AGENT = 'ASSIGN_TO_AGENT',
  SEND_EMAIL = 'SEND_EMAIL',
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  SET_CONTACT_FIELD = 'SET_CONTACT_FIELD',
  SUBSCRIBE_SEQUENCE = 'SUBSCRIBE_SEQUENCE',
  UNSUBSCRIBE_SEQUENCE = 'UNSUBSCRIBE_SEQUENCE',
  WAIT = 'WAIT',
}

// ConditionType não é usado diretamente nos dados do nó Condição,
// mas pode ser útil para selectores de UI. As regras estão em branchConfigs.
export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  MATCHES_REGEX = 'matches_regex',
}


export enum VariableType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  CONTACT_FIELD = 'contact_field',
  CUSTOM = 'custom',
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value?: any;
  isSystem?: boolean;
}

export interface HandleData {
  id: string;
  label: string;
  position: Position;
  type: 'source' | 'target';
  isConnectable?: boolean;
  style?: React.CSSProperties;
}

// -----------------------------------------------------------------------------
// TIPOS DE DADOS PARA NÓS (NodeData) - O que vai em `node.data`
// -----------------------------------------------------------------------------

export interface BaseNodeData {
  label: string; 
  description?: string;
  nodeType: FlowNodeType; 
  handles?: HandleData[];
}

export interface TriggerNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TRIGGER;
  triggerType: 'keyword' | 'exact_match' | 'pattern' | 'api_call' | 'manual';
  keywords?: string[];
  pattern?: string;
}

export interface TextMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TEXT_MESSAGE;
  message: string;
}

export interface QuestionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.QUESTION;
  questionText: string;
  expectedResponseType: 'text' | 'number' | 'email' | 'phone' | 'date' | 'options';
  variableToStoreAnswer: string;
  options?: Array<{ id: string; label: string; value: string; nextNodeId?: string }>; // Adicionado ID para options
  validationRegex?: string;
  errorMessage?: string;
  enableAiSuggestions?: boolean;
}

export interface ListMessageItem {
  id: string;
  title: string;
  description?: string;
}
export interface ListMessageSection {
  id: string; // Adicionado ID para sections
  title: string;
  rows: ListMessageItem[];
}
export interface ListMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.LIST_MESSAGE;
  titleText?: string; 
  bodyText: string; 
  buttonText: string; 
  sections: ListMessageSection[];
  footerText?: string;
  variableToStoreSelection?: string;
}

export interface ButtonMessageItem { 
  id: string;
  type: 'reply' | 'url' | 'call';
  title: string;
  url?: string;
  phoneNumber?: string;
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.BUTTONS_MESSAGE;
  headerText?: string;
  bodyText: string; 
  footerText?: string;
  buttons: ButtonMessageItem[];
  variableToStoreReply?: string;
}

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';
export interface MediaContent {
  url: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}
export interface MediaMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.MEDIA_MESSAGE;
  mediaType: MediaType;
  media: MediaContent; 
}

export interface ClonedVoiceNodeData extends BaseNodeData {
  nodeType: FlowNodeType.CLONED_VOICE_NODE;
  textToSpeak: string;
  voiceId: string;
  language?: string;
}

export interface ConditionRule {
  id: string;
  variableName: string;
  operator: ConditionOperator;
  valueToCompare: any;
  valueType?: VariableType;
}

export interface ConditionBranchConfig { // Renomeado para evitar conflito com ConditionBranch (não definido)
  id: string; // Para key no map
  handleId: string; 
  label: string; 
  rules: ConditionRule[];
  logicalOperator: 'AND' | 'OR'; 
}
export interface ConditionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.CONDITION;
  branchConfigs: ConditionBranchConfig[];
}

export interface DelayNodeData extends BaseNodeData {
  nodeType: FlowNodeType.DELAY;
  delayDuration: number; 
  delayUnit: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface ActionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.ACTION;
  actionType: ActionType;
  actionParams?: Record<string, any>; 
}

export interface VariableAssignment { 
    id: string; // Adicionado ID para key no map
    variableName: string;
    value: any; 
    sourceType: 'static' | 'variable' | 'expression' | 'api_response'; 
    expression?: string; 
    apiResponsePath?: string; 
}
export interface SetVariableNodeData extends BaseNodeData {
  nodeType: FlowNodeType.SET_VARIABLE;
  assignments: VariableAssignment[]; 
}

export interface TagContactNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TAG_CONTACT;
  tagOperation: 'add' | 'remove';
  tagName: string;
}

export interface GptQueryNodeData extends BaseNodeData { 
  nodeType: FlowNodeType.GPT_QUERY;
  prompt: string; 
  model?: string;
  temperature?: number;
  maxTokens?: number;
  variableToStoreResponse: string; 
}

export interface ApiHeader { id: string; key: string; value: string; } // Para headers de API
export interface ApiQueryParam { id: string; key: string; value: string; } // Para query params
export interface ApiResponseMapping { id: string; sourcePath: string; targetVariable: string; } // Para response mapping
export interface ApiCallNodeData extends BaseNodeData {
  nodeType: FlowNodeType.API_CALL;
  apiUrl: string; 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: ApiHeader[]; 
  body?: string; // JSON string
  queryParams?: ApiQueryParam[];
  variableToStoreResponse?: string;
  responsePath?: string; // JSONPath para extrair uma parte específica da resposta
  responseMappings?: ApiResponseMapping[]; // Mapeamento mais granular de partes da resposta
}

export interface AiDecisionOutcome { // Renomeado de AiDecisionPossibleOutcome
    id: string; // Para key
    label: string; 
    value: string; 
    handleId: string;
}
export interface AiDecisionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.AI_DECISION;
  contextPrompt: string; 
  possibleOutcomes: AiDecisionOutcome[]; 
  variableToStoreDecision?: string;
}

export interface ExternalDataNodeData extends BaseNodeData { 
  nodeType: FlowNodeType.EXTERNAL_DATA;
  dataSourceUrl: string;
  requestType: 'GET' | 'POST';
  requestPayload?: any; // JSON string ou objeto
  responseMapping: ApiResponseMapping[]; // Reutilizado ApiResponseMapping
}

export interface EndNodeData extends BaseNodeData {
  nodeType: FlowNodeType.END;
  endStateType?: 'completed' | 'abandoned' | 'error';
  finalMessage?: string; 
}

export type FlowNodeData = // Renomeado de FlowNodeSpecificData para simplicidade
  | TriggerNodeData
  | TextMessageNodeData
  | QuestionNodeData
  | ListMessageNodeData
  | ButtonsMessageNodeData
  | MediaMessageNodeData
  | ClonedVoiceNodeData
  | ConditionNodeData
  | DelayNodeData
  | ActionNodeData
  | SetVariableNodeData
  | TagContactNodeData
  | GptQueryNodeData
  | ApiCallNodeData
  | AiDecisionNodeData
  | ExternalDataNodeData
  | EndNodeData;

// Tipos para Node e Edge do React Flow
export type CustomFlowNodeType = Extract<FlowNodeType | string, string>; 
export type CustomFlowNode<T extends FlowNodeData = FlowNodeData> = Node<T, CustomFlowNodeType>;    

export interface FlowEdgeData { 
  conditionLabel?: string;
}
export type CustomFlowEdge<T extends FlowEdgeData | undefined = FlowEdgeData> = Edge<T>; 

// Props para os componentes de nó customizados.
export type CustomNodeProps<TData extends FlowNodeData> = ReactFlowNodeProps<TData>;


export interface FlowData { 
  id: string;
  name: string;
  description?: string;
  nodes: CustomFlowNode<FlowNodeData>[]; // Usar FlowNodeData como tipo de dados padrão
  edges: CustomFlowEdge<FlowEdgeData | undefined>[]; 
  variables?: Variable[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  status?: 'draft' | 'active' | 'inactive' | 'archived';
}

export type FlowBuilderContextType = {
  nodes: CustomFlowNode<FlowNodeData>[];
  edges: CustomFlowEdge<FlowEdgeData | undefined>[];
  onNodesChange: OnNodesChange; 
  onEdgesChange: OnEdgesChange; 
  onConnect: OnConnect;         
  addNode: (type: FlowNodeType, position: XYPosition, data?: Partial<FlowNodeData>) => void;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>) => void; 
  getNodeData: <T extends FlowNodeData>(nodeId: string) => T | undefined;
  setNodes: React.Dispatch<React.SetStateAction<CustomFlowNode<FlowNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CustomFlowEdge<FlowEdgeData | undefined>[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
};

// -----------------------------------------------------------------------------
// TIPOS RELACIONADOS AO WHATSAPP (Conexão, Mensagens, Templates)
// -----------------------------------------------------------------------------
export interface WhatsAppConnectionStatus {
  instanceName: string;
  qrCode?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'needs_qr_scan' | 'generating_qr';
  message?: string;
  phoneNumber?: string;
  deviceName?: string;
  batteryLevel?: number;
  platform?: string;
  lastConnectionAt?: string | Date;
  errorDetails?: any;
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  profilePicUrl?: string;
  isBlocked?: boolean;
  lastMessage?: string;
  lastMessageTimestamp?: number | Date;
  unreadCount?: number;
  tags?: string[];
  assignedAgent?: string;
  isBotActive?: boolean;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'vcard' | 'list_response' | 'buttons_response' | 'order' | 'system' | 'unknown';
  timestamp: number | Date;
  isSentByMe: boolean;
  isRead?: boolean;
  isDelivered?: boolean;
  quotedMsg?: WhatsAppMessage;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  interactiveData?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  error?: any;
}

export interface WhatsAppTemplateCategory {
  id: string; 
  name: string; 
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[];
    body_text?: any[][];
  };
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'FLOW';
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string[];
  flow_id?: string;
  flow_action?: 'navigate' | 'data_exchange';
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL';
  category: string; 
  components: WhatsAppTemplateComponent[];
  qualityScore?: {
    score: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    lastUpdated: string | Date;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
  tags?: string[];
  usageCount?: number;
}

export interface WhatsAppSavedFlow extends FlowData {
  waFlowId?: string;
  version?: number;
  totalUsers?: number;
  completionRate?: number;
  averageTime?: number;
  triggerKeywords?: string[];
}

export type ApiError = {
  message: string;
  statusCode?: number;
  details?: any;
};

export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; 
  averageDurationSeconds: number; 
  errorCount?: number;
}
