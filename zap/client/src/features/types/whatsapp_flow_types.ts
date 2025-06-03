// Em zap/client/src/features/types/whatsapp_flow_types.ts
import { Node } from '@xyflow/react';

export interface ActionNodeData {
  label?: string;
  actionType?: string;
  // outras propriedades específicas...
}

export type ActionNodeType = Node<ActionNodeData, 'action'>; // Exemplo de tipo específico

// EXPORTE TODOS OS OUTROS TIPOS DE DADOS DOS NÓS AQUI
// export interface AiDecisionNodeData { ... }
// export interface DelayNodeData { ... }
// etc.