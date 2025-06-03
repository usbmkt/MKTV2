// Novo arquivo: client/src/types/whatsapp_flow_types.ts

import { NodeProps, Edge, Node } from '@xyflow/react';

// Interface de erro da API (conforme documentação)
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// Interface para dados de elementos de fluxo na lista (conforme documentação)
export interface FlowElementData {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  isActive?: boolean;
  // Outras propriedades que você usa para listar fluxos
}

// Interface para dados de performance de fluxo (conforme documentação)
export interface FlowPerformanceData {
  flowId: string;
  flowName: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // Em porcentagem
  avgDurationSeconds?: number;
  // Outras métricas relevantes
}


// --- DEFINIÇÕES DE DADOS PARA NÓS CUSTOMIZADOS ---
// Estas são as interfaces que você PRECISA detalhar para cada um dos seus 17+ tipos de nós.
// O objeto 'data' em cada nó do React Flow conterá uma dessas interfaces.

export interface TriggerNodeData {
  triggerType: 'keyword' | 'first_message' | 'schedule';
  keywords?: string[]; // Se triggerType for 'keyword'
  cronExpression?: string; // Se triggerType for 'schedule'
  // Outras configurações de gatilho
}

export interface TextMessageNodeData {
  messageText: string;
  useVariables?: boolean;
  // Adicionar outras propriedades como delay, etc.
}

export interface ButtonsMessageNodeData {
  messageText: string;
  buttons: Array<{ id: string; label: string; value?: string }>; // Cada botão pode ter um ID, label e valor
}

export interface ListMessageNodeData {
  titleText: string; // Título da lista
  buttonText: string; // Texto do botão que abre a lista
  sections: Array<{
    title?: string; // Título opcional da seção
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface MediaMessageNodeData {
  mediaType: 'image' | 'video' | 'audio' | 'document';
  url: string; // URL do arquivo de mídia
  caption?: string;
  fileName?: string; // Para documentos
}

export interface QuestionNodeData {
  questionText: string;
  responseType: 'text' | 'number' | 'email' | 'date' | 'options';
  options?: Array<{ label: string; value: string }>; // Se responseType for 'options'
  variableToStoreResponse?: string; // Nome da variável para armazenar a resposta
  validationRegex?: string;
  errorMessage?: string;
}

export interface ConditionNodeData {
  variableName: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  comparisonValue: string | number;
  // Cada condição resultará em uma saída (handle) diferente do nó
}

export interface ActionNodeData {
  actionType: 'set_variable' | 'add_tag' | 'remove_tag' | 'call_api' | 'send_email' | 'assign_to_agent';
  // Propriedades específicas para cada actionType
  variableName?: string; // Para set_variable
  variableValue?: string; // Para set_variable
  tagName?: string; // Para add_tag, remove_tag
  apiUrl?: string; // Para call_api
  apiMethod?: 'GET' | 'POST' | 'PUT'; // Para call_api
  apiBody?: string; // Para call_api (JSON string)
  emailTo?: string; // Para send_email
  emailSubject?: string; // Para send_email
  emailBody?: string; // Para send_email
  agentId?: string; // Para assign_to_agent
}

export interface DelayNodeData {
  delayValue: number;
  delayUnit: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface EndNodeData {
  endMessage?: string; // Mensagem opcional ao finalizar o fluxo
}

export interface SetVariableNodeData {
  variableName: string;
  value: string | number | boolean; // Ou pode ser dinâmico, ex: de uma resposta anterior
}

export interface TagContactNodeData {
  tagName: string;
  action: 'add' | 'remove';
}

export interface ApiCallNodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // Ex: JSON string de {"Authorization": "Bearer ..."}
  body?: string;    // Ex: JSON string
  responseVariable?: string; // Variável para armazenar a resposta da API
}

export interface ExternalDataNodeData {
  sourceUrl: string; // URL para buscar dados externos
  responseMapping?: string; // Como mapear a resposta para variáveis do fluxo
}

export interface GptQueryNodeData {
  prompt: string;
  model?: string; // ex: 'gpt-3.5-turbo'
  temperature?: number;
  maxTokens?: number;
  responseVariable?: string; // Variável para armazenar a resposta do GPT
}

export interface AiDecisionNodeData {
  inputVariable: string; // Variável cujo valor será usado para a decisão da IA
  decisionPrompt?: string; // Prompt opcional para guiar a IA
  // A IA pode decidir para qual "handle" de saída o fluxo deve seguir
}

export interface ClonedVoiceNodeData {
  textToSpeak: string;
  voiceId?: string; // ID da voz clonada (ex: ElevenLabs)
  // Outras configurações de voz
}


// Tipagem genérica para os dados dos nós, usando um discriminador 'type'
// Adicione todos os seus tipos de dados de nó aqui
export type CustomNodeData =
  | TriggerNodeData
  | TextMessageNodeData
  | ButtonsMessageNodeData
  | ListMessageNodeData
  | MediaMessageNodeData
  | QuestionNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData
  | EndNodeData
  | SetVariableNodeData
  | TagContactNodeData
  | ApiCallNodeData
  | ExternalDataNodeData
  | GptQueryNodeData
  | AiDecisionNodeData
  | ClonedVoiceNodeData;

// Interface para um nó customizado que usa CustomNodeData
export type CustomFlowNode = Node<CustomNodeData & { label?: string }, string | undefined>;

// Seus ChatFlow e FlowStep da página whatsapp.tsx podem ser ajustados para usar CustomFlowNode
// Por exemplo, a propriedade 'definition' em ChatFlow seria:
// definition?: { nodes: CustomFlowNode[]; edges: Edge[] };

// Reexportar tipos do React Flow se necessário em outros lugares
export type { NodeProps, Edge, Node };
