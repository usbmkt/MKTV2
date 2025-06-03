// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

// Interface Genérica para Erros de API (usada em ZapAnalytics, ZapConversations, ZapFlowsList etc.)
export interface ApiError {
  message: string;
  details?: any; 
  statusCode?: number;
}

// Tipo para FlowElementData (usado em ZapFlowsList para listar os fluxos)
// Defina as propriedades que você realmente usa para exibir a lista de fluxos.
export interface FlowElementData {
    id: string;
    name: string;
    description?: string;
    triggerType?: string; // Ex: 'keyword', 'manual'
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string; // Ou Date
    // ... adicione outras propriedades que você usa para listar os fluxos
}

// --- Tipos de Dados para Nós Customizados ---
// !! VOCÊ PRECISA COMPLETAR AS PROPRIEDADES DENTRO DE CADA INTERFACE ABAIXO !!
// !! Assegure-se de que cada interface seja um objeto simples com propriedades opcionais ou obrigatórias !!

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call'; // Seja específico
  keywords?: string[];
  formId?: string;
  webhookUrl?: string;
  // ... Adicione aqui as propriedades específicas do TriggerNodeData
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // ... Adicione aqui as propriedades específicas do TextMessageNodeData
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[];
  // ... Adicione aqui as propriedades específicas do QuestionNodeData
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
export interface ListMessageNodeDataFE { // FE para FrontEnd
  label?: string;
  headerText?: string; 
  bodyText?: string;   
  footerText?: string; 
  buttonText?: string; 
  sections?: ListSectionData[];
  // ... Adicione aqui as propriedades específicas do ListMessageNodeDataFE
}

export interface ButtonOptionData { 
    id: string;
    displayText: string;
    // type?: 'REPLY' | 'URL' | 'CALL'; // Exemplo
    // value?: string; // Exemplo para URL ou número
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string; 
  headerText?: string; 
  footerText?: string; 
  buttons?: ButtonOptionData[];
  // ... Adicione aqui as propriedades específicas do ButtonsMessageNodeData
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string; 
  caption?: string;
  fileName?: string; 
  // ... Adicione aqui as propriedades específicas do MediaMessageNodeData
}

export interface ConditionNodeData {
  label?: string;
  // Exemplo de estrutura de condição:
  // conditions?: Array<{
  //   variable: string;
  //   operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'startsWith' | 'endsWith';
  //   value: string | number | boolean;
  // }>;
  // ... Adicione aqui as propriedades específicas do ConditionNodeData
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api';
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any; // Pode ser string, number, boolean
  apiUrl?: string; // Se actionType for 'call_api'
  // ... Adicione aqui as propriedades específicas do ActionNodeData
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number; 
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  // ... Adicione aqui as propriedades específicas do DelayNodeData
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error_fallback';
  message?: string; 
  // ... Adicione aqui as propriedades específicas do EndNodeData
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string; 
  inputVariables?: string[]; 
  variableToSaveResult?: string; 
  // ... Adicione aqui as propriedades específicas do GptQueryNodeData
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string; 
  decisionCategories?: Array<{ id: string; name: string; description?: string }>;
  // ... Adicione aqui as propriedades específicas do AiDecisionNodeData
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string; 
  voiceId?: string; 
  // ... Adicione aqui as propriedades específicas do ClonedVoiceNodeData
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // ... Adicione aqui as propriedades específicas do TagContactNodeData
}

export interface SetVariableNodeData {
  label?: string;
  assignments?: Array<{ variableName: string; value: string | number | boolean | null }>;
  // ... Adicione aqui as propriedades específicas do SetVariableNodeData
}

export interface ExternalDataFetchNodeDataFE { // Renomeado para clareza, se necessário
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // Pode ser um JSON string de Record<string, string>
  body?: string;    // Pode ser um JSON string de Record<string, any>
  responsePath?: string; 
  variableToSaveResponse?: string;
  // ... Adicione aqui as propriedades específicas do ExternalDataFetchNodeDataFE
}

export interface ApiCallNodeData { // Pode ser igual ou similar a ExternalDataFetchNodeDataFE
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; 
  body?: string; 
  responseMapping?: string; // Ex: como mapear a resposta para variáveis
  // ... Adicione aqui as propriedades específicas do ApiCallNodeData
}

// Interface para dados de performance de fluxo (usada em ZapAnalytics)
export interface FlowPerformanceData {
  flowId: string;
  flowName: string; 
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; 
  avgTimeToComplete?: number; // em segundos
}

// Não é estritamente necessário definir e exportar os XyzNodeType = Node<XyzNodeData, 'type'>
// se você estiver usando React.FC<NodeProps<XyzNodeData>> diretamente nos seus componentes de nó.
// O ZapFlowBuilder usará os componentes diretamente.
