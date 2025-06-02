// zap/client/src/components/flow_builder_nodes/TagContactNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Tag } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type TagContactNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Supondo que o tipo foi movido

const TagContactNode: React.FC<NodeProps<TagContactNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-fuchsia-500/70 w-64 hover:shadow-lg transition-shadow",
        selected && "ring-2 ring-fuchsia-600 ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <Tag className="w-4 h-4 mr-2 text-fuchsia-600 flex-shrink-0" />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Etiquetar Contato'}>{data.label || 'Etiquetar Contato'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate">
            <span className="font-medium">Ação:</span> {data.action === 'remove' ? 'Remover' : 'Adicionar'} Tag
        </p>
        <p className="truncate" title={data.tagName}>
            <span className="font-medium">Tag:</span> {data.tagName || 'N/D'}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};
export default TagContactNode;