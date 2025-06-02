// zap/client/src/components/flow_builder_nodes/ButtonsMessageNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageCircleMore, RadioButton } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type ButtonsMessageNodeData, type ButtonOptionData as FlowButtonOptionData } from '@zap_client/features/types/whatsapp_flow_types'; // Tipos do Zap

const ButtonsMessageNode: React.FC<NodeProps<ButtonsMessageNodeData>> = ({ data, selected, id }) => {
  const buttons = data.buttons || [];
  const baseHandleTop = 60; 
  const handleSpacing = 20; 
  const maxButtonsToShow = 3; // Máximo de botões/handles para mostrar visualmente no nó

  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-sky-500/70 w-72 hover:shadow-lg transition-shadow",
        selected && "ring-2 ring-sky-600 ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <MessageCircleMore className="w-4 h-4 mr-2 text-sky-600 flex-shrink-0" />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Mensagem com Botões'}>{data.label || 'Mensagem com Botões'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-2" title={data.messageText}>
        {data.messageText || 'Configure o texto da mensagem...'}
      </p>
      
      {buttons.length > 0 && (
        <div className="mt-1 space-y-1 border-t border-border/50 pt-2">
            <p className="text-xxs font-medium text-muted-foreground mb-1">Saídas dos Botões:</p>
            {buttons.slice(0, maxButtonsToShow).map((button, index) => (
                <div key={button.id || `btn-out-${index}`} className="text-xs text-muted-foreground flex justify-end items-center relative h-5">
                    <span className="truncate mr-2 text-xxs" title={button.label}>{button.label || `Botão ${index + 1}`}</span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={button.id} // O ID do handle DEVE ser o ID do botão
                        className="!bg-sky-500 w-2.5 h-2.5 !mr-[-11px]"
                        style={{ top: `${baseHandleTop + (index * handleSpacing)}px` }}
                    />
                </div>
            ))}
            {buttons.length > maxButtonsToShow && <p className="text-xxs text-muted-foreground text-right">... e mais {buttons.length - maxButtonsToShow} saídas</p>}
        </div>
      )}
       {buttons.length === 0 && <p className="text-xs text-muted-foreground italic mt-1">Adicione botões no painel de propriedades...</p>}

      {data.footerText && (
        <p className="mt-2 pt-1 border-t border-border/50 text-xxs text-muted-foreground/80 truncate">{data.footerText}</p>
      )}
      {/* Pode ter uma saída "default" ou "timeout" se o usuário não clicar em nenhum botão */}
       <Handle type="source" position={Position.Right} id={`${id}-source-no_reply`} title="Saída Padrão/Timeout" className="!bg-slate-500 w-2.5 h-2.5" style={{bottom: '10px'}}/>
    </div>
  );
};

export default ButtonsMessageNode; 
