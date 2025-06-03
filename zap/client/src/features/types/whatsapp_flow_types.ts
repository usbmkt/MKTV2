import { Node } from '@xyflow/react'; // Ou do 'reactflow' se ainda estiver usando ele

export interface ActionNodeData {
  label?: string;
  actionType?: string;
  // ... outras propriedades
}
export type ActionNodeType = Node<ActionNodeData, 'action'>;

export interface AiDecisionNodeData { /* ...definições... */ }
export interface DelayNodeData { /* ...definições... */ }
// ... e assim por diante para todos os tipos de nós
