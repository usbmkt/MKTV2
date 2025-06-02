// zap/client/src/components/flow_builder_nodes/GptQueryNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BotMessageSquare } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type GptQueryNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Supondo que o tipo foi movido

const GptQueryNode: React.FC<NodeProps<GptQueryNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-cyan-500/70 w-72 hover:shadow-lg transition-shadow",
        selected && "ring-2 ring-cyan-600 ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <BotMessageSquare className="w-4 h-4 mr-2 text-cyan-600 flex-shrink-0" />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Consulta IA (Texto)'}>{data.label || 'Consulta IA (Texto)'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-1" title={data.prompt}>
        Prompt: {data.prompt ? `"${data.prompt.substring(0,40)}${data.prompt.length > 40 ? '...' : ''}"` : 'Configure o prompt...'}
      </p>
      <p className="text-xxs text-cyan-700 dark:text-cyan-400">
        Salvar em: <span className="font-mono bg-cyan-100 dark:bg-cyan-900 px-1 py-0.5 rounded">{data.variableToSave || 'N/A'}</span>
      </p>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};
export default GptQueryNode;