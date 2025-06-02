 
// zap/client/src/components/flow_builder_nodes/ConditionNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';

export interface Condition {
  id: string;
  variable?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value?: string;
  outputLabel?: string; // Rótulo para o handle de saída desta condição
}

export interface ConditionNodeData {
  label?: string;
  conditions?: Condition[]; // Array de condições, cada uma pode ter uma saída
  // defaultOutputLabel?: string; // Rótulo para a saída "else" / padrão
}

const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ data, selected, id }) => {
  const conditions = data.conditions || [{ id: 'cond1', outputLabel: 'Saída 1 (Padrão)' }]; // Pelo menos uma saída

  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-yellow-600/70 w-72",
        selected && "ring-2 ring-yellow-700 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <GitBranch className="w-4 h-4 mr-2 text-yellow-700" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Condição (Se/Então)'}</div>
      </div>
      {conditions.length > 0 ? (
        <div className="space-y-1.5">
          {conditions.map((cond, index) => (
            <div key={cond.id || `cond-${index}`} className="text-xs text-muted-foreground flex justify-between items-center">
              <span>{cond.variable ? `Se ${cond.variable} ${cond.operator} "${cond.value || ''}"` : (cond.outputLabel || `Condição ${index + 1}`)}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${id}-source-${cond.id || index}`} // ID único para cada handle de saída
                className="!bg-green-500 w-2.5 h-2.5 !mr-[-11px]" // Ajustar posição
                style={{ top: `${(index + 1) * 20 + 10}px` }} // Espaçamento vertical dos handles
              />
            </div>
          ))}
          {/* Handle para "else" / default output, se necessário */}
          {/* <div className="text-xs text-muted-foreground flex justify-between items-center mt-1 pt-1 border-t">
             <span>{data.defaultOutputLabel || "Senão (Padrão)"}</span>
             <Handle type="source" position={Position.Right} id={`${id}-source-default`} className="!bg-red-500 w-2.5 h-2.5 !mr-[-11px]" style={{ top: `${(conditions.length + 1) * 20 + 10}px` }} />
          </div> */}
        </div>
      ) : (
         <p className="text-xs text-muted-foreground">Clique para configurar as condições e saídas...</p>
      )}
    </div>
  );
};

export default ConditionNode;