// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

// Interface Genérica para Erros de API
export interface ApiError {
  message: string;
  details?: any;
  statusCode?: number;
}

// --- Tipos de Dados para Nós Customizados ---
// !! VOCÊ PRECISA COMPLETAR AS PROPRIEDADES DENTRO DE CADA INTERFACE ABAIXO !!

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[];
  // Ex: formId?: string; webhookUrl?: string;
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // Ex: useVariables?: boolean;
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[];
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
}

export interface ButtonOptionData {
    id: string;
    displayText: string;
    // Adicione type, url, phoneNumber se necessário para diferentes tipos de botões
}
export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string; // ou headerText, bodyText, footerText
  buttons?: ButtonOptionData[];
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string; // URL do arquivo
  caption?: string;
  fileName?: string; // Para documentos
}

export interface ConditionNodeData {
  label?: string;
  // Defina como você estrutura suas condições. Exemplo:
  conditions?: Array<{
    variable: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'startsWith' | 'endsWith';
    value: string | number | boolean;
  }>;
  // Ou uma lógica mais simples
  // variableToCheck?: string;
  // operator?: string;
  // valueToCompare?: string;
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api';
  // Propriedades condicionais baseadas em actionType:
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any;
  apiUrl?: string;
  // ...etc.
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error_fallback';
  message?: string; // Mensagem final opcional
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string; // Template do prompt, pode incluir variáveis
  inputVariables?: string[]; // Variáveis a serem injetadas no prompt
  variableToSaveResult?: string; // Onde salvar a resposta da IA
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string; // Variável com texto para IA
  decisionCategories?: Array<{ id: string; name: string; description?: string }>; // Categorias para classificar
  // outputVariable?: string; // Onde salvar a categoria decidida
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string; // Pode vir de uma variável
  voiceId?: string; // ID da voz (ex: ElevenLabs)
  // variableToSaveAudioUrl?: string;
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
}

export interface SetVariableNodeData {
  label?: string;
  assignments?: Array<{ variableName: string; value: string | number | boolean | null }>; // Permitir atribuição de múltiplos valores ou de outras variáveis
}

export interface ExternalDataFetchNodeDataFE { // Renomeado de ExternalDataNode para clareza
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string ou objeto
  body?: string;    // JSON string ou objeto
  responsePath?: string; // Caminho para extrair dados da resposta (ex: data.user.id)
  variableToSaveResponse?: string;
}

export interface ApiCallNodeData { // Pode ser similar ou o mesmo que ExternalDataFetchNodeDataFE
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; 
  body?: string; 
  responseMapping?: string; 
}


// Interface para dados de performance de fluxo (usada em ZapAnalytics)
export interface FlowPerformanceData {
  flowId: string;
  flowName?: string; // Adicionado
  totalStarted: number;
  totalCompleted: number;
  completionRate?: number; // Adicionado
  avgTimeToComplete?: number; // em segundos
  // Adicione mais métricas se necessário
}

// Tipo para FlowElementData (usado em ZapFlowsList)
// Defina as propriedades que você usa para listar os fluxos
export interface FlowElementData {
    id: string;
    name: string;
    description?: string;
    triggerType?: string; // Ou um tipo mais específico
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string; // Ou Date
    // ... adicione outras propriedades que você precisa para a lista
}

// Não é estritamente necessário exportar os XyzNodeType = Node<XyzNodeData, 'type'>
// se você estiver usando React.FC<NodeProps<XyzNodeData>> nos seus componentes de nó.
// O ZapFlowBuilder usará os componentes diretamente.
