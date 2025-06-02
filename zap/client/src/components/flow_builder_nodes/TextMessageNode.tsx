// zap/client/src/components/flow_builder_nodes/TextMessageNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquareText } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';

export interface TextMessageNodeData {
  label?: string; // Título do nó
  messageText?: string;
  // Outras propriedades específicas...
}

const TextMessageNode: React.FC<NodeProps<TextMessageNodeData>> = ({ data, selected, type }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-blue-500/70 w-64",
        selected && "ring-2 ring-blue-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <MessageSquareText className="w-4 h-4 mr-2 text-blue-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Enviar Mensagem de Texto'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3 break-words">
        {data.messageText || 'Clique para configurar o texto...'}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default TextMessageNode;