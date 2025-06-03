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
    triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string; // Ou Date
    // Adicione outras propriedades que você usa para listar/gerenciar fluxos
}

// --- Tipos de Dados para Nós Customizados ---

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[]; // Se triggerType for 'keyword'
  formId?: string;     // Se triggerType for 'form_submission'
  webhookUrl?: string; // Se triggerType for 'webhook' (geralmente gerado e somente leitura no nó)
  // Outras propriedades inferidas do TriggerNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no TriggerNode.tsx fornecido)
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // Outras propriedades inferidas do TextMessageNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no TextMessageNode.tsx fornecido)
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[]; // Array de strings para as opções de resposta rápida
  // Outras propriedades inferidas do QuestionNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no QuestionNode.tsx fornecido)
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
  // Outras propriedades inferidas do ListMessageNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ListMessageNode.tsx fornecido)
}

export interface ButtonOptionData {
    id: string;
    displayText: string;
    // Adicione aqui se seus botões têm tipos diferentes ou valores associados
    // type?: 'REPLY' | 'URL' | 'CALL';
    // value?: string; // para URL ou número
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string;
  headerText?: string;
  footerText?: string;
  buttons?: ButtonOptionData[];
  // Outras propriedades inferidas do ButtonsMessageNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ButtonsMessageNode.tsx fornecido)
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  // Outras propriedades inferidas do MediaMessageNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no MediaMessageNode.tsx fornecido)
}

export interface ConditionNodeData {
  label?: string;
  variableToCheck?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'endsWith' | 'is_empty' | 'is_not_empty';
  valueToCompare?: string | number | boolean;
  // Outras propriedades inferidas do ConditionNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ConditionNode.tsx fornecido)
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api';
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any; // Pode ser string, number, boolean, etc.
  apiUrl?: string;
  // Outras propriedades inferidas do ActionNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ActionNode.tsx fornecido)
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  // Outras propriedades inferidas do DelayNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no DelayNode.tsx fornecido)
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error_fallback';
  message?: string;
  // Outras propriedades inferidas do EndNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no EndNode.tsx fornecido)
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string;
  inputVariables?: string[]; // Se você pretende que seja um array
  variableToSaveResult?: string;
  // Outras propriedades inferidas do GptQueryNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no GptQueryNode.tsx fornecido)
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string;
  decisionCategories?: Array<{ id: string; name: string; description?: string; keywords?: string }>;
  // Outras propriedades inferidas do AiDecisionNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no AiDecisionNode.tsx fornecido)
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string;
  // Outras propriedades inferidas do ClonedVoiceNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ClonedVoiceNode.tsx fornecido)
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // Outras propriedades inferidas do TagContactNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no TagContactNode.tsx fornecido)
}

export interface SetVariableNodeDataAssignment { // Tipo auxiliar para SetVariableNodeData
  variableName: string;
  value: string | number | boolean | null;
}
export interface SetVariableNodeData {
  label?: string;
  assignments?: SetVariableNodeDataAssignment[];
  // Outras propriedades inferidas do SetVariableNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no SetVariableNode.tsx fornecido)
}

export interface ExternalDataFetchNodeDataFE {
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string
  body?: string;    // JSON string
  responsePath?: string;
  variableToSaveResponse?: string;
  // Outras propriedades inferidas do ExternalDataNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ExternalDataNode.tsx fornecido)
}

export interface ApiCallNodeData {
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string
  body?: string;    // JSON string
  responseMapping?: string;
  // Outras propriedades inferidas do ApiCallNode.tsx e erros anteriores:
  // (Nenhuma outra propriedade explicitamente usada em 'data' no ApiCallNode.tsx fornecido)
}

// Interface para dados de performance de fluxo (usada em ZapAnalytics)
export interface FlowPerformanceData {
  flowId: string;
  flowName: string; 
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; 
  avgTimeToComplete?: number; // em segundos
  // Adicione outras propriedades se necessário
}

// União de todos os tipos de dados de nós para uso genérico (opcional, mas pode ser útil)
export type AnyNodeData =
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
