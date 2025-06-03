// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node, Edge } from '@xyflow/react'; // Edge pode ser útil também

// Interface Genérica para Erros de API (usada em ZapAnalytics, ZapConversations, etc.)
export interface ApiError {
  message: string;
  details?: any; // Pode ser mais específico se souber a estrutura do erro
  statusCode?: number;
}

// --- Tipos de Nós do Flow Builder ---

// TriggerNode
export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[];
  formId?: string; // Exemplo se for form_submission
  webhookUrl?: string; // Exemplo se for webhook
  // ... outras propriedades para TriggerNode
}
export type TriggerNodeType = Node<TriggerNodeData, 'trigger'>;

// TextMessageNode
export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // ... outras propriedades para TextMessageNode
}
export type TextMessageNodeType = Node<TextMessageNodeData, 'textMessage'>;

// QuestionNode (Input/Quick Reply)
export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[]; // Se for quick_reply
  // ... outras propriedades para QuestionNode
}
export type QuestionNodeType = Node<QuestionNodeData, 'question'>;

// ListMessageNode
export interface ListItemData {
  id: string;
  title: string;
  description?: string;
}
export interface ListSectionData {
  title: string;
  rows: ListItemData[];
}
export interface ListMessageNodeDataFE { // FE para FrontEnd, se for diferente do backend
  label?: string;
  headerText?: string; // Texto do cabeçalho da lista
  bodyText?: string;   // Corpo da mensagem da lista
  footerText?: string; // Rodapé da lista
  buttonText?: string; // Texto do botão que abre a lista
  sections?: ListSectionData[];
  // ... outras propriedades para ListMessageNode
}
export type ListMessageNodeType = Node<ListMessageNodeDataFE, 'listMessage'>;

// ButtonsMessageNode
export interface ButtonOptionData {
  id: string;
  displayText: string;
  // type?: 'REPLY' | 'URL' | 'CALL'; // Se os botões tiverem tipos
  // url?: string; // se for URL
  // phoneNumber?: string; // se for CALL
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string;
  headerText?: string; // Opcional
  footerText?: string; // Opcional
  buttons?: ButtonOptionData[];
  // ... outras propriedades para ButtonsMessageNode
}
export type ButtonsMessageNodeType = Node<ButtonsMessageNodeData, 'buttonsMessage'>;

// MediaMessageNode
export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string; // Para documentos
  // ... outras propriedades para MediaMessageNode
}
export type MediaMessageNodeType = Node<MediaMessageNodeData, 'mediaMessage'>;

// ConditionNode
export interface ConditionBranch {
  id: string; // para o handle de saída
  conditionLogic: string; // Ex: "variavel == 'valor'" ou uma descrição
  // ... outras propriedades da branch
}
export interface ConditionNodeData {
  label?: string;
  // conditions: ConditionBranch[]; // Uma condição pode ter múltiplas branches de saída (Sim/Não, etc.)
  // Ou uma lógica mais simples:
  variableToCheck?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  valueToCompare?: string | number;
  // ... outras propriedades para ConditionNode
}
export type ConditionNodeType = Node<ConditionNodeData, 'condition'>;

// ActionNode
export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop';
  tagName?: string; // se for add_tag/remove_tag
  agentId?: string; // se for assign_agent
  emailTemplateId?: string; // se for send_email
  contactPropertyName?: string;
  contactPropertyValue?: string;
  // ... outras propriedades para ActionNode
}
export type ActionNodeType = Node<ActionNodeData, 'action'>;

// DelayNode
export interface DelayNodeData {
  label?: string;
  delayAmount?: number; // em segundos, minutos ou horas
  delayUnit?: 'seconds' | 'minutes' | 'hours';
  // ... outras propriedades para DelayNode
}
export type DelayNodeType = Node<DelayNodeData, 'delay'>;

// EndNode
export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error';
  // ... outras propriedades para EndNode
}
export type EndNodeType = Node<EndNodeData, 'end'>;

// GptQueryNode
export interface GptQueryNodeData {
  label?: string;
  prompt?: string;
  variableToSaveResult?: string;
  // ... outras propriedades para GptQueryNode
}
export type GptQueryNodeType = Node<GptQueryNodeData, 'gptQuery'>;

// AiDecisionNode
export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string; // Variável com o texto para IA analisar
  decisionCategories?: string[]; // Categorias para a IA classificar
  // ... outras propriedades para AiDecisionNode
}
export type AiDecisionNodeType = Node<AiDecisionNodeData, 'aiDecision'>;

// ClonedVoiceNode
export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string; // ID da voz clonada (ex: ElevenLabs)
  // ... outras propriedades para ClonedVoiceNode
}
export type ClonedVoiceNodeType = Node<ClonedVoiceNodeData, 'clonedVoice'>;

// TagContactNode
export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // ... outras propriedades para TagContactNode
}
export type TagContactNodeType = Node<TagContactNodeData, 'tagContact'>;

// SetVariableNode
export interface SetVariableNodeData {
  label?: string;
  variableName?: string;
  variableValue?: string | number | boolean; // Pode ser de um input direto ou de outra variável
  // ... outras propriedades para SetVariableNode
}
export type SetVariableNodeType = Node<SetVariableNodeData, 'setVariable'>;

// ExternalDataNode (ou ExternalDataFetchNodeDataFE)
export interface ExternalDataFetchNodeDataFE {
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>; // Ex: { "Authorization": "Bearer {{token_var}}" }
  body?: string; // JSON string, pode usar variáveis
  variableToSaveResponse?: string;
  // ... outras propriedades para ExternalDataNode
}
export type ExternalDataNodeType = Node<ExternalDataFetchNodeDataFE, 'externalData'>;

// ApiCallNode
export interface ApiCallNodeData {
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string para headers
  body?: string; // JSON string para o corpo
  responseMapping?: string; // Como mapear a resposta para variáveis
  // ... outras propriedades para ApiCallNode
}
export type ApiCallNodeType = Node<ApiCallNodeData, 'apiCall'>;

// Tipo agregando todos os tipos de dados de nós para o Flow Builder
export type FlowNodeData =
  | TriggerNodeData
  | TextMessageNodeData
  | QuestionNodeData
  | ListMessageNodeDataFE
  | ButtonsMessageNodeData
  | MediaMessageNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData
  | EndNodeData
  | GptQueryNodeData
  | AiDecisionNodeData
  | ClonedVoiceNodeData
  | TagContactNodeData
  | SetVariableNodeData
  | ExternalDataFetchNodeDataFE
  | ApiCallNodeData;

// Tipo genérico para qualquer nó no seu fluxo
export type AnyFlowNode = Node<FlowNodeData, string>; // 'string' pode ser o tipo do nó se for dinâmico
