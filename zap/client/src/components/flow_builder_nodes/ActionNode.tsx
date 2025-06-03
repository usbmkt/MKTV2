// zap/client/src/components/flow_builder_nodes/ActionNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Bot, Tag, User, GitBranch, Mail, Edit3 } from 'lucide-react'; // Ícones importados
import { ActionNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Importe o tipo de dados

// Esta função de update é apenas um exemplo, você precisará conectá-la ao seu estado ReactFlow (onNodesChange)
const handleDataChange = (id: string, field: keyof ActionNodeData, value: any, onNodesChange: any) => {
  onNodesChange([{ id, type: 'data', data: { [field]: value } }]);
};


const ActionNode: React.FC<NodeProps<ActionNodeData>> = ({ data, selected, id /*, onNodesChange - você precisaria passar isso */ }) => {
  // Forneça valores padrão para todas as propriedades desestruturadas de `data`
  const { 
    label = 'Ação', 
    actionType = 'add_tag', // Valor padrão
    tagName = '', 
    agentId = '', 
    emailTemplateId = '', 
    contactPropertyName = '', 
    contactPropertyValue = '' 
  } = data;

  const getIcon = () => {
    switch (actionType) {
      case 'add_tag':
      case 'remove_tag':
        return <Tag className="w-4 h-4 text-blue-500" />;
      case 'assign_agent':
        return <User className="w-4 h-4 text-green-500" />;
      case 'send_email':
        return <Mail className="w-4 h-4 text-purple-500" />;
      case 'update_contact_prop':
        return <Edit3 className="w-4 h-4 text-orange-500" />;
      default:
        return <Bot className="w-4 h-4 text-gray-500" />;
    }
  };

  // Exemplo de handler para Select (precisaria ser adaptado para sua lógica de estado)
  // const onActionTypeChange = (newActionType: ActionNodeData['actionType']) => {
  //   // handleDataChange(id, 'actionType', newActionType, onNodesChange);
  // };

  return (
    <Card className={`text-xs shadow-md w-64 ${selected ? 'ring-2 ring-primary' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          {getIcon()}
          <span className="ml-2">{label || `Ação: ${actionType}`}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`actionType-${id}`} className="text-xs font-medium">Tipo de Ação</Label>
          <Select 
            value={actionType} 
            // onValueChange={onActionTypeChange} // Conecte ao seu manipulador de estado
          >
            <SelectTrigger id={`actionType-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add_tag">Adicionar Tag</SelectItem>
              <SelectItem value="remove_tag">Remover Tag</SelectItem>
              <SelectItem value="assign_agent">Atribuir Agente</SelectItem>
              <SelectItem value="send_email">Enviar Email</SelectItem>
              <SelectItem value="update_contact_prop">Atualizar Propriedade</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(actionType === 'add_tag' || actionType === 'remove_tag') && (
          <div>
            <Label htmlFor={`tagName-${id}`} className="text-xs font-medium">Nome da Tag</Label>
            <Input 
              id={`tagName-${id}`} 
              type="text" 
              value={tagName} 
              // onChange={(e) => handleDataChange(id, 'tagName', e.target.value, onNodesChange)} 
              className="w-full h-8 text-xs"
            />
          </div>
        )}
        {actionType === 'assign_agent' && (
             <div>
                <Label htmlFor={`agentId-${id}`} className="text-xs font-medium">ID do Agente</Label>
                <Input id={`agentId-${id}`} value={agentId} 
                // onChange={(e) => handleDataChange(id, 'agentId', e.target.value, onNodesChange)} 
                className="w-full h-8 text-xs" />
            </div>
        )}
        {actionType === 'send_email' && (
             <div>
                <Label htmlFor={`emailTemplateId-${id}`} className="text-xs font-medium">ID do Template de Email</Label>
                <Input id={`emailTemplateId-${id}`} value={emailTemplateId} 
                // onChange={(e) => handleDataChange(id, 'emailTemplateId', e.target.value, onNodesChange)} 
                className="w-full h-8 text-xs" />
            </div>
        )}
        {actionType === 'update_contact_prop' && (
            <>
                 <div>
                    <Label htmlFor={`propName-${id}`} className="text-xs font-medium">Nome da Propriedade</Label>
                    <Input id={`propName-${id}`} value={contactPropertyName} 
                    // onChange={(e) => handleDataChange(id, 'contactPropertyName', e.target.value, onNodesChange)} 
                    className="w-full h-8 text-xs" />
                </div>
                 <div>
                    <Label htmlFor={`propValue-${id}`} className="text-xs font-medium">Valor da Propriedade</Label>
                    <Input id={`propValue-${id}`} value={String(contactPropertyValue)}  // Converta para string se puder ser outros tipos
                    // onChange={(e) => handleDataChange(id, 'contactPropertyValue', e.target.value, onNodesChange)} 
                    className="w-full h-8 text-xs" />
                </div>
            </>
        )}
        {/* Adicione mais inputs para outras actionTypes aqui */}
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(ActionNode);
