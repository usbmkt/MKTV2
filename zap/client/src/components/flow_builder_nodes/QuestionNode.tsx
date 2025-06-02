// zap/client/src/components/flow_builder_nodes/QuestionNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { HelpCircle, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { type QuestionNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const QuestionNode: React.FC<NodeProps<QuestionNodeData>> = ({ data, selected, id }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card border border-teal-500/70 w-72 hover:shadow-lg transition-shadow",
        selected && "ring-2 ring-teal-600 ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <HelpCircle className="w-4 h-4 mr-2 text-teal-600 flex-shrink-0" />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Coletar Resposta'}>{data.label || 'Coletar Resposta'}</div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-1" title={data.questionText}>
        "{data.questionText || 'Faça sua pergunta aqui...'}"
      </p>
      <p className="text-xxs text-teal-700 dark:text-teal-400">
        Salvar resposta em: <span className="font-mono bg-teal-100 dark:bg-teal-900 px-1 py-0.5 rounded">{data.variableToSave || 'N/A'}</span>
      </p>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" title="Próximo passo após resposta"/>
      {/* Opcional: handle de timeout se a pergunta não for respondida */}
      {/* <Handle type="source" position={Position.Right} id={`${id}-source-timeout`} className="!bg-orange-400 w-2.5 h-2.5" style={{top: "65%"}} title="Timeout"/> */}
    </div>
  );
};

export default QuestionNode; 
