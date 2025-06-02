// zap/client/src/components/flow_builder_nodes/ListMessageNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ListChecks } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type ListMessageNodeDataFE, type ListSectionData, type ListItemData } from '@zap_client/features/types/whatsapp_flow_types'; // Importar tipos

const ListMessageNode: React.FC<NodeProps<ListMessageNodeDataFE>> = ({ data, selected, id }) => {
  const sections = data.sections || [];
  const totalItems = sections.reduce((acc, section) => acc + (section.rows?.length || 0), 0);
  const baseHandleTop = 70; // Ajustar conforme o layout do nó
  const handleSpacing = 20;

  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-indigo-500/70 w-72",
        selected && "ring-2 ring-indigo-600 ring-offset-2 ring-offset-background"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <ListChecks className="w-4 h-4 mr-2 text-indigo-600" />
        <div className="text-sm font-semibold text-foreground">{data.label || 'Mensagem com Lista'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1 break-words mb-1" title={data.messageText}>
        {data.messageText || 'Configure o texto principal...'}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-1 break-words mb-1" title={data.buttonText}>
        Botão Lista: {data.buttonText || 'Ver Opções'}
      </p>
      <p className="text-xxs text-indigo-700 dark:text-indigo-400 mb-2">
        {sections.length} seção(ões), {totalItems} item(ns).
      </p>
      
      {/* Saídas dinâmicas para cada item da lista (simplificado) */}
      {/* Em um sistema real, a resposta do usuário com o 'rowId' do item clicado seria processada pelo FlowEngine */}
      {/* Aqui, apenas simbolizamos que pode haver múltiplas saídas baseadas nas opções da lista */}
      {sections.flatMap(sec => sec.rows).slice(0, 3).map((item, index) => ( // Mostrar até 3 handles de exemplo
         <div key={item.id || `item-out-${index}`} className="text-xs text-muted-foreground flex justify-end items-center relative h-5">
            <span className="truncate mr-2 text-xxs" title={item.title}>{item.title}</span>
            <Handle
                type="source"
                position={Position.Right}
                id={item.id} // O ID do handle DEVE ser o ID/valor do item da lista
                className="!bg-indigo-500 w-2.5 h-2.5 !mr-[-11px]"
                style={{ top: `${baseHandleTop + (index * handleSpacing)}px` }}
            />
        </div>
      ))}
      {totalItems > 3 && <p className="text-xxs text-muted-foreground text-right">... e mais saídas</p>}


      {data.footerText && (
        <p className="mt-1 pt-1 border-t text-xxs text-muted-foreground/80 truncate">{data.footerText}</p>
      )}
      {/* Handle de saída padrão/fallback se nenhum item for clicado (ou para fluxos sem espera) */}
       <Handle type="source" position={Position.Right} id={`${id}-source-default`} title="Saída padrão" className="!bg-slate-500 w-2.5 h-2.5" style={{bottom: '10px'}}/>
    </div>
  );
};

export default ListMessageNode; 
