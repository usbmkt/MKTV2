// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

export interface ApiError {
  message: string;
  details?: any;
  statusCode?: number;
}

export interface FlowElementData {
    id: string;
    name: string;
    description?: string;
    triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string;
}

// --- Tipos de Dados para Nós Customizados ---
// !! DEFINA TODAS AS PROPRIEDADES QUE CADA NÓ REALMENTE UTILIZA EM 'data' !!

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  // Adicione aqui as propriedades específicas do seu TriggerNodeData
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // Adicione aqui as propriedades específicas do seu TextMessageNodeData
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[];
  // Adicione aqui as propriedades específicas do seu QuestionNodeData
}

export interface ListItemData { id: string; title: string; description?: string; }
export interface ListSectionData { title: string; rows: ListItemData[]; }
export interface ListMessageNodeDataFE {
  label?: string;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttonText?: string;
  sections?: ListSectionData[];
  // Adicione aqui as propriedades específicas do seu ListMessageNodeDataFE
}

export interface ButtonOptionData { id: string; displayText: string; /* value?: string; type?: string; */ }
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string;
  headerText?: string;
  footerText?: string;
  buttons?: ButtonOptionData[];
  // Adicione aqui as propriedades específicas do seu ButtonsMessageNodeData
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  // Adicione aqui as propriedades específicas do seu MediaMessageNodeData
}

export interface ConditionNodeData {
  label?: string;
  variableToCheck?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'endsWith' | 'is_empty' | 'is_not_empty';
  valueToCompare?: string | number | boolean;
  // Adicione aqui as propriedades específicas do seu ConditionNodeData
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | 'start_flow';
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any;
  apiUrl?: string;
  flowToStartId?: string;
  // Adicione aqui as propriedades específicas do seu ActionNodeData
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  // Adicione aqui as propriedades específicas do seu DelayNodeData
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error_fallback';
  message?: string;
  // Adicione aqui as propriedades específicas do seu EndNodeData
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string;
  inputVariables?: string[];
  variableToSaveResult?: string;
  // Adicione aqui as propriedades específicas do seu GptQueryNodeData
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string;
  decisionCategories?: Array<{ id: string; name: string; description?: string; keywords?: string }>;
  // Adicione aqui as propriedades específicas do seu AiDecisionNodeData
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string;
  // Adicione aqui as propriedades específicas do seu ClonedVoiceNodeData
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // Adicione aqui as propriedades específicas do seu TagContactNodeData
}

export interface SetVariableNodeDataAssignment {
  variableName: string;
  value: string | number | boolean | null;
}
export interface SetVariableNodeData {
  label?: string;
  assignments?: SetVariableNodeDataAssignment[];
  // Adicione aqui as propriedades específicas do seu SetVariableNodeData
}

export interface ExternalDataFetchNodeDataFE {
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string;
  body?: string;
  responsePath?: string;
  variableToSaveResponse?: string;
  // Adicione aqui as propriedades específicas do seu ExternalDataFetchNodeDataFE
}

export interface ApiCallNodeData {
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string;
  body?: string;
  responseMapping?: string;
  // Adicione aqui as propriedades específicas do seu ApiCallNodeData
}

export interface FlowPerformanceData {
  flowId: string;
  flowName: string; // Assegure que esta propriedade exista
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // Assegure que esta propriedade exista
  avgTimeToComplete?: number;
}
