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

export enum ConditionType {
  TAG_EXISTS = 'TAG_EXISTS',
  FIELD_VALUE_EQUALS = 'FIELD_VALUE_EQUALS',
  LAST_MESSAGE_CONTAINS = 'LAST_MESSAGE_CONTAINS',
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
// TIPOS DE DADOS PARA NÓS (NodeData)
// -----------------------------------------------------------------------------

export interface BaseNodeData {
  id: string;
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
  options?: { label: string; value: string; nextNodeId?: string }[];
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
  title: string;
  rows: ListMessageItem[];
}
export interface ListMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.LIST_MESSAGE;
  titleText: string;
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
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'starts_with'
    | 'ends_with'
    | 'exists'
    | 'not_exists'
    | 'is_empty'
    | 'is_not_empty'
    | 'matches_regex';
  valueToCompare: any;
  valueType?: VariableType;
}
export interface ConditionBranch {
  id: string;
  label: string;
  rules: ConditionRule[];
  logicalOperator: 'AND' | 'OR';
}
export interface ConditionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.CONDITION;
  branchConfigs: Array<{
    handleId: string;
    label: string;
    rules: ConditionRule[];
    logicalOperator: 'AND' | 'OR';
  }>;
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

export interface SetVariableNodeData extends BaseNodeData {
  nodeType: FlowNodeType.SET_VARIABLE;
  variableName: string;
  variableValue: any;
  valueSourceType: 'static' | 'variable' | 'expression' | 'api_response';
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

export interface ApiCallNodeData extends BaseNodeData {
  nodeType: FlowNodeType.API_CALL;
  apiUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
  variableToStoreResponse?: string;
  responsePath?: string;
}

export interface AiDecisionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.AI_DECISION;
  contextPrompt: string;
  possibleOutcomes: Array<{ label: string; value: string; handleId: string }>;
  variableToStoreDecision?: string;
}

export interface ExternalDataNodeData extends BaseNodeData {
  nodeType: FlowNodeType.EXTERNAL_DATA;
  dataSourceUrl: string;
  requestType: 'GET' | 'POST';
  requestPayload?: any;
  responseMapping: Array<{ sourcePath: string; targetVariable: string }>;
}

export interface EndNodeData extends BaseNodeData {
  nodeType: FlowNodeType.END;
  endStateType?: 'completed' | 'abandoned' | 'error';
  finalMessage?: string;
}

// -----------------------------------------------------------------------------
// TIPOS DE DADOS GENÉRICOS PARA React Flow (Node e Edge)
// -----------------------------------------------------------------------------

export type FlowNodeSpecificData =
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

export type FlowNodeData<T extends FlowNodeSpecificData = FlowNodeSpecificData> = T;

// Correção para erro TS2344: Garantir que o tipo do nó seja sempre uma string.
// FlowNodeType é um enum string, e `string` é string. Extract garante que o resultado seja string.
export type CustomFlowNodeType = Extract<FlowNodeType | string, string>;
export type CustomFlowNode = Node<FlowNodeData, CustomFlowNodeType>;


export interface FlowEdgeData {
  conditionLabel?: string;
}
export type CustomFlowEdge = Edge<FlowEdgeData>;

// -----------------------------------------------------------------------------
// PROPS PARA COMPONENTES DE NÓ CUSTOMIZADOS
// -----------------------------------------------------------------------------
export type CustomNodeProps<T extends FlowNodeSpecificData> = ReactFlowNodeProps<FlowNodeData<T>>;

export type TriggerNodeProps = CustomNodeProps<TriggerNodeData>;
export type TextMessageNodeProps = CustomNodeProps<TextMessageNodeData>;
export type QuestionNodeProps = CustomNodeProps<QuestionNodeData>;
export type ListMessageNodeProps = CustomNodeProps<ListMessageNodeData>;
export type ButtonsMessageNodeProps = CustomNodeProps<ButtonsMessageNodeData>;
export type MediaMessageNodeProps = CustomNodeProps<MediaMessageNodeData>;
export type ClonedVoiceNodeProps = CustomNodeProps<ClonedVoiceNodeData>;
export type ConditionNodeProps = CustomNodeProps<ConditionNodeData>;
export type DelayNodeProps = CustomNodeProps<DelayNodeData>;
export type ActionNodeProps = CustomNodeProps<ActionNodeData>;
export type SetVariableNodeProps = CustomNodeProps<SetVariableNodeData>;
export type TagContactNodeProps = CustomNodeProps<TagContactNodeData>;
export type GptQueryNodeProps = CustomNodeProps<GptQueryNodeData>;
export type ApiCallNodeProps = CustomNodeProps<ApiCallNodeData>;
export type AiDecisionNodeProps = CustomNodeProps<AiDecisionNodeData>;
export type ExternalDataNodeProps = CustomNodeProps<ExternalDataNodeData>;
export type EndNodeProps = CustomNodeProps<EndNodeData>;

// -----------------------------------------------------------------------------
// TIPOS PARA O ESTADO DO FLOW BUILDER E OPERAÇÕES
// -----------------------------------------------------------------------------
export interface FlowData {
  id: string;
  name: string;
  description?: string;
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  variables?: Variable[];
  trigger?: TriggerNodeData; 
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type FlowBuilderContextType = {
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: FlowNodeType, position: XYPosition, data?: Partial<FlowNodeData>) => void;
  updateNodeData: <T extends FlowNodeSpecificData>(nodeId: string, newData: Partial<T>) => void;
  getNodeData: <T extends FlowNodeSpecificData>(nodeId: string) => FlowNodeData<T> | undefined;
  setNodes: React.Dispatch<React.SetStateAction<CustomFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CustomFlowEdge[]>>;
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
  status: 'draft' | 'active' | 'inactive' | 'archived';
  version?: number;
  totalUsers?: number;
  completionRate?: number;
  averageTime?: number;
  triggerKeywords?: string[];
}
