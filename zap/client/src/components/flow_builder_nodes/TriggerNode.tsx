// zap/client/src/components/flow_builder_nodes/TriggerNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap as ZapIcon, SlidersHorizontal } from 'lucide-react'; // Usar SlidersHorizontal para configuração de gatilho
import { cn } from '@zap_client/lib/utils';

export interface TriggerNodeData {
  label?: string;
  triggerType?: 'keyword' | 'first_message' | 'api_call' | 'scheduled' | 'manual';
  config?: Record<string, any>; // Ex: { keyword: "oi" }
}

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ data, selected, id, type }) => {
  const triggerLabel = data.triggerType ? data.triggerType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Manual';
  return (
    <div
      className={cn(
        "p-3 px-4 rounded-lg shadow-md bg-green-50 border border-green-600/70 w-64", // Cor verde para início
        selected && "ring-2 ring-green-700 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Nenhum Handle de entrada para o nó inicial */}
      <div className="flex items-center mb-1">
        <ZapIcon className="w-4 h-4 mr-2 text-green-700" />
        <div className="text-sm font-semibold text-green-800">{data.label || 'Início do Fluxo'}</div>
      </div>
      <div className="text-xs text-green-700/80">
        <p>Gatilho: <span className="font-medium">{triggerLabel}</span></p>
        {data.triggerType === 'keyword' && data.config?.keyword && (
            <p className="truncate" title={`Palavra-chave: ${data.config.keyword}`}>Palavra: <span className="font-mono text-xxs bg-green-100 px-1 rounded">{data.config.keyword}</span></p>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        id={`${id}-source`} 
        className="!bg-green-600 w-3 h-3" 
        title="Próximo passo"
      />
    </div>
  );
};

export default TriggerNode; 
