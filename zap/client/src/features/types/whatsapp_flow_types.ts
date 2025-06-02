// zap/client/src/features/types/whatsapp_flow_types.ts
export interface NodeData {
  label: string;
  [key: string]: any; 
}

export interface FlowNode {
  id: string;
  type?: string; 
  data: NodeData; // Agora pode ser TextMessageNodeData, ConditionNodeData, etc.
  position: { x: number; y: number };
  // Outras propriedades do React Flow
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // Adicionado para saídas condicionais
  targetHandle?: string | null; // Adicionado para múltiplas entradas (menos comum)
  label?: string;
  animated?: boolean;
  type?: 'smoothstep' | 'default' | string; // Tipo da aresta
  markerEnd?: any; // Para setas
}

export interface FlowElementData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Tipos para ListMessageNode
export interface ListItemData { 
  id: string; // Usado para o valor retornado quando o item é selecionado
  title: string; 
  description?: string; 
}
export interface ListSectionData { 
  title: string; 
  rows: ListItemData[]; 
}

export interface SendMessagePayload { /* ... como antes ... */ }
export interface ZapUser { /* ... como antes ... */ }
export interface WhatsAppConnectionStatus { /* ... como antes ... */ }
export interface ApiError { /* ... como antes ... */ }

// Tipos de Dados específicos para Nós (podem ser expandidos aqui ou nos arquivos dos nós)
export interface TextMessageNodeData extends NodeData { messageText?: string; }
export interface Condition { id: string; variable?: string; operator?: string; value?: string; outputLabel?: string; }
export interface ConditionNodeData extends NodeData { conditions?: Condition[]; defaultOutputLabel?: string; }
export interface ApiCallNodeData extends NodeData { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url?: string; headers?: string; body?: string; saveResponseTo?: string; }
export interface ButtonOptionData { id: string; label: string; value?: string; }
export interface ButtonsMessageNodeData extends NodeData { messageText?: string; buttons?: ButtonOptionData[]; footerText?: string; }
export interface QuestionNodeData extends NodeData { questionText?: string; variableToSave?: string; }
export interface MediaMessageNodeData extends NodeData { mediaType?: 'image' | 'video' | 'audio' | 'document'; url?: string; caption?: string; fileName?: string; mimeType?: string; ptt?: boolean; }
export interface ListMessageNodeDataFE extends NodeData { messageText?: string; buttonText?: string; title?: string; footerText?: string; sections?: ListSectionData[]; } // FE para Frontend, já que FlowElementData usa any
export interface ExternalDataFetchNodeDataFE extends NodeData { url?: string; method?: 'GET'; saveToVariable?: string; } // FE para Frontend 
