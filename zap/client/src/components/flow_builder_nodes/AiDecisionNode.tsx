// zap/client/src/components/flow_builder_nodes/AiDecisionNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BrainCircuit } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type AiDecisionNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Supondo que o tipo foi movido

const AiDecisionNode: React.FC<NodeProps<AiDecisionNodeData>> = ({ data, selected, id }) => {
  const categories = data.categories || [];
  const baseHandleTop = 65; // Ajustar com base no conteúdo
  const handleSpacing = 20;

  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-pink-500/70 w-72 hover:shadow-lg transition-shadow",
        selected && "ring-2 ring-pink-600 ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <BrainCircuit className="w-4 h-4 mr-2 text-pink-600 flex-shrink-0" />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Decisão com IA'}>{data.label || 'Decisão com IA'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-1" title={data.prompt}>
        Prompt: {data.prompt ? `"${data.prompt.substring(0,40)}${data.prompt.length > 40 ? '...' : ''}"` : 'Configure...'}
      </p>
      {data.saveDecisionTo && <p className="text-xxs text-pink-700 dark:text-pink-400 mb-2">Salvar em: <span className="font-mono bg-pink-100 dark:bg-pink-900 px-1 py-0.5 rounded">{data.saveDecisionTo}</span></p>}
      
      {categories.length > 0 && (
        <div className="mt-1 space-y-1 border-t border-border/50 pt-2">
            <p className="text-xxs font-medium text-muted-foreground mb-1">Saídas por Categoria:</p>
            {categories.slice(0,4).map((category, index) => (
                <div key={category || `cat-out-${index}`} className="text-xs text-muted-foreground flex justify-end items-center relative h-5">
                    <span className="truncate mr-2 text-xxs" title={category}>{category || `Categoria ${index + 1}`}</span>
                    <Handle type="source" position={Position.Right} id={category} className="!bg-pink-500 w-2.5 h-2.5 !mr-[-11px]" style={{ top: `${baseHandleTop + (index * handleSpacing)}px` }} />
                </div>
            ))}
            {categories.length > 4 && <p className="text-xxs text-muted-foreground text-right">... e mais {categories.length - 4} saídas</p>}
        </div>
      )}
      {categories.length === 0 && <p className="text-xs text-muted-foreground italic mt-1">Adicione categorias de saída...</p>}
      {/* Handle de saída padrão/falha */}
      <Handle type="source" position={Position.Right} id="default_output_handle" title="Saída Padrão/Falha" className="!bg-slate-500 w-2.5 h-2.5" style={{bottom: '10px'}}/>
    </div>
  );
};
export default AiDecisionNode;