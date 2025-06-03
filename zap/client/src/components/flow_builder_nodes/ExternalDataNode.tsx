// zap/client/src/components/flow_builder_nodes/ExternalDataFetchNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { DownloadCloud } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type ExternalDataFetchNodeDataFE } from '@zap_client/features/types/whatsapp_flow_types';

const ExternalDataFetchNode: React.FC<NodeProps<ExternalDataFetchNodeDataFE>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-lime-600/70 w-72",
        selected && "ring-2 ring-lime-700 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <DownloadCloud className="w-4 h-4 mr-2 text-lime-700" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Buscar Dados Externos'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate" title={data.url || 'URL não configurada'}>
            <span className="font-medium">URL:</span> {data.url || 'Configure...'}
        </p>
         <p className="truncate">
            <span className="font-medium">Método:</span> {data.method || 'GET'}
        </p>
        <p className="truncate">
            <span className="font-medium">Salvar em:</span> {data.saveToVariable || 'N/D'}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id="success" className="!bg-green-500 w-2.5 h-2.5 !top-[35%]" title="Sucesso"/>
      <Handle type="source" position={Position.Right} id="failure" className="!bg-red-500 w-2.5 h-2.5 !top-[65%]" title="Falha"/>
    </div>
  );
};

export default ExternalDataFetchNode; 
