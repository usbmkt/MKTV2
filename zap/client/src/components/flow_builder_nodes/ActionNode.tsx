import React, { memo, useState, useEffect, useCallback, ChangeEvent } from 'react'; // Adicionado ChangeEvent
import { Handle, Position, NodeToolbar, NodeProps as ReactFlowNodeProps, useReactFlow } from '@xyflow/react';
import { ActionNodeData, FlowNodeType, HandleData, ActionType } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Settings, Trash2, Edit3 } from 'lucide-react'; // Removidos Mail, Tag, UserPlus, Webhook não usados diretamente aqui
import { cn } from '@zap_client/lib/utils';


const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: { top: '50%' } },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: { top: '50%' } },
];

const ActionNodeComponent: React.FC<ReactFlowNodeProps<ActionNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState(data.label || 'Nova Ação');
  const [actionType, setActionType] = useState<ActionType>(data.actionType || ActionType.ADD_TAG);
  const [actionParams, setActionParams] = useState(data.actionParams || {});
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  useEffect(() => {
    setLabel(data.label || 'Nova Ação');
    setActionType(data.actionType || ActionType.ADD_TAG);
    setActionParams(data.actionParams || {});
  }, [data]);

  const updateNodeFullData = useCallback((newFullData: ActionNodeData) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: newFullData } : node))
    );
  }, [id, setNodes]);
  
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  const handleLabelSave = () => {
    const newLabel = label.trim() || `Ação ${data.actionType}`;
    setLabel(newLabel);
    updateNodeFullData({ ...data, label: newLabel });
    setIsEditingLabel(false);
  };
  
  const handleActionTypeChange = (value: string) => {
    const newActionType = value as ActionType;
    setActionType(newActionType);
    // Resetar actionParams ao mudar o tipo, pois os parâmetros podem ser diferentes
    const newParams = {};
    setActionParams(newParams);
    updateNodeFullData({ ...data, label: data.label, actionType: newActionType, actionParams: newParams });
  };

  const handleParamChange = (paramName: string, value: string) => {
    const newParams = { ...actionParams, [paramName]: value };
    setActionParams(newParams);
    updateNodeFullData({ ...data, label: data.label, actionType: actionType, actionParams: newParams });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  const renderActionParamsInputs = () => {
    switch (actionType) {
      case ActionType.ADD_TAG:
      case ActionType.REMOVE_TAG:
        return (
          <div>
            <Label htmlFor={`param-tagName-${id}`} className="text-xs">Nome da Tag</Label>
            <Input 
              id={`param-tagName-${id}`} 
              value={actionParams.tagName || ''} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleParamChange('tagName', e.target.value)} 
              placeholder="Ex: cliente_vip" 
              className="mt-1 neu-input" 
            />
          </div>
        );
      case ActionType.ASSIGN_TO_AGENT:
        return (
          <div>
            <Label htmlFor={`param-agentId-${id}`} className="text-xs">ID do Agente/Usuário</Label>
            <Input 
              id={`param-agentId-${id}`} 
              value={actionParams.agentId || ''} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleParamChange('agentId', e.target.value)} 
              placeholder="Ex: user_123 ou email@example.com" 
              className="mt-1 neu-input" 
            />
          </div>
        );
      case ActionType.SEND_EMAIL:
        return (
            <>
                <div>
                    <Label htmlFor={`param-to-${id}`} className="text-xs">Para (Email)</Label>
                    <Input id={`param-to-${id}`} value={actionParams.to || ''} onChange={(e) => handleParamChange('to', e.target.value)} placeholder="{{contact.email}} ou email@destino.com" className="mt-1 neu-input" />
                </div>
                <div>
                    <Label htmlFor={`param-subject-${id}`} className="text-xs">Assunto</Label>
                    <Input id={`param-subject-${id}`} value={actionParams.subject || ''} onChange={(e) => handleParamChange('subject', e.target.value)} placeholder="Assunto do seu email" className="mt-1 neu-input" />
                </div>
                <div>
                    <Label htmlFor={`param-emailTemplateId-${id}`} className="text-xs">ID do Template de Email (Opcional)</Label>
                    <Input id={`param-emailTemplateId-${id}`} value={actionParams.emailTemplateId || ''} onChange={(e) => handleParamChange('emailTemplateId', e.target.value)} placeholder="Ex: template_bem_vindo_email" className="mt-1 neu-input" />
                    <p className="text-xs text-muted-foreground mt-1">Se usar template, o corpo abaixo pode ser ignorado ou usado como fallback.</p>
                </div>
                <div>
                    <Label htmlFor={`param-body-${id}`} className="text-xs">Corpo do Email (HTML ou Texto)</Label>
                    <Textarea id={`param-body-${id}`} value={actionParams.body || ''} onChange={(e) => handleParamChange('body', e.target.value)} placeholder="Conteúdo do seu email..." className="mt-1 neu-input" rows={3}/>
                </div>
            </>
        );
      case ActionType.SET_CONTACT_FIELD:
        return (
          <>
            <div>
              <Label htmlFor={`param-fieldName-${id}`} className="text-xs">Nome do Campo do Contato</Label>
              <Input 
                id={`param-fieldName-${id}`} 
                value={actionParams.fieldName || ''} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleParamChange('fieldName', e.target.value)} 
                placeholder="Ex: cidade, custom_field_123" 
                className="mt-1 neu-input" 
              />
            </div>
            <div>
              <Label htmlFor={`param-fieldValue-${id}`} className="text-xs">Valor para o Campo</Label>
              <Input 
                id={`param-fieldValue-${id}`} 
                value={actionParams.fieldValue || ''} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleParamChange('fieldValue', e.target.value)} 
                placeholder="Use {{variavel}} para valores dinâmicos" 
                className="mt-1 neu-input" 
              />
            </div>
          </>
        );
      // Adicionar mais cases para START_FLOW, SUBSCRIBE_SEQUENCE, UNSUBSCRIBE_SEQUENCE, WAIT
      case ActionType.START_FLOW:
        return (
            <div>
                <Label htmlFor={`param-targetFlowId-${id}`} className="text-xs">ID do Fluxo de Destino</Label>
                <Input id={`param-targetFlowId-${id}`} value={actionParams.targetFlowId || ''} onChange={(e) => handleParamChange('targetFlowId', e.target.value)} placeholder="ID do fluxo a ser iniciado" className="mt-1 neu-input" />
            </div>
        );
      default:
        return <p className="text-xs text-muted-foreground">Selecione um tipo de ação para ver os parâmetros.</p>;
    }
  };

  return (
    <Card className={cn("w-72 shadow-md neu-card", selected && "ring-2 ring-indigo-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1">
        <Button variant="outline" size="xs" onClick={() => setIsEditingLabel(true)} title="Editar Nome">
          <Edit3 className="h-3 w-3" />
        </Button>
        <Button variant="destructive" size="xs" onClick={handleDeleteNode} title="Remover Nó">
          <Trash2 className="h-3 w-3" />
        </Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-indigo-500/10 dark:bg-indigo-700/20 rounded-t-lg">
         {isEditingLabel ? (
          <div className="flex items-center gap-1">
            <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e) => e.key === 'Enter' && handleLabelSave()} />
          </div>
        ) : (
          <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
            <Settings className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            {data.label || 'Ação'}
          </CardTitle>
        )}
        <Badge variant="default" className="bg-indigo-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`action-type-${id}`} className="text-xs">Tipo de Ação</Label>
          <Select value={actionType} onValueChange={handleActionTypeChange}>
            <SelectTrigger id={`action-type-${id}`} className="w-full mt-1 neu-input">
              <SelectValue placeholder="Selecione a ação" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ActionType).map((type) => (
                <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').toLocaleLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 p-2 border-t border-dashed">
            {renderActionParamsInputs()}
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => ( // Adicionado tipo HandleData
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={handleItem.isConnectable !== undefined ? handleItem.isConnectable : true}
          style={{ ...handleItem.style, background: '#4f46e5', width: '10px', height: '10px' }} // Cor índigo para consistência
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ActionNodeComponent);
