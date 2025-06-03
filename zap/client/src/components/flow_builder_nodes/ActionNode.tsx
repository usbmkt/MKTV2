import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react'; // Usar NodeProps diretamente
import { ActionNodeData, FlowNodeType, HandleData, ActionType } from '@zap_client/features/types/whatsapp_flow_types'; // Corrigido path
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card'; // Corrigido path
import { Button } from '@zap_client/components/ui/button'; // Corrigido path
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select'; // Corrigido path
import { Input } from '@zap_client/components/ui/input'; // Corrigido path
import { Label } from '@zap_client/components/ui/label'; // Corrigido path
import { Bot, Trash2, Edit3, Settings, Mail, Tag, UserPlus, Webhook } from 'lucide-react';
import { cn } from '@zap_client/lib/utils'; // Corrigido path
import { useReactFlow } from '@xyflow/react';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: { top: '50%' } },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: { top: '50%' } },
];

// Usando ReactFlowNodeProps<ActionNodeData> para tipar as props
const ActionNode: React.FC<ReactFlowNodeProps<ActionNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais para os campos do nó
  const [label, setLabel] = useState(data.label || 'Nova Ação');
  const [actionType, setActionType] = useState<ActionType>(data.actionType || ActionType.ADD_TAG);
  
  // Estados para parâmetros específicos da ação
  const [tagName, setTagName] = useState(data.actionParams?.tagName || '');
  const [agentId, setAgentId] = useState(data.actionParams?.agentId || '');
  const [emailTemplateId, setEmailTemplateId] = useState(data.actionParams?.emailTemplateId || '');
  const [contactPropertyName, setContactPropertyName] = useState(data.actionParams?.contactPropertyName || '');
  const [contactPropertyValue, setContactPropertyValue] = useState(data.actionParams?.contactPropertyValue || '');
  const [webhookUrl, setWebhookUrl] = useState(data.actionParams?.apiUrl || ''); // Assumindo apiUrl para webhook

  const [isEditingLabel, setIsEditingLabel] = useState(false);


  useEffect(() => {
    // Atualizar estados locais se `data` prop mudar externamente
    setLabel(data.label || 'Nova Ação');
    setActionType(data.actionType || ActionType.ADD_TAG);
    setTagName(data.actionParams?.tagName || '');
    setAgentId(data.actionParams?.agentId || '');
    setEmailTemplateId(data.actionParams?.emailTemplateId || '');
    setContactPropertyName(data.actionParams?.contactPropertyName || '');
    setContactPropertyValue(data.actionParams?.contactPropertyValue || '');
    setWebhookUrl(data.actionParams?.apiUrl || '');
  }, [data]);

  const updateNodeActionParams = (paramName: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          const currentData = node.data as ActionNodeData;
          return {
            ...node,
            data: {
              ...currentData,
              actionParams: {
                ...currentData.actionParams,
                [paramName]: value,
              },
            },
          };
        }
        return node;
      })
    );
  };
  
  const updateNodeField = useCallback((field: keyof ActionNodeData, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, [field]: value } };
        }
        return node;
      })
    );
  }, [id, setNodes]);


  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };
  const handleLabelSave = () => {
    updateNodeField('label', label);
    setIsEditingLabel(false);
  };
  const handleActionTypeChange = (value: string) => {
    const newActionType = value as ActionType;
    setActionType(newActionType);
    updateNodeField('actionType', newActionType);
    // Resetar actionParams relevantes ao mudar o tipo
    updateNodeField('actionParams', {}); 
    setTagName(''); setAgentId(''); setEmailTemplateId(''); 
    setContactPropertyName(''); setContactPropertyValue(''); setWebhookUrl('');
  };

  // Handlers para mudanças nos parâmetros específicos
  const handleTagNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(e.target.value);
    updateNodeActionParams('tagName', e.target.value);
  };
  const handleAgentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentId(e.target.value);
    updateNodeActionParams('agentId', e.target.value);
  };
  const handleEmailTemplateIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailTemplateId(e.target.value);
    updateNodeActionParams('emailTemplateId', e.target.value);
  };
    const handleContactPropertyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactPropertyName(e.target.value);
    updateNodeActionParams('contactPropertyName', e.target.value);
  };
  const handleContactPropertyValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactPropertyValue(e.target.value);
    updateNodeActionParams('contactPropertyValue', e.target.value);
  };
  const handleWebhookUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebhookUrl(e.target.value);
    updateNodeActionParams('apiUrl', e.target.value); // Assumindo que apiUrl é usado para webhook
  };


  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  const renderActionParams = () => {
    switch (actionType) {
      case ActionType.ADD_TAG:
      case ActionType.REMOVE_TAG:
        return (
          <div>
            <Label htmlFor={`tag-name-${id}`} className="text-xs">Nome da Tag</Label>
            <Input id={`tag-name-${id}`} value={tagName} onChange={handleTagNameChange} placeholder="Ex: cliente_vip" className="mt-1 neu-input" />
          </div>
        );
      case ActionType.ASSIGN_TO_AGENT:
        return (
          <div>
            <Label htmlFor={`agent-id-${id}`} className="text-xs">ID do Agente</Label>
            <Input id={`agent-id-${id}`} value={agentId} onChange={handleAgentIdChange} placeholder="Ex: agente_007" className="mt-1 neu-input" />
          </div>
        );
      case ActionType.SEND_EMAIL:
         return (
            <div>
                <Label htmlFor={`email-template-id-${id}`} className="text-xs">ID do Template de Email</Label>
                <Input id={`email-template-id-${id}`} value={emailTemplateId} onChange={handleEmailTemplateIdChange} placeholder="Ex: template_boas_vindas" className="mt-1 neu-input" />
            </div>
        );
      case ActionType.SET_CONTACT_FIELD:
        return (
            <div className="space-y-2">
                <div>
                    <Label htmlFor={`contact-prop-name-${id}`} className="text-xs">Nome da Propriedade do Contato</Label>
                    <Input id={`contact-prop-name-${id}`} value={contactPropertyName} onChange={handleContactPropertyNameChange} placeholder="Ex: cidade" className="mt-1 neu-input" />
                </div>
                <div>
                    <Label htmlFor={`contact-prop-value-${id}`} className="text-xs">Valor da Propriedade</Label>
                    <Input id={`contact-prop-value-${id}`} value={contactPropertyValue} onChange={handleContactPropertyValueChange} placeholder="Ex: São Paulo" className="mt-1 neu-input" />
                </div>
            </div>
        );
        // Adicionar casos para SUBSCRIBE_SEQUENCE, UNSUBSCRIBE_SEQUENCE, START_FLOW (chamada API) etc.
        // Exemplo START_FLOW (se for uma chamada API para iniciar outro fluxo):
      /*
      case ActionType.START_FLOW:
        return (
          <div>
            <Label htmlFor={`webhook-url-${id}`} className="text-xs">URL do Webhook/API para Iniciar Fluxo</Label>
            <Input id={`webhook-url-${id}`} value={webhookUrl} onChange={handleWebhookUrlChange} placeholder="https://api.exemplo.com/start-flow" className="mt-1 neu-input" />
          </div>
        );
      */
      default:
        return <p className="text-xs text-muted-foreground">Configure os parâmetros desta ação.</p>;
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
            {renderActionParams()}
        </div>
      </CardContent>

      {handlesToRender.map(handle => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          isConnectable={handle.isConnectable !== undefined ? handle.isConnectable : true}
          style={{ ...handle.style, background: '#5c6bc0', width: '10px', height: '10px' }} // Cor índigo
          aria-label={handle.label}
        />
      ))}
    </Card>
  );
};

export default memo(ActionNode);
