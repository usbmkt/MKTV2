// ARQUIVO: client/src/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node, Position, XYPosition, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';

// -----------------------------------------------------------------------------
// ENUMS E TIPOS BÁSICOS (do seu arquivo zap/client/src/features/types/whatsapp_flow_types.ts)
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
  // Adicionar outros tipos de nó do seu arquivo flow.tsx se não estiverem aqui
  TIME_CONDITION = 'timeConditionNode', // Do flow.tsx
  LOOP = 'loopNode',                   // Do flow.tsx
  GO_TO_FLOW = 'goToFlowNode',           // Do flow.tsx
  ASSIGN_AGENT = 'assignAgentNode',       // Do flow.tsx
  WAIT_INPUT = 'waitInputNode',           // Do flow.tsx
}

export enum ActionType { // Do seu arquivo zap/
  START_FLOW = 'START_FLOW',
  ASSIGN_TO_AGENT = 'ASSIGN_TO_AGENT',
  SEND_EMAIL = 'SEND_EMAIL',
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  SET_CONTACT_FIELD = 'SET_CONTACT_FIELD',
  SUBSCRIBE_SEQUENCE = 'SUBSCRIBE_SEQUENCE',
  UNSUBSCRIBE_SEQUENCE = 'UNSUBSCRIBE_SEQUENCE',
  WAIT = 'WAIT',
  CALL_API = 'CALL_API', // Adicionado com base no ActionNode.tsx
  // Outros tipos de ação que seu ActionNode.tsx pode suportar
}

export enum ConditionOperator { // Do seu arquivo zap/
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  EXISTS = 'exists',         // Também como 'isSet'
  NOT_EXISTS = 'not_exists', // Também como 'isNotSet'
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  MATCHES_REGEX = 'matches_regex',
  GREATER_OR_EQUALS = 'greaterOrEquals', // Do flow.tsx
  LESS_OR_EQUALS = 'lessOrEquals',       // Do flow.tsx
}

export enum VariableType { // Do seu arquivo zap/
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  CONTACT_FIELD = 'contact_field',
  CUSTOM = 'custom',
}

export interface Variable { // Do seu arquivo zap/
  id: string;
  name: string;
  type: VariableType;
  value?: any;
  isSystem?: boolean;
}

export interface HandleData { // Do seu arquivo zap/
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
  label?: string; 
  description?: string; // Do seu arquivo zap/
  nodeType: FlowNodeType; 
  // handles?: HandleData[]; // Handles são geralmente definidos no componente do nó, não nos dados. Removido por ora.
  [key: string]: any; // Mantido para flexibilidade inicial, mas tentaremos evitar depender disso.
}

export interface TriggerNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TRIGGER;
  triggerType?: 'keyword' | 'exact_match' | 'pattern' | 'api_call' | 'manual' | 'form_submission' | 'scheduled' | ''; // Adicionado form_submission, scheduled
  keywords?: string[];
  pattern?: string; // Para triggerType 'pattern'
  formId?: string; // Para triggerType 'form_submission'
  webhookUrl?: string; // Para triggerType 'webhook' (geralmente para exibição)
  scheduleDateTime?: string; // Para triggerType 'scheduled'
  exactMatch?: boolean; // Para triggerType 'keyword'
}

export interface TextMessageNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TEXT_MESSAGE;
  message?: string; // Do seu TextMessageNode.tsx (era 'text' no flow.tsx)
}

export interface QuestionNodeData extends BaseNodeData { // Do seu QuestionNode.tsx e types/zap
  nodeType: FlowNodeType.QUESTION;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'phone' | 'date' | 'options' | 'quick_reply' | 'list_reply' | ''; // Adicionado phone, options, quick_reply, list_reply
  variableToSaveAnswer?: string; // Era variableToStoreAnswer
  options?: Array<{ id: string; label: string; value: string; nextNodeId?: string }>; // Do seu types/zap
  quickReplies?: Array<{ id: string; text: string; payload?: string; /* type?: 'reply'; title: string; */ }>; // Do seu QuestionNode.tsx
  // listOptions?: ListMessageNodeData; // Se a resposta de lista for complexa
  validationRegex?: string;
  errorMessage?: string;
  enableAiSuggestions?: boolean;
}

export interface ListMessageItem { // Do seu types/zap e ListMessageNode.tsx
  id: string;
  title: string;
  description?: string;
}
export interface ListMessageSection { // Do seu types/zap e ListMessageNode.tsx
  id: string; 
  title: string;
  rows: ListMessageItem[];
}
export interface ListMessageNodeData extends BaseNodeData { // Do seu ListMessageNode.tsx e types/zap
  nodeType: FlowNodeType.LIST_MESSAGE;
  titleText?: string; // Título da lista (no topo da UI da lista no WhatsApp)
  bodyText?: string; // Corpo da mensagem que acompanha a lista (era messageText)
  buttonText?: string; // Texto do botão que abre a lista (ex: "Ver opções")
  sections?: ListMessageSection[];
  footerText?: string;
  variableToStoreSelection?: string; // Onde salvar a seleção do usuário
}

export interface ButtonMessageItem { // Do seu types/zap e ButtonsMessageNode.tsx
  id: string; // Usado para o handle de saída e/ou payload
  type?: 'reply' | 'url' | 'call'; // Do seu types/zap (Baileys)
  title: string; // Texto do botão (era displayText)
  url?: string; // Se type for 'url'
  phoneNumber?: string; // Se type for 'call'
  // payload?: string; // Se o valor retornado for diferente do title
}
export interface ButtonsMessageNodeData extends BaseNodeData { // Do seu ButtonsMessageNode.tsx e types/zap
  nodeType: FlowNodeType.BUTTONS_MESSAGE;
  headerText?: string; // Texto, imagem URL, etc.
  bodyText: string; // Texto principal da mensagem (era messageText)
  footerText?: string;
  buttons: ButtonMessageItem[];
  variableToStoreReply?: string; // Onde salvar o ID/payload do botão clicado
}

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'; // Do seu types/zap
export interface MediaContent { // Do seu types/zap
  url: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  ptt?: boolean; // Para áudio, do seu MediaMessageNode.tsx
}
export interface MediaMessageNodeData extends BaseNodeData { // Do seu MediaMessageNode.tsx e types/zap
  nodeType: FlowNodeType.MEDIA_MESSAGE;
  mediaType?: MediaType | ''; // Adicionado ''
  media?: MediaContent; // Agrupado
  // Campos individuais para compatibilidade com seu MediaMessageNode.tsx
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  ptt?: boolean;
}

export interface ClonedVoiceNodeData extends BaseNodeData { // Do seu ClonedVoiceNode.tsx
  nodeType: FlowNodeType.CLONED_VOICE_NODE;
  textToSpeak?: string;
  voiceId?: string;
  language?: string; // Do seu types/zap
  // apiKeyVariable?: string;
}

export interface ConditionRule { // Do seu types/zap
  id: string;
  variableName: string;
  operator: ConditionOperator;
  valueToCompare: any;
  valueType?: VariableType;
}
export interface ConditionBranchConfig { // Do seu types/zap
  id: string; // ID do branch, usado para o handle de saída
  handleId: string; // ID do handle (pode ser o mesmo que o id do branch)
  label: string; // Label para o handle de saída
  rules: ConditionRule[];
  logicalOperator: 'AND' | 'OR'; 
}
export interface ConditionNodeData extends BaseNodeData { // Do seu ConditionNode.tsx e types/zap
  nodeType: FlowNodeType.CONDITION;
  // Se usar a estrutura de múltiplos branches do seu types/zap
  branchConfigs?: ConditionBranchConfig[];
  // Ou a estrutura mais simples do seu ConditionNode.tsx e flow.tsx
  variableToCheck?: string; 
  operator?: ConditionOperator;
  valueToCompare?: string; 
}

export interface DelayNodeData extends BaseNodeData { // Do seu DelayNode.tsx
  nodeType: FlowNodeType.DELAY;
  delayAmount?: number; 
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface ActionNodeData extends BaseNodeData { // Do seu ActionNode.tsx
  nodeType: FlowNodeType.ACTION;
  actionType?: ActionType | string; // string para outros tipos
  actionParams?: Record<string, any>; // Para parâmetros genéricos
  // Campos específicos que seu ActionNode.tsx usa:
  tagName?: string; 
  agentId?: string; 
  emailTemplateId?: string; 
  contactPropertyName?: string; 
  contactPropertyValue?: string | number | boolean;
  apiUrl?: string; // Para actionType 'call_api'
}

export interface VariableAssignment { // Do seu SetVariableNode.tsx
    id: string; // Adicionado para key no React
    variableName: string;
    value?: any; 
    sourceType?: 'static' | 'variable' | 'expression' | 'api_response' | 'contact_data' | 'message_data'; // Adicionado sourceType
    expression?: string; 
    apiResponsePath?: string; 
    contactField?: string;
    messagePath?: string;
}
export interface SetVariableNodeData extends BaseNodeData { // Do seu SetVariableNode.tsx
  nodeType: FlowNodeType.SET_VARIABLE;
  assignments?: VariableAssignment[]; 
}

export interface TagContactNodeData extends BaseNodeData { // Do seu TagContactNode.tsx
  nodeType: FlowNodeType.TAG_CONTACT;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
}

export interface GPTQueryNodeData extends BaseNodeData { // Do seu GptQueryNode.tsx e types/zap
  nodeType: FlowNodeType.GPT_QUERY;
  promptTemplate?: string; // Era prompt no flow.tsx e types/zap
  model?: string;
  temperature?: number;
  maxTokens?: number;
  variableToSaveResult?: string; // Era variableToStoreResponse no types/zap
  apiKeyVariable?: string; // Do flow.tsx
  systemMessage?: string; // Do types/zap
  // inputVariables?: string[]; // Se usar array de inputs
}

export interface ApiHeader { id: string; key: string; value: string; }  // Do seu types/zap
export interface ApiQueryParam { id: string; key: string; value: string; } // Do seu types/zap
export interface ApiResponseMapping { id: string; sourcePath: string; targetVariable: string; } // Do seu types/zap
export interface ApiCallNodeData extends BaseNodeData { // Do seu ApiCallNode.tsx e types/zap
  nodeType: FlowNodeType.API_CALL;
  apiUrl?: string; 
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: ApiHeader[] | string; // Permitir string para JSON ou array estruturado
  body?: string; // JSON string
  queryParams?: ApiQueryParam[];
  variableToStoreResponse?: string; // Onde salvar a resposta completa
  responsePath?: string; // JSON path para extrair um valor específico da resposta
  responseMappings?: ApiResponseMapping[]; // Mapeamentos mais detalhados
  timeoutMs?: number; // Do flow.tsx
  responseMapping?: string; // Do seu ApiCallNode.tsx (diferente de responseMappings)
}

export interface AiDecisionOutcome { // Do seu types/zap
    id: string; 
    label: string; 
    value: string; // Valor que a IA pode retornar
    handleId: string; // ID do handle de saída associado
}
export interface AiDecisionNodeData extends BaseNodeData { // Do seu AiDecisionNode.tsx e types/zap
  nodeType: FlowNodeType.AI_DECISION;
  contextPrompt?: string; // Era inputVariable no seu AiDecisionNode.tsx
  possibleOutcomes?: AiDecisionOutcome[]; // Era decisionCategories
  variableToStoreDecision?: string;
  // inputVariable?: string; // Se for manter
}

export interface ExternalDataNodeData extends BaseNodeData { // Do seu ExternalDataNode.tsx e types/zap
  nodeType: FlowNodeType.EXTERNAL_DATA;
  dataSourceUrl?: string; // Era url
  requestType?: 'GET' | 'POST'; // Era method
  requestPayload?: any; 
  responseMapping?: ApiResponseMapping[] | string; // Permitir string para mapeamento simples ou array para complexo
  saveToVariable?: string; // Do seu ExternalDataNode.tsx
}

export interface EndNodeData extends BaseNodeData { // Do seu EndNode.tsx
  nodeType: FlowNodeType.END;
  endStateType?: 'completed' | 'abandoned' | 'error' | 'error_fallback' | string; // Adicionado error_fallback
  finalMessage?: string; // Era message
}

// --- Nós Adicionais do flow.tsx ---
export interface TimeConditionNodeData extends BaseNodeData {
  nodeType: FlowNodeType.TIME_CONDITION;
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
}

export interface LoopNodeData extends BaseNodeData {
  nodeType: FlowNodeType.LOOP;
  repetitions?: number;
}

export interface GoToFlowNodeData extends BaseNodeData {
  nodeType: FlowNodeType.GO_TO_FLOW;
  targetFlowId?: string; 
}

export interface AssignAgentNodeData extends BaseNodeData {
  nodeType: FlowNodeType.ASSIGN_AGENT;
  department?: string;
  agentId?: string;
  message?: string; 
}

export interface WaitInputNodeData extends BaseNodeData {
    nodeType: FlowNodeType.WAIT_INPUT;
    variableName?: string;
    message?: string; 
    timeoutSeconds?: number;
}


// FlowNodeData é a união de todos os tipos de dados específicos
export type FlowNodeDataType =
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
  | EndNodeData
  | TimeConditionNodeData
  | LoopNodeData
  | GoToFlowNodeData
  | AssignAgentNodeData
  | WaitInputNodeData;

export type CustomFlowNode = Node<FlowNodeDataType, FlowNodeType | string | undefined>;    

export interface FlowEdgeData { 
  conditionLabel?: string; // Para exibir em arestas condicionais
  // Outros dados específicos da aresta, se houver
}
export type CustomFlowEdge = Edge<FlowEdgeData | undefined>; 

export type CustomNodeProps<TData extends FlowNodeDataType = FlowNodeDataType> = NodeProps<TData>;

export interface FlowDefinition { 
  id?: string; // Adicionado ID para o fluxo em si
  name?: string; // Adicionado nome para o fluxo
  description?: string;
  nodes: CustomFlowNode[]; 
  edges: CustomFlowEdge[]; 
  variables?: Variable[];
  // createdAt?: string | Date; // Removido, geralmente gerenciado pelo backend
  // updatedAt?: string | Date; // Removido
  status?: 'draft' | 'active' | 'inactive' | 'archived';
  viewport?: { x: number; y: number; zoom: number }; // Adicionado
}

// Tipos de Contexto (se você usar um Contexto React para o FlowBuilder)
export type FlowBuilderContextType = {
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  onNodesChange: OnNodesChange; 
  onEdgesChange: OnEdgesChange; 
  onConnect: OnConnect;         
  addNode: (type: FlowNodeType, position: XYPosition, data?: Partial<FlowNodeDataType>) => void;
  updateNodeData: <T extends FlowNodeDataType>(nodeId: string, newData: Partial<T>) => void; 
  getNodeData: <T extends FlowNodeDataType>(nodeId: string) => T | undefined;
  setNodes: React.Dispatch<React.SetStateAction<CustomFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CustomFlowEdge[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
};

// -----------------------------------------------------------------------------
// TIPOS RELACIONADOS AO WHATSAPP (Conexão, Mensagens, Templates - Mantidos do seu arquivo)
// -----------------------------------------------------------------------------
export interface WhatsAppConnectionStatus { /* ... */ }
export interface WhatsAppContact { /* ... */ }
export interface WhatsAppMessage { /* ... */ }
export interface WhatsAppTemplateCategory { /* ... */ }
export interface WhatsAppTemplateComponent { /* ... */ }
export interface WhatsAppTemplateButton { /* ... */ }
export interface WhatsAppTemplate { /* ... */ }
// (O conteúdo dessas interfaces foi omitido aqui para brevidade, mas deve ser o mesmo do seu arquivo original)
