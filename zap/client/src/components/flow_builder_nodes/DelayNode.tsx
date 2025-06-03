import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { DelayNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Clock, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const DelayNodeComponent: React.FC<ReactFlowNodeProps<DelayNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Aguardar');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [delayDuration, setDelayDuration] = useState<number>(data.delayDuration || 5);
  const [delayUnit, setDelayUnit] = useState<DelayNodeData['delayUnit']>(data.delayUnit || 'seconds');

  useEffect(() => {
    setLabel(data.label || 'Aguardar');
    setDelayDuration(data.delayDuration || 5);
    setDelayUnit(data.delayUnit || 'seconds');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<DelayNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as DelayNodeData;
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

  const handleDurationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setDelayDuration(isNaN(value) ? 0 : value); // Garante que seja um número
    updateNodePartialData({ delayDuration: isNaN(value) ? 0 : value });
  };

  const handleUnitChange = (value: string) => {
    const newUnit = value as DelayNodeData['delayUnit'];
    setDelayUnit(newUnit);
    updateNodePartialData({ delayUnit: newUnit });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-64 shadow-md neu-card", selected && "ring-2 ring-yellow-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-yellow-500/10 dark:bg-yellow-700/20 rounded-t-lg">
        {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <Clock className="h-4 w-4 mr-2 text-yellow-600 dark:text-yellow-400" />
                {data.label || 'Aguardar'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-yellow-500 text-black capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`delay-duration-${id}`} className="text-xs">Duração</Label>
          <Input 
            id={`delay-duration-${id}`} 
            type="number"
            value={delayDuration} 
            onChange={handleDurationChange} 
            className="mt-1 neu-input"
            min="0"
          />
        </div>
        <div>
          <Label htmlFor={`delay-unit-${id}`} className="text-xs">Unidade</Label>
          <Select value={delayUnit} onValueChange={handleUnitChange}>
            <SelectTrigger id={`delay-unit-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Segundos</SelectItem>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
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
          style={{ ...handleItem.style, background: '#eab308', width: '10px', height: '10px' }} // Cor Amarelo
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(DelayNodeComponent);
