// zap/client/src/components/flow_builder_nodes/ApiCallNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CloudCog, ExternalLink } from 'lucide-react'; // Usar CloudCog para API
import { cn } from '@zap_client/lib/utils';

export interface ApiCallNodeData {
  label?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: string; // JSON string
  body?: string;    // JSON string
  saveResponseTo?: string; // Nome da variável para salvar a resposta
}

const ApiCallNode: React.FC<NodeProps<ApiCallNodeData>> = ({ data, selected, type }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-orange-500/70 w-64", // Cor laranja para API
        selected && "ring-2 ring-orange-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <CloudCog className="w-4 h-4 mr-2 text-orange-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Chamada de API'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate">
            <span className="font-medium">Método:</span> {data.method || 'N/D'}
        </p>
        <p className="truncate" title={data.url || 'URL não configurada'}>
            <span className="font-medium">URL:</span> {data.url || 'Configure...'}
        </p>
        <p className="truncate">
            <span className="font-medium">Salvar em:</span> {data.saveResponseTo || 'N/D'}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id="success" className="!bg-green-500 w-2.5 h-2.5 !top-[35%]" title="Sucesso"/>
      <Handle type="source" position={Position.Right} id="failure" className="!bg-red-500 w-2.5 h-2.5 !top-[65%]" title="Falha"/>
    </div>
  );
};

export default ApiCallNode;