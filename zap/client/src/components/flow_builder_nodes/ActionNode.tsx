// zap/client/src/components/flow_builder_nodes/ActionNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap, Settings, AlertCircle } from 'lucide-react'; // Zap para ação geral
import { cn } from '@zap_client/lib/utils';

export type ActionType = 
    | 'ADD_TAG' 
    | 'REMOVE_TAG' 
    | 'SEND_EMAIL_ADMIN' 
    | 'UPDATE_CRM_FIELD' 
    | 'START_ANOTHER_FLOW'
    | 'ASSIGN_TO_AGENT'
    | 'CUSTOM_WEBHOOK';

export interface ActionNodeData {
  label?: string;
  actionType?: ActionType;
  actionParams?: Record<string, any>; // Parâmetros específicos para cada tipo de ação
}

const ActionNode: React.FC<NodeProps<ActionNodeData>> = ({ data, selected, id }) => {
  const actionDisplay = data.actionType ? data.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Não Definida';
  let Icon = Settings;
  let color = "border-purple-500/70";
  let textColor = "text-purple-600";

  if (data.actionType?.includes('TAG')) { Icon = Tag; color = "border-fuchsia-500/70"; textColor = "text-fuchsia-600";}
  else if (data.actionType?.includes('EMAIL')) { Icon = AlertCircle; color = "border-blue-500/70"; textColor = "text-blue-600";}
  else if (data.actionType?.includes('CRM')) { Icon = User; color = "border-orange-500/70"; textColor = "text-orange-600";}
  else if (data.actionType?.includes('FLOW')) { Icon = GitBranch; color = "border-teal-500/70"; textColor = "text-teal-600";}


  return (
    <div
      className={cn(
        "p-3 rounded-md shadow-md bg-card w-72",
        color,
        selected && `ring-2 ${color.replace('border-','ring-').replace('/70','')} ring-offset-2 ring-offset-background`
      )}
    >
      <Handle type="target" position={Position.Left} id={`${id}-target`} className="!bg-slate-400 w-2.5 h-2.5" />
      <div className="flex items-center mb-2">
        <Icon className={cn("w-4 h-4 mr-2 flex-shrink-0", textColor)} />
        <div className="text-sm font-semibold text-foreground truncate" title={data.label || 'Executar Ação'}>{data.label || 'Executar Ação'}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="truncate" title={`Ação: ${actionDisplay}`}>
            <span className="font-medium">Ação:</span> {actionDisplay}
        </p>
        {data.actionType === 'ADD_TAG' || data.actionType === 'REMOVE_TAG' ? (
            <p className="truncate" title={`Tag: ${data.actionParams?.tagName || 'N/D'}`}>Tag: <span className="font-mono text-xxs bg-muted px-1 rounded">{data.actionParams?.tagName || 'N/D'}</span></p>
        ) : data.actionType === 'START_ANOTHER_FLOW' ? (
             <p className="truncate" title={`Fluxo ID: ${data.actionParams?.flowId || 'N/D'}`}>Fluxo ID: <span className="font-mono text-xxs bg-muted px-1 rounded">{data.actionParams?.flowId || 'N/D'}</span></p>
        ) : (
            <p className="truncate text-xxs italic">Parâmetros: {data.actionParams ? `${JSON.stringify(data.actionParams).substring(0,30)}...` : 'Configure...'}</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} id={`${id}-source`} className="!bg-slate-400 w-2.5 h-2.5" />
    </div>
  );
};

export default ActionNode; 
