import { Node } from '@xyflow/react';

// Interface base para todos os dados de nós customizados
export interface BaseNodeData {
  label?: string; // Usado por muitos nós como título/etiqueta
  [key: string]: any; // Permite propriedades específicas de cada nó
}

// 1. Tipos para os Nós do Flow Builder

// --- ActionNode ---
export interface ActionNodeData extends BaseNodeData {
  actionType?: string; // e.g., 'webhook', 'database', 'sendMessage'
  url?: string; // Para webhook
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Para webhook
  headers?: Array<{ key: string; value: string }>; // Para webhook
  body?: string; // Para webhook (string JSON)
  databaseOperation?: 'insert' | 'update' | 'select' | 'delete'; // Para banco de dados
  tableName?: string; // Para banco de dados
  dataToInsert?: string; // Para banco de dados (string JSON)
  updateCriteria?: string; // Para banco de dados (string JSON)
  dataToUpdate?: string; // Para banco de dados (string JSON)
  selectQuery?: string; // Para banco de dados
  deleteCriteria?: string; // Para banco de dados
  messageContent?: string; // Para sendMessage
  recipientVariable?: string; // Para sendMessage
}
export type ActionNodeType = Node<ActionNodeData, 'actionNode'>;

// --- AiDecisionNode ---
export interface AiDecisionNodeData extends BaseNodeData {
  prompt?: string;
  variableToStoreDecision?: string;
  possibleOutcomes?: Array<{ outcome: string; description: string }>;
  apiKeyVariable?: string; // Nome da variável que armazena a chave API (e.g., Gemini)
}
export type AiDecisionNodeType = Node<AiDecisionNodeData, 'aiDecisionNode'>;

// --- ApiCallNode ---
export interface ApiCallNodeData extends BaseNodeData {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string; // String JSON
  responseVariable?: string; // Variável para armazenar a resposta da API
  timeout?: number; // Em milissegundos
}
export type ApiCallNodeType = Node<ApiCallNodeData, 'apiCallNode'>;

// --- ButtonsMessageNode ---
export interface ButtonItem {
  id: string;
  text: string;
  payload?: string; // Opcional, para identificar o botão clicado
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
  voiceId?: string; // ID da voz clonada (e.g., ElevenLabs)
  apiKeyVariable?: string; // Nome da variável que armazena a chave API (e.g., ElevenLabs)
  language?: string;
  outputFormat?: 'mp3' | 'wav';
  variableToStoreUrl?: string; // Variável para armazenar a URL do áudio gerado
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
  logicalOperator?: 'AND' | 'OR'; // Como as condições são combinadas
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
  endMessage?: string; // Mensagem opcional ao finalizar o fluxo
  status?: 'completed' | 'failed' | 'terminated';
}
export type EndNodeType = Node<EndNodeData, 'endNode'>;

// --- ExternalDataNode ---
export interface ExternalDataNodeData extends BaseNodeData {
  dataSourceUrl?: string; // URL para buscar dados externos
  requestType?: 'GET' | 'POST';
  requestBody?: string; // String JSON, se POST
  headers?: Array<{ key: string; value: string }>;
  variableToStoreData?: string; // Variável para armazenar os dados recebidos
}
export type ExternalDataNodeType = Node<ExternalDataNodeData, 'externalDataNode'>;

// --- GptQueryNode ---
export interface GptQueryNodeData extends BaseNodeData {
  prompt?: string;
  model?: string; // e.g., 'gpt-3.5-turbo', 'gpt-4'
  temperature?: number;
  maxTokens?: number;
  variableToStoreResponse?: string;
  apiKeyVariable?: string; // Nome da variável que armazena a chave API (e.g., OpenAI/Gemini)
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
  messageText?: string; // Texto principal da mensagem de lista
  buttonText?: string; // Texto do botão que abre a lista
  footerText?: string; // Texto do rodapé da lista
  sections?: ListSection[];
}
export type ListMessageNodeType = Node<ListMessageNodeData, 'listMessageNode'>;

// --- MediaMessageNode ---
export interface MediaMessageNodeData extends BaseNodeData {
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string; // URL do arquivo de mídia
  caption?: string; // Legenda para imagem/vídeo
  fileName?: string; // Nome do arquivo para documentos/áudios
  mimeType?: string; // e.g., 'image/jpeg', 'application/pdf'
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
  quickReplies?: QuickReply[]; // Para expectedResponseType 'quick_reply'
  listOptions?: ListItem[]; // Para expectedResponseType 'list_reply'
  validationRegex?: string; // Para validação de texto, número, email
  errorMessage?: string; // Mensagem de erro se a validação falhar
}
export type QuestionNodeType = Node<QuestionNodeData, 'questionNode'>;

// --- SetVariableNode ---
export interface VariableAssignment {
  variableName?: string;
  value?: string | number | boolean | null; // Valor a ser atribuído
  source?: 'static' | 'expression' | 'contact_data'; // Origem do valor
  expression?: string; // Se source for 'expression'
  contactField?: string; // Se source for 'contact_data'
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
  useVariables?: boolean; // Se a mensagem pode conter variáveis como {{name}}
}
export type TextMessageNodeType = Node<TextMessageNodeData, 'textMessageNode'>;

// --- TriggerNode ---
export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled';
  keywords?: string[]; // Para triggerType 'keyword'
  formId?: string; // Para triggerType 'form_submission'
  webhookUrl?: string; // Para triggerType 'webhook' (URL exposta pelo sistema)
  scheduleDateTime?: string; // Para triggerType 'scheduled' (ISO 8601)
  exactMatch?: boolean; // Para triggerType 'keyword'
}
export type TriggerNodeType = Node<TriggerNodeData, 'triggerNode'>;

// 2. Definição para ApiError
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// 3. Definição para FlowElementData (para listar fluxos)
export interface FlowElementData {
  id: string; // ou number, dependendo do backend
  name: string;
  description?: string;
  createdAt: string; // ou Date
  updatedAt: string; // ou Date
  status: 'draft' | 'active' | 'inactive' | 'archived';
  triggerType?: string; // e.g., 'keyword', 'webhook'
}

// 4. Definição para FlowPerformanceData (para análises)
export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // (totalCompleted / totalStarted) * 100
  averageDurationSeconds?: number;
}

// União de todos os tipos de dados de nós para conveniência
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

// União de todos os tipos de nós
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
