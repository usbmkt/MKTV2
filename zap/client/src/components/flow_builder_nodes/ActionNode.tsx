// zap/client/src/components/flow_builder_nodes/ActionNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button'; // Exemplo se usar botão
import { Input } from '@zap_client/components/ui/input';   // Exemplo se usar input
import { Label } from '@zap_client/components/ui/label';   // Exemplo se usar label
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select'; // Exemplo
import { Bot, Tag, User, GitBranch, Mail, Edit3 } from 'lucide-react'; // Ícones importados
import { ActionNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Importe seu tipo de dados

const ActionNode: React.FC<NodeProps<ActionNodeData>> = ({ data, selected, id }) => {
  const { label = 'Ação', actionType = 'add_tag', tagName, agentId, emailTemplateId, contactPropertyName, contactPropertyValue } = data;

  // Função para atualizar os dados do nó (exemplo, você precisará de um onNodesChange)
  // const updateNodeData = (newData: Partial<ActionNodeData>) => {
  //   // Chamar uma função passada por props ou usar um estado global para atualizar o nó
  //   console.log('Updating node data:', id, newData);
  // };

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

  return (
    <Card className={`text-xs shadow-md w-64 ${selected ? 'ring-2 ring-blue-500' : 'border-gray-300'} bg-card`}>
      <CardHeader className="bg-gray-100 dark:bg-gray-800 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          {getIcon()}
          <span className="ml-2">{label || `Ação: ${actionType}`}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`actionType-${id}`} className="text-xs">Tipo de Ação</Label>
          <Select 
            value={actionType} 
            // onValueChange={(value) => updateNodeData({ actionType: value as ActionNodeData['actionType'] })}
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
            <Label htmlFor={`tagName-${id}`} className="text-xs">Nome da Tag</Label>
            <Input 
              id={`tagName-${id}`} 
              type="text" 
              value={tagName || ''} 
              // onChange={(e) => updateNodeData({ tagName: e.target.value })} 
              className="w-full h-8 text-xs"
            />
          </div>
        )}
         {/* Adicionar mais campos conforme o actionType */}
        {actionType === 'assign_agent' && (
             <div>
                <Label htmlFor={`agentId-${id}`} className="text-xs">ID do Agente</Label>
                <Input id={`agentId-${id}`} value={agentId || ''} /*onChange={...}*/ className="w-full h-8 text-xs" />
            </div>
        )}
        {actionType === 'send_email' && (
             <div>
                <Label htmlFor={`emailTemplateId-${id}`} className="text-xs">ID do Template de Email</Label>
                <Input id={`emailTemplateId-${id}`} value={emailTemplateId || ''} /*onChange={...}*/ className="w-full h-8 text-xs" />
            </div>
        )}
        {actionType === 'update_contact_prop' && (
            <>
                 <div>
                    <Label htmlFor={`propName-${id}`} className="text-xs">Nome da Propriedade</Label>
                    <Input id={`propName-${id}`} value={contactPropertyName || ''} /*onChange={...}*/ className="w-full h-8 text-xs" />
                </div>
                 <div>
                    <Label htmlFor={`propValue-${id}`} className="text-xs">Valor da Propriedade</Label>
                    <Input id={`propValue-${id}`} value={contactPropertyValue || ''} /*onChange={...}*/ className="w-full h-8 text-xs" />
                </div>
            </>
        )}


        <p className="text-gray-500 dark:text-gray-400 text-[10px] truncate">
          {actionType === 'add_tag' && `Adiciona tag: ${tagName || '...'}`}
          {actionType === 'remove_tag' && `Remove tag: ${tagName || '...'}`}
          {/* ... outras descrições ... */}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(ActionNode);
