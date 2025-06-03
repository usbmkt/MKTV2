// zap/client/src/components/flow_builder_nodes/TagContactNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Tag as TagIcon } from 'lucide-react'; // Renomeado para TagIcon
import { TagContactNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const TagContactNode: React.FC<NodeProps<TagContactNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Marcar Contato', 
    tagOperation = 'add', 
    tagName = '' 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof TagContactNodeData, value: any) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-64 ${selected ? 'ring-2 ring-sky-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <TagIcon className="w-4 h-4 text-sky-500 mr-2" />
          {label || 'Adicionar/Remover Tag'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`operation-${id}`} className="text-xs font-medium">Operação</Label>
          <Select
            value={tagOperation}
            // onValueChange={(value) => updateData('tagOperation', value as TagContactNodeData['tagOperation'])}
          >
            <SelectTrigger id={`operation-${id}`} className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Adicionar Tag</SelectItem>
              <SelectItem value="remove">Remover Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`tagName-${id}`} className="text-xs font-medium">Nome da Tag</Label>
          <Input
            id={`tagName-${id}`}
            type="text"
            placeholder="Ex: cliente_vip"
            value={tagName}
            // onChange={(e) => updateData('tagName', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(TagContactNode);
