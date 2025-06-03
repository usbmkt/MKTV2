// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

// Interface Genérica para Erros de API
export interface ApiError {
  message: string;
  details?: any;
  statusCode?: number;
}

// Tipo para FlowElementData (usado em ZapFlowsList para listar os fluxos)
export interface FlowElementData {
    id: string;
    name: string;
    description?: string;
    triggerType?: string;
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string;
}

// --- Tipos de Dados para Nós Customizados (COM PLACEHOLDERS GENÉRICOS) ---
// !! REVISE E AJUSTE ESTAS INTERFACES COM AS PROPRIEDADES REAIS DE CADA NÓ !!

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  // Adicione outras propriedades conforme necessário
  [key: string]: any; // Para flexibilidade temporária
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  [key: string]: any;
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[];
  [key: string]: any;
}

export interface ListItemData {
  id: string;
  title: string;
  description?: string;
}
export interface ListSectionData {
  title: string;
  rows: ListItemData[];
}
export interface ListMessageNodeDataFE {
  label?: string;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttonText?: string;
  sections?: ListSectionData[];
  [key: string]: any;
}

export interface ButtonOptionData {
    id: string;
    displayText: string;
    // value?: string; // Exemplo
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string;
  headerText?: string;
  footerText?: string;
  buttons?: ButtonOptionData[];
  [key: string]: any;
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  [key: string]: any;
}

export interface ConditionNodeData {
  label?: string;
  variableToCheck?: string;
  operator?: string; // Mantenha genérico por enquanto
  valueToCompare?: any;
  // branches?: Array<{ id: string; conditionExpression: string; label?: string }>;
  [key: string]: any;
}

export interface ActionNodeData {
  label?: string;
  actionType?: string; // Mantenha genérico
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any;
  apiUrl?: string;
  flowToStartId?: string;
  [key: string]: any;
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  [key: string]: any;
}

export interface EndNodeData {
  label?: string;
  endStateType?: string;
  message?: string;
  [key: string]: any;
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string;
  inputVariables?: string[];
  variableToSaveResult?: string;
  [key: string]: any;
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string;
  decisionCategories?: Array<{ id: string; name: string; description?: string; keywords?: string }>;
  [key: string]: any;
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string;
  [key: string]: any;
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  [key: string]: any;
}

export interface SetVariableNodeDataAssignment {
  variableName: string;
  value: any; // Mantenha 'any' por enquanto para flexibilidade
}
export interface SetVariableNodeData {
  label?: string;
  assignments?: SetVariableNodeDataAssignment[];
  [key: string]: any;
}

export interface ExternalDataFetchNodeDataFE {
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string
  body?: string;    // JSON string
  responsePath?: string;
  variableToSaveResponse?: string;
  [key: string]: any;
}

export interface ApiCallNodeData {
  label?: string;
  url?: string;
  method?: string;
  headers?: string; 
  body?: string; 
  responseMapping?: string;
  [key: string]: any;
}

export interface FlowPerformanceData {
  flowId: string;
  flowName?: string; 
  totalStarted?: number;
  totalCompleted?: number;
  completionRate?: number; 
  avgTimeToComplete?: number;
  [key: string]: any; // Para flexibilidade temporária
}
