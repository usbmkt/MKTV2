// zap/client/src/components/flow_builder_nodes/SetVariableNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Edit, Settings2 } from 'lucide-react'; // Usar Settings2 ou Edit
import { cn } from '@zap_client/lib/utils';

export interface SetVariableNodeData {
  label?: string;
  variableName?: string;
  value?: string; // O valor pode ser interpolado
}

const SetVariableNode: React.FC<NodeProps<SetVariableNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-stone-500/70 w-64",
        selected && "ring-2 ring-stone-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <Settings2 className="w-4 h-4 mr-2 text-stone-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Definir Variável'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate" title={data.variableName}>
            <span className="font-medium">Variável:</span> {data.variableName || 'N/D'}
        </p>
        <p className="truncate" title={data.value}>
            <span className="font-medium">Valor:</span> {data.value || 'N/D'}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default SetVariableNode; 
