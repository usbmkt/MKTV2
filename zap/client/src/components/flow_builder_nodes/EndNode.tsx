// zap/client/src/components/flow_builder_nodes/EndNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { LogOut, CircleSlash } from 'lucide-react'; // Usar CircleSlash ou LogOut
import { cn } from '@zap_client/lib/utils';

export interface EndNodeData {
  label?: string;
  endMessage?: string; // Mensagem opcional ao finalizar
}

const EndNode: React.FC<NodeProps<EndNodeData>> = ({ data, selected, id, type }) => {
  return (
    <div
      className={cn(
        "p-3 px-4 rounded-lg shadow-md bg-red-50 border border-red-600/70 w-60", // Cor vermelha para fim
        selected && "ring-2 ring-red-700 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        id={`${id}-target`} 
        className="!bg-red-600 w-3 h-3" 
      />
      <div className="flex items-center mb-1">
        <CircleSlash className="w-4 h-4 mr-2 text-red-700" />
        <div className="text-sm font-semibold text-red-800">{data.label || 'Fim do Fluxo'}</div>
      </div>
      {data.endMessage && (
        <p className="text-xs text-red-700/80 truncate" title={data.endMessage}>
            Mensagem: "{data.endMessage}"
        </p>
      )}
       {!data.endMessage && (
        <p className="text-xs text-red-700/80 italic">Fluxo finalizado.</p>
      )}
      {/* Nenhum Handle de saída para o nó final */}
    </div>
  );
};

export default EndNode; 
