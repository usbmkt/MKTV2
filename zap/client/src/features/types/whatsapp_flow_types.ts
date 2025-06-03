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
  GPT_QUERY = 'gptQueryNode', // Corrigido: GptQueryNode
  API_CALL = 'apiCallNode',
  AI_DECISION = 'aiDecisionNode',
  EXTERNAL_DATA = 'externalDataNode', // Corrigido: ExternalDataNode
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
// TIPOS DE DADOS PARA NÓS (NodeData) - O que vai em `node.data`
// -----------------------------------------------------------------------------

export interface BaseNodeData {
  id: string; // Este ID é o ID lógico do nó dentro da definição do fluxo, não o ID do React Flow.
              // React Flow gerencia seu próprio ID único para cada instância de nó no canvas.
              // No entanto, para consistência e facilidade, muitas vezes o data.id pode espelhar o node.id.
  label: string;
  description?: string;
  nodeType: FlowNodeType; // O tipo do nó, usado para mapear para um componente.
  handles?: HandleData[]; // Definições customizadas de handles se necessário.
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
  options?: Array<{ label: string; value: string; nextNodeId?: string }>; // QuickReply/Button-like options
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
  titleText: string; // Título da mensagem que aparece antes da lista (opcional)
  bodyText: string; // Corpo da mensagem (obrigatório)
  buttonText: string; // Texto do botão que abre a lista (obrigatório)
  sections: ListMessageSection[];
  footerText?: string;
  variableToStoreSelection?: string;
}

export interface ButtonMessageItem { // Renomeado de ButtonOptionData para consistência
  id: string;
  type: 'reply' | 'url' | 'call';
  title: string;
  url?: string;
  phoneNumber?: string;
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.BUTTONS_MESSAGE;
  headerText?: string;
  bodyText: string; // Renomeado de messageText
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
  media: MediaContent; // URL, caption etc. (mediaUrl e fileName podem ser parte de 'media')
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

export interface ConditionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.CONDITION;
  // A lógica de 'branches' agora é gerenciada pelos handles de saída.
  // Cada handle de saída pode ter um conjunto de regras associadas.
  // Esta estrutura define a configuração para cada handle de saída.
  branchConfigs: Array<{
    handleId: string; // ID do source handle (ex: 'trueOutput', 'age_gt_18_output')
    label: string; // Label para o handle ou para a condição no editor de propriedades
    rules: ConditionRule[];
    logicalOperator: 'AND' | 'OR'; // Como as regras são combinadas para este branch
  }>;
  // variableToCheck?: string; // Deprecated: use branchConfigs
  // operator?: ConditionType; // Deprecated: use branchConfigs
  // valueToCompare?: string; // Deprecated: use branchConfigs
}

export interface DelayNodeData extends BaseNodeData {
  nodeType: FlowNodeType.DELAY;
  delayDuration: number; // Renomeado de delayAmount
  delayUnit: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface ActionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.ACTION;
  actionType: ActionType;
  actionParams?: Record<string, any>; // Ex: { tagName: 'lead' } ou { agentId: 'some_agent_id' }
                                      // { contactPropertyName: 'city', contactPropertyValue: 'New York' }
                                      // { apiUrl: '...', emailTemplateId: '...' }
}

export interface VariableAssignment { // Tipo para SetVariableNode
    variableName: string;
    value: any; // Pode ser estático ou outra variável {{var}}
    sourceType: 'static' | 'variable' | 'expression' | 'api_response'; // como o valor é determinado
    expression?: string; // se sourceType for expression
    apiResponsePath?: string; // se sourceType for api_response (json path)
}
export interface SetVariableNodeData extends BaseNodeData {
  nodeType: FlowNodeType.SET_VARIABLE;
  assignments: VariableAssignment[]; // Múltiplas atribuições
}

export interface TagContactNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TAG_CONTACT;
  tagOperation: 'add' | 'remove';
  tagName: string;
}

export interface GptQueryNodeData extends BaseNodeData { // Nome corrigido
  nodeType: FlowNodeType.GPT_QUERY;
  prompt: string; // Renomeado de promptTemplate
  model?: string;
  temperature?: number;
  maxTokens?: number;
  variableToStoreResponse: string; // Renomeado de variableToSaveResult
}

export interface ApiCallNodeData extends BaseNodeData {
  nodeType: FlowNodeType.API_CALL;
  apiUrl: string; // Renomeado de url
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>; // string de JSON -> Record
  body?: string; // string de JSON ou objeto
  queryParams?: Record<string, string>;
  variableToStoreResponse?: string;
  responsePath?: string;
  // responseMapping?: Array<{ sourcePath: string; targetVariable: string }>; // Pode ser mais granular
}

export interface AiDecisionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.AI_DECISION;
  contextPrompt: string; // Pergunta ou contexto para a IA
  possibleOutcomes: Array<{ label: string; value: string; handleId: string }>; // Cada outcome é um source handle
  variableToStoreDecision?: string;
  // inputVariable?: string; // Opcional, variável de entrada para a IA
  // decisionCategories?: Array<{ categoryName: string; keywords: string[] }>; // Deprecated: usar possibleOutcomes
}

export interface ExternalDataNodeData extends BaseNodeData { // Nome corrigido
  nodeType: FlowNodeType.EXTERNAL_DATA;
  dataSourceUrl: string;
  requestType: 'GET' | 'POST';
  requestPayload?: any;
  responseMapping: Array<{ sourcePath: string; targetVariable: string }>;
}

export interface EndNodeData extends BaseNodeData {
  nodeType: FlowNodeType.END;
  endStateType?: 'completed' | 'abandoned' | 'error';
  finalMessage?: string; // Renomeado de message
}

// -----------------------------------------------------------------------------
// TIPOS DE DADOS GENÉRICOS PARA React Flow (Node e Edge)
// -----------------------------------------------------------------------------

// União de todos os tipos de dados de nó específicos.
// Esta é a forma do objeto `node.data` para qualquer um dos nossos nós customizados.
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

// Tipo genérico para os dados de um nó no React Flow
export type FlowNodeData<T extends FlowNodeSpecificData = FlowNodeSpecificData> = T;

// Tipo para o `type` de um nó, garantindo que seja uma string.
export type CustomFlowNodeType = Extract<FlowNodeType | string, string>;

// Nó customizado do React Flow. O primeiro genérico é o tipo do `node.data`, o segundo é o `node.type`.
export type CustomFlowNode = Node<FlowNodeData, CustomFlowNodeType>;

// Dados para arestas
export interface FlowEdgeData {
  conditionLabel?: string; // Ex: "Sim", "Não", "Opção A"
}
export type CustomFlowEdge = Edge<FlowEdgeData>;

// -----------------------------------------------------------------------------
// PROPS PARA COMPONENTES DE NÓ CUSTOMIZADOS
// -----------------------------------------------------------------------------
// Usamos NodeProps do React Flow, especializado com nosso FlowNodeData para o `data` prop.
// T será um dos ...NodeData (ex: TextMessageNodeData)
export type CustomNodeProps<T extends FlowNodeSpecificData> = ReactFlowNodeProps<T>;


// -----------------------------------------------------------------------------
// TIPOS PARA O ESTADO DO FLOW BUILDER E OPERAÇÕES
// -----------------------------------------------------------------------------
export interface FlowData { // Representa um fluxo salvo
  id: string;
  name: string;
  description?: string;
  nodes: CustomFlowNode[]; // Os nós do React Flow
  edges: CustomFlowEdge[]; // As arestas do React Flow
  variables?: Variable[];
  // trigger?: TriggerNodeData; // O nó de trigger pode ser encontrado dentro de `nodes`
  createdAt?: string | Date;
  updatedAt?: string | Date;
  status?: 'draft' | 'active' | 'inactive' | 'archived';
  // Outros metadados do fluxo
}

export type FlowBuilderContextType = {
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: FlowNodeType, position: XYPosition, data?: Partial<FlowNodeData>) => void;
  updateNodeData: <T extends FlowNodeSpecificData>(nodeId: string, newData: Partial<T>) => void;
  getNodeData: <T extends FlowNodeSpecificData>(nodeId: string) => T | undefined;
  setNodes: React.Dispatch<React.SetStateAction<CustomFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CustomFlowEdge[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  // Adicionar outras funções e estados conforme necessário
};

// -----------------------------------------------------------------------------
// TIPOS RELACIONADOS AO WHATSAPP (Conexão, Mensagens, Templates)
// (Mantidos consistentes com a versão anterior para compatibilidade com ZapConversations etc.)
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

// Tipos que não existem mais ou foram substituídos
// export type ApiError = any; // Substituído por tratamento de erro específico
// export type FlowPerformanceData = any; // Precisa ser definido com base nos dados reais
// export type FlowElementData = any; // Usar CustomFlowNode ou FlowNodeData
// QuickReply e ListItem foram integrados em QuestionNodeData e ListMessageNodeData
// export type ButtonOptionData = ButtonMessageItem; // Renomeado e integrado

export interface WhatsAppSavedFlow extends FlowData {
  waFlowId?: string;
  // status: 'draft' | 'active' | 'inactive' | 'archived'; // Já em FlowData
  version?: number;
  totalUsers?: number;
  completionRate?: number;
  averageTime?: number;
  triggerKeywords?: string[];
}
