// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

// Interface Genérica para Erros de API
export interface ApiError {
  message: string;
  details?: any;
  statusCode?: number;
}

// --- Tipos de Dados para Nós Customizados ---
// Substitua os comentários com as propriedades reais de cada nó.

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  // Adicione aqui as propriedades específicas do TriggerNodeData
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // Adicione aqui as propriedades específicas do TextMessageNodeData
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[];
  // Adicione aqui as propriedades específicas do QuestionNodeData
}

export interface ListItemData { // Usado por ListMessageNodeDataFE
  id: string;
  title: string;
  description?: string;
}

export interface ListSectionData { // Usado por ListMessageNodeDataFE
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
  // Adicione aqui as propriedades específicas do ListMessageNodeDataFE
}

export interface ButtonOptionData { // Usado por ButtonsMessageNodeData
    id: string;
    displayText: string;
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string;
  headerText?: string;
  footerText?: string;
  buttons?: ButtonOptionData[];
  // Adicione aqui as propriedades específicas do ButtonsMessageNodeData
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  // Adicione aqui as propriedades específicas do MediaMessageNodeData
}

export interface ConditionNodeData {
  label?: string;
  variableToCheck?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  valueToCompare?: string | number;
  // Adicione aqui as propriedades específicas do ConditionNodeData
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop';
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: string;
  // Adicione aqui as propriedades específicas do ActionNodeData
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours';
  // Adicione aqui as propriedades específicas do DelayNodeData
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error';
  // Adicione aqui as propriedades específicas do EndNodeData
}

export interface GptQueryNodeData {
  label?: string;
  prompt?: string;
  variableToSaveResult?: string;
  // Adicione aqui as propriedades específicas do GptQueryNodeData
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string;
  decisionCategories?: string[];
  // Adicione aqui as propriedades específicas do AiDecisionNodeData
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string;
  // Adicione aqui as propriedades específicas do ClonedVoiceNodeData
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // Adicione aqui as propriedades específicas do TagContactNodeData
}

export interface SetVariableNodeData {
  label?: string;
  variableName?: string;
  variableValue?: string | number | boolean;
  // Adicione aqui as propriedades específicas do SetVariableNodeData
}

export interface ExternalDataFetchNodeDataFE {
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  variableToSaveResponse?: string;
  // Adicione aqui as propriedades específicas do ExternalDataFetchNodeDataFE
}

export interface ApiCallNodeData {
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string
  body?: string; // JSON string
  responseMapping?: string;
  // Adicione aqui as propriedades específicas do ApiCallNodeData
}

// Tipo para FlowElementData, se ainda for usado em ZapFlowsList,
// ajuste conforme a estrutura real dos seus dados de fluxo.
// Se for para os nós em si, eles usarão os tipos acima.
export interface FlowElementData {
    id: string;
    name: string;
    description?: string;
    triggerType?: string;
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string;
    // ... outras propriedades que você usa para listar fluxos
}

// Seus componentes de nó usarão NodeProps<XyzNodeData>.
// Não é necessário exportar XyzNodeType = Node<XyzNodeData, 'xyz'> daqui
// a menos que você os use explicitamente em outro lugar.
