 
// zap/client/src/components/flow_builder_nodes/MediaMessageNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Image as ImageIcon, Video, FileText as FileTextIcon, Mic } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';

export interface MediaMessageNodeData {
  label?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  url?: string; 
  caption?: string;
  fileName?: string; 
  mimeType?: string; 
  ptt?: boolean; 
}

const MediaMessageNode: React.FC<NodeProps<MediaMessageNodeData>> = ({ data, selected, id, type }) => {
  let IconComponent = ImageIcon;
  let nodeColorClass = 'border-purple-500/70';
  let iconColorClass = 'text-purple-600';

  if (data.mediaType === 'video') { IconComponent = Video; nodeColorClass = 'border-red-500/70'; iconColorClass = 'text-red-600';}
  else if (data.mediaType === 'audio') { IconComponent = Mic; nodeColorClass = 'border-blue-500/70'; iconColorClass = 'text-blue-600';}
  else if (data.mediaType === 'document') { IconComponent = FileTextIcon; nodeColorClass = 'border-gray-500/70'; iconColorClass = 'text-gray-600';}
  else { /* Padrão Imagem */ nodeColorClass = 'border-pink-500/70'; iconColorClass = 'text-pink-600';}


  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card w-72",
        nodeColorClass,
        selected && `ring-2 ${nodeColorClass.replace('border-','ring-').replace('/70','')} ring-offset-2 ring-offset-background`
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <IconComponent className={cn("w-4 h-4 mr-2", iconColorClass)} />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Enviar Mídia'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate"><span className="font-medium">Tipo:</span> {data.mediaType || 'N/D'}</p>
        <p className="truncate" title={data.url || data.fileName || 'Configure a mídia...'}>
            <span className="font-medium">{data.fileName ? 'Arquivo:' : 'URL:'}</span> {data.fileName || data.url || 'Configure...'}
        </p>
        {data.caption && <p className="truncate" title={data.caption}><span className="font-medium">Legenda:</span> {data.caption}</p>}
      </div>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default MediaMessageNode;