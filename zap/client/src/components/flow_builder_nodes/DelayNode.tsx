 
// zap/client/src/components/flow_builder_nodes/DelayNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';

export interface DelayNodeData {
  label?: string;
  delaySeconds?: number;
}

const DelayNode: React.FC<NodeProps<DelayNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-gray-500/70 w-60",
        selected && "ring-2 ring-gray-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <Clock className="w-4 h-4 mr-2 text-gray-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Aguardar Tempo'}</div>
      </div>
      <p className="text-xs text-muted-foreground">
        Aguardar por: <span className="font-medium text-foreground">{data.delaySeconds || 0}</span> segundo(s)
      </p>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default DelayNode;