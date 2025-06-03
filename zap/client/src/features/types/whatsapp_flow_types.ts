// Dentro de zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react'; // Importe de @xyflow/react

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'manual' | 'webhook';
  keywords?: string[];
  // ... outras propriedades
}
export type TriggerNodeType = Node<TriggerNodeData, 'trigger'>;

export interface TextMessageNodeData {
  label?: string;
  message?: string;
  // ...
}
export type TextMessageNodeType = Node<TextMessageNodeData, 'textMessage'>;

// Defina e EXPORTE TODAS as outras interfaces de dados dos nós aqui:
// export interface QuestionNodeData { /* ... */ }
// export interface ListMessageNodeDataFE { /* ... */ }
// export interface ButtonsMessageNodeData { /* ... */ }
// export interface MediaMessageNodeData { /* ... */ }
// export interface ConditionNodeData { /* ... */ }
// export interface ActionNodeData { /* ... */ }
// export interface DelayNodeData { /* ... */ } // Corrigido para ser exportado
// export interface EndNodeData { /* ... */ }
// export interface GptQueryNodeData { /* ... */ } // Corrigido
// export interface AiDecisionNodeData { /* ... */ } // Corrigido
// export interface ClonedVoiceNodeData { /* ... */ }
// export interface TagContactNodeData { /* ... */ } // Corrigido
// export interface SetVariableNodeData { /* ... */ } // Corrigido
// export interface ExternalDataFetchNodeDataFE { /* ... */ }
// export interface ApiCallNodeData { /* ... */ }
