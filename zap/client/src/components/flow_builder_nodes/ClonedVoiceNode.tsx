// zap/client/src/components/flow_builder_nodes/ClonedVoiceNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Voicemail } from 'lucide-react'; // Usar Voicemail ou MicVocal
import { cn } from '@zap_client/lib/utils';

export interface ClonedVoiceNodeData {
  label?: string;
  textToSpeak?: string;
  voiceId?: string; // ID da voz clonada a ser usada
}

const ClonedVoiceNode: React.FC<NodeProps<ClonedVoiceNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-rose-500/70 w-72", // Cor rosa para voz
        selected && "ring-2 ring-rose-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <Voicemail className="w-4 h-4 mr-2 text-rose-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Mensagem de Voz (IA)'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-1" title={data.textToSpeak}>
        Texto: {data.textToSpeak ? `"${data.textToSpeak.substring(0,40)}${data.textToSpeak.length > 40 ? '...' : ''}"` : 'Configure o texto...'}
      </p>
      <p className="text-xxs text-rose-700 dark:text-rose-400">
        Voz ID: <span className="font-mono bg-rose-100 dark:bg-rose-900 px-1 py-0.5 rounded">{data.voiceId || 'Padrão'}</span>
      </p>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default ClonedVoiceNode; 
