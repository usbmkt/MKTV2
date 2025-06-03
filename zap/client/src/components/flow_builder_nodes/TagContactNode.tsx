import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { GripVertical, Tag } from 'lucide-react';
import { TagContactNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Ajustado o import

const TagContactNode: React.FC<NodeProps<TagContactNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<TagContactNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<TagContactNodeData>) => {
    setNodes((nds) =>
      nds.map((node: Node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    setNodeData(prev => ({ ...prev, ...newData }));
  }, [id, setNodes]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateNodeData({ [name]: value });
  };

  const handleSelectChange = (name: keyof TagContactNodeData, value: string) => {
    updateNodeData({ [name]: value as TagContactNodeData['tagOperation'] });
  };

  return (
    <Card className={`w-80 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Tag className="w-4 h-4 mr-2 text-gray-600" />
          <CardTitle className="text-sm font-medium">{nodeData.label || 'Adicionar/Remover Tag'}</CardTitle>
        </div>
        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab drag-handle" />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 rounded-full" />
        <div>
          <Label htmlFor={`label-${id}`} className="text-xs font-medium">Rótulo do Nó</Label>
          <Input
            id={`label-${id}`}
            name="label"
            value={nodeData.label || ''}
            onChange={handleInputChange}
            placeholder="Ex: Tag Cliente VIP"
            className="mt-1 w-full nodrag"
          />
        </div>
        <div>
          <Label htmlFor={`tagOperation-${id}`} className="text-xs font-medium">Operação</Label>
          <Select
            name="tagOperation"
            value={nodeData.tagOperation || 'add'}
            onValueChange={(value) => handleSelectChange('tagOperation', value)}
          >
            <SelectTrigger id={`tagOperation-${id}`} className="w-full mt-1 nodrag">
              <SelectValue placeholder="Selecione a operação" />
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
            name="tagName"
            value={nodeData.tagName || ''}
            onChange={handleInputChange}
            placeholder="Ex: cliente_vip"
            className="mt-1 w-full nodrag"
          />
        </div>
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
      </CardContent>
    </Card>
  );
};

export default memo(TagContactNode);
