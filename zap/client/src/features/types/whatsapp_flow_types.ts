// zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react'; // Usado para referência, mas não para exportar Node<T, U> daqui

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
    triggerType?: string; // Ex: 'keyword', 'manual', 'webhook'
    status?: 'active' | 'inactive' | 'draft';
    lastEdited?: string; // Pode ser string ISO ou Date
    // Adicione quaisquer outras propriedades que você usa para listar/gerenciar fluxos
}

// --- Tipos de Dados para Nós Customizados ---
// Cada interface XyzNodeData define a estrutura do objeto `data` para o nó correspondente.

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook' | 'form_submission' | 'api_call';
  keywords?: string[]; // Usado se triggerType for 'keyword'
  formId?: string;     // Usado se triggerType for 'form_submission'
  webhookUrl?: string; // Usado se triggerType for 'webhook'
  // Adicione outras propriedades se o seu TriggerNode as utiliza
}

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // Adicione outras propriedades se o seu TextMessageNode as utiliza
}

export interface QuestionNodeData {
  label?: string;
  questionText?: string;
  expectedResponseType?: 'text' | 'number' | 'email' | 'quick_reply';
  variableToSaveAnswer?: string;
  quickReplies?: string[]; // Array de strings para as opções de resposta rápida
  // Adicione outras propriedades se o seu QuestionNode as utiliza
}

export interface ListItemData {
  id: string; // ID único para o item da lista
  title: string;
  description?: string;
}

export interface ListSectionData {
  title: string;
  rows: ListItemData[];
}

export interface ListMessageNodeDataFE { // FE = FrontEnd, se a estrutura for diferente no backend
  label?: string;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttonText?: string; // Texto do botão que abre a lista
  sections?: ListSectionData[];
  // Adicione outras propriedades se o seu ListMessageNode as utiliza
}

export interface ButtonOptionData {
    id: string; // ID único para o botão
    displayText: string;
    // Considere adicionar:
    // type?: 'REPLY' | 'URL' | 'CALL'; // Para diferenciar ações de botões
    // value?: string; // Para URL ou número de telefone
}

export interface ButtonsMessageNodeData {
  label?: string;
  messageText?: string; // Texto principal da mensagem com botões
  headerText?: string;  // Opcional, para título
  footerText?: string;  // Opcional, para rodapé
  buttons?: ButtonOptionData[];
  // Adicione outras propriedades se o seu ButtonsMessageNode as utiliza
}

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;   // URL pública do arquivo de mídia
  caption?: string;    // Legenda para imagem/vídeo
  fileName?: string;   // Nome do arquivo, especialmente para documentos
  // Adicione outras propriedades se o seu MediaMessageNode as utiliza
}

export interface ConditionNodeData {
  label?: string;
  // Exemplo de estrutura para condições (adapte conforme sua necessidade):
  variableToCheck?: string; // Ex: {{user_input}}
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'startsWith' | 'endsWith' | 'is_empty' | 'is_not_empty';
  valueToCompare?: string | number | boolean;
  // Para múltiplas condições/branches, você pode usar um array:
  // branches?: Array<{ id: string; conditionExpression: string; label?: string }>;
  // Adicione outras propriedades se o seu ConditionNode as utiliza
}

export interface ActionNodeData {
  label?: string;
  actionType?: 'add_tag' | 'remove_tag' | 'assign_agent' | 'send_email' | 'update_contact_prop' | 'call_api' | 'start_flow';
  tagName?: string;
  agentId?: string;
  emailTemplateId?: string;
  contactPropertyName?: string;
  contactPropertyValue?: any; // Pode ser string, number, boolean
  apiUrl?: string;        // Para actionType 'call_api'
  flowToStartId?: string; // Para actionType 'start_flow'
  // Adicione outras propriedades se o seu ActionNode as utiliza
}

export interface DelayNodeData {
  label?: string;
  delayAmount?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  // Adicione outras propriedades se o seu DelayNode as utiliza
}

export interface EndNodeData {
  label?: string;
  endStateType?: 'completed' | 'abandoned' | 'error_fallback';
  message?: string; // Mensagem opcional ao finalizar
  // Adicione outras propriedades se o seu EndNode as utiliza
}

export interface GptQueryNodeData {
  label?: string;
  promptTemplate?: string;    // Ex: "Resuma este texto: {{input_text}}"
  inputVariables?: string[];  // Ex: ["input_text"] (nomes das variáveis a serem usadas no prompt)
  variableToSaveResult?: string; // Ex: {{summary_result}}
  // Adicione outras propriedades se o seu GptQueryNode as utiliza
}

export interface AiDecisionNodeData {
  label?: string;
  inputVariable?: string; // Variável contendo o texto para a IA analisar
  decisionCategories?: Array<{ id: string; name: string; description?: string; keywords?: string }>; // Categorias com IDs para os handles de saída
  // Adicione outras propriedades se o seu AiDecisionNode as utiliza
}

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string; // Pode usar variáveis: "Olá {{nome_cliente}}"
  voiceId?: string;     // ID da voz (ex: de um serviço como ElevenLabs)
  // Adicione outras propriedades se o seu ClonedVoiceNode as utiliza
}

export interface TagContactNodeData {
  label?: string;
  tagOperation?: 'add' | 'remove';
  tagName?: string;
  // Adicione outras propriedades se o seu TagContactNode as utiliza
}

export interface SetVariableNodeData {
  label?: string;
  assignments?: Array<{ variableName: string; value: string | number | boolean | null }>; // Lista de variáveis a serem definidas/atualizadas
  // Adicione outras propriedades se o seu SetVariableNode as utiliza
}

export interface ExternalDataFetchNodeDataFE { // Para o nó que busca dados externos
  label?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string para cabeçalhos, ex: '{ "Authorization": "Bearer {{token}}" }'
  body?: string;    // JSON string para o corpo da requisição, ex: '{ "id": "{{user_id}}" }'
  responsePath?: string; // Caminho para extrair o dado da resposta JSON, ex: data.user.email
  variableToSaveResponse?: string; // Nome da variável para salvar o resultado
  // Adicione outras propriedades se o seu ExternalDataNode as utiliza
}

export interface ApiCallNodeData { // Pode ser similar ou o mesmo que ExternalDataFetchNodeDataFE
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; 
  body?: string; 
  responseMapping?: string; // Como mapear a resposta para variáveis (ex: "data.token > {{api_token}}")
  // Adicione outras propriedades se o seu ApiCallNode as utiliza
}

// Interface para dados de performance de fluxo (usada em ZapAnalytics)
// Certifique-se que as propriedades correspondem ao que a API retorna e o componente espera.
export interface FlowPerformanceData {
  flowId: string;
  flowName: string; 
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; 
  avgTimeToComplete?: number; // em segundos
  // Considere adicionar mais métricas se sua API as fornecer
  // Ex: dropOffRatePerStep?: Array<{ stepName: string; dropOffCount: number; }>;
}

// União de todos os tipos de dados de nós, se precisar de um tipo genérico para `Node<data>`
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
