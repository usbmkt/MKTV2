// MKTV2/zap/client/src/features/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node } from '@xyflow/react';

// --- Tipos Gerais ---
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// Para listar fluxos na UI do Zap
export interface FlowListElement { // Renomeado de FlowElementData para evitar conflito com React Flow
  id: string; // Ou number, dependendo do seu backend do Zap
  name: string;
  description?: string;
  trigger?: string; 
  isActive?: boolean;
  campaign_id?: string | null; // Se fluxos podem ser associados a campanhas do MKTV2 principal
  updated_at?: string;
  // Adicione outras props que você usa para exibir a lista de fluxos
}

export interface FlowPerformanceData { // Conforme documentação do Módulo Zap
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  avgDurationSeconds?: number;
}

// --- DEFINIÇÕES DE DADOS PARA NÓS CUSTOMIZADOS ---
// Baseado no seu zap/client/src/features/types/whatsapp_flow_types.ts
// e nos componentes de nó que você forneceu (tanto da pasta zap/ quanto do flow.tsx)

// Sua NodeData original era muito genérica com [key: string]: any.
// Vamos tentar ser mais específicos, mas mantendo a propriedade 'label' que você usa.
export interface BaseNodeData {
  label?: string; // Usado como título do nó no card
  // Se algum nó REALMENTE precisar de dados totalmente dinâmicos,
  // podemos adicionar uma propriedade como 'dynamicProps?: Record<string, any>' nele.
}

export interface TriggerNodeData extends BaseNodeData {
  triggerType?: 'keyword' | 'form_submission' | 'webhook' | 'manual' | 'scheduled' | '';
  keywords?: string[]; 
  formId?: string;
  webhookUrl?: string; // Para exibição, gerado pelo sistema
  scheduleDateTime?: string; 
  exactMatch?: boolean;
}

export interface TextMessageNodeData extends BaseNodeData {
  message?: string; // Usado em seu TextMessageNode.tsx (era messageText em alguns tipos)
}

export interface ButtonOption { // Renomeado de ButtonOptionData para consistência
  id: string; 
  displayText: string; 
  value?: string; 
}
export interface ButtonsMessageNodeData extends BaseNodeData {
  messageText?: string;
  buttons?: ButtonOption[];
  headerText?: string;
  footerText?: string;
}

export interface ImageNodeData extends BaseNodeData { // Do flow.tsx
  url?: string;
  caption?: string;
}

export interface AudioNodeData extends BaseNodeData { // Do flow.tsx
  url?: string;
  ptt?: boolean;    
  // caption?: string; // Adicionar se necessário
}

export interface FileNodeData extends BaseNodeData { // Do flow.tsx
  url?: string;
  filename?: string;
  mimetype?: string;
  // caption?: string; // Adicionar se necessário
}

export interface LocationNodeData extends BaseNodeData { // Do flow.tsx
  latitude?: string; 
  longitude?: string; 
  name?: string; // Nome do local
  address?: string; // Endereço
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
  id: string; 
  title: string; 
  rows: ListItem[]; 
}
export interface ListMessageNodeData extends BaseNodeData { // Do seu zap/ListMessageNode.tsx
  messageText?: string; 
  buttonText?: string; 
  title?: string; // Título da lista em si
  footerText?: string; 
  sections?: ListSection[]; 
}

export interface WaitInputNodeData extends BaseNodeData { // Do flow.tsx
  variableName?: string; // Onde salvar a resposta
  message?: string; // Mensagem de prompt
  timeoutSeconds?: number;
}

export interface VariableAssignment { // Do seu zap/SetVariableNode.tsx
    variableName: string;
    value?: string; 
    source?: 'static' | 'expression' | 'contact_data' | 'message_data'; 
    expression?: string; 
    contactField?: string; 
    messagePath?: string; 
}
export interface SetVariableNodeData extends BaseNodeData { // Do seu zap/SetVariableNode.tsx
  assignments?: VariableAssignment[];
}

export interface ConditionNodeData extends BaseNodeData { // Do seu zap/ConditionNode.tsx
  variableToCheck?: string; 
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'endsWith' | 'isSet' | 'isNotSet' | 'regex';
  valueToCompare?: string; 
}

export interface TimeConditionNodeData extends BaseNodeData { // Do flow.tsx
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
}

export interface ApiCallNodeData extends BaseNodeData { // Do seu zap/ApiCallNode.tsx
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string; // JSON string
  body?: string;    // JSON string ou texto
  responseMapping?: string; // Ex: "data.token para var {{api_token}}"
  // saveResponseTo?: string; // Alternativa mais simples se for só salvar em uma var
}

export interface WebhookCallNodeData extends BaseNodeData { // Do flow.tsx
  url?: string;
  method?: 'GET' | 'POST';
  headers?: string;
  body?: string;
  saveResponseTo?: string;
}

export interface GPTQueryNodeData extends BaseNodeData { // Do seu zap/GptQueryNode.tsx
  promptTemplate?: string; 
  variableToSaveResult?: string; 
  apiKeyVariable?: string; 
  systemMessage?: string; 
  model?: string; 
  temperature?: number; 
  maxTokens?: number; 
}

export interface AssignAgentNodeData extends BaseNodeData { // Do flow.tsx
  department?: string;
  agentId?: string;
  message?: string; 
}

export interface EndNodeData extends BaseNodeData { // Do seu zap/EndNode.tsx
  endStateType?: 'completed' | 'abandoned' | 'error_fallback' | string; 
  message?: string; // Mensagem final
}

export interface GoToFlowNodeData extends BaseNodeData { // Do flow.tsx
  targetFlowId?: string; 
}

export interface TagContactNodeData extends BaseNodeData { // Do seu zap/TagContactNode.tsx
  tagName?: string;
  tagOperation?: 'add' | 'remove'; 
}

export interface LoopNodeData extends BaseNodeData { // Do flow.tsx
  repetitions?: number;
}

export interface QuickReply { // Do seu zap/QuestionNode.tsx
    id: string;
    text: string;
    payload?: string;
}
export interface QuestionNodeData extends BaseNodeData { // Do seu zap/QuestionNode.tsx
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply' | 'list_reply' | '';
  variableToSaveAnswer?: string;
  quickReplies?: QuickReply[];
  // listOptions?: ListMessageNodeData; // Se for usar estrutura de Lista para resposta
}

export interface MediaMessageNodeData extends BaseNodeData { // Do seu zap/MediaMessageNode.tsx
  mediaType?: 'image' | 'video' | 'audio' | 'document' | '';
  mediaUrl?: string; 
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

export interface ExternalDataFetchNodeData extends BaseNodeData { // Do seu zap/ExternalDataNode.tsx
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
  apiUrl?: string; // Para actionType 'call_api'
  // Adicionar aqui outras props para 'call_api' se necessário: method, headers, body, saveResponseTo
}

export interface AiDecisionNodeData extends BaseNodeData { // Do seu zap/AiDecisionNode.tsx
  inputVariable?: string; 
  decisionCategories?: Array<{ id: string; name: string; keywords?: string; }>; 
  // model?: string;
  // decisionPrompt?: string;
}

export interface ClonedVoiceNodeData extends BaseNodeData { // Do seu zap/ClonedVoiceNode.tsx
  textToSpeak?: string; 
  voiceId?: string; 
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

// Tipo para um nó do React Flow que usa seus dados customizados
export type ZapFlowNode = Node<CustomNodeDataType, string | undefined>;

// Definição da estrutura do fluxo para o FlowBuilder
export interface FlowDefinition { // Era FlowElementData no seu zap/types, mas esse nome é usado pelo React Flow
  nodes: ZapFlowNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Outros tipos que estavam no seu zap/types (se ainda forem relevantes fora dos nós)
// export interface SendMessagePayload { /* ... */ }
// export interface ZapUser { /* ... */ }
// export interface WhatsAppConnectionStatus { /* ... */ }


// Reexportar tipos do React Flow para conveniência
export type { NodeProps, Edge, Node };
