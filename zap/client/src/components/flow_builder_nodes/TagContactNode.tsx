import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { TagContactNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Tag, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const TagContactNodeComponent: React.FC<ReactFlowNodeProps<TagContactNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Etiquetar Contato');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [tagName, setTagName] = useState<string>(data.tagName || '');
  const [tagOperation, setTagOperation] = useState<TagContactNodeData['tagOperation']>(data.tagOperation || 'add');


  useEffect(() => {
    setLabel(data.label || 'Etiquetar Contato');
    setTagName(data.tagName || '');
    setTagOperation(data.tagOperation || 'add');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<TagContactNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as TagContactNodeData;
            return { ...node, data: { ...currentData, ...newData } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );
  
  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleLabelSave = () => {
    updateNodePartialData({ label });
    setIsEditingLabel(false);
  };

  const handleTagNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTagName(e.target.value);
    updateNodePartialData({ tagName: e.target.value });
  };
  
  const handleOperationChange = (value: string) => {
    const newOperation = value as TagContactNodeData['tagOperation'];
    setTagOperation(newOperation);
    updateNodePartialData({ tagOperation: newOperation });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-72 shadow-md neu-card", selected && "ring-2 ring-amber-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-amber-500/10 dark:bg-amber-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <Tag className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                {data.label || 'Etiquetar Contato'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-amber-500 text-black capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`tag-name-${id}`} className="text-xs">Nome da Tag *</Label>
          <Input id={`tag-name-${id}`} value={tagName} onChange={handleTagNameChange} placeholder="Ex: lead_qualificado" className="mt-1 neu-input"/>
        </div>
        <div>
          <Label htmlFor={`tag-operation-${id}`} className="text-xs">Operação</Label>
          <Select value={tagOperation} onValueChange={handleOperationChange}>
            <SelectTrigger id={`tag-operation-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Adicionar Tag</SelectItem>
              <SelectItem value="remove">Remover Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#f59e0b', width: '10px', height: '10px' }} // Cor Âmbar
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(TagContactNodeComponent);
