// zap/client/src/components/flow_builder_nodes/DelayNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Hourglass } from 'lucide-react';
import { DelayNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const DelayNode: React.FC<NodeProps<DelayNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Aguardar', 
    delayAmount = 1, 
    delayUnit = 'seconds' 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof DelayNodeData, value: any) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-60 ${selected ? 'ring-2 ring-orange-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <Hourglass className="w-4 h-4 text-orange-500 mr-2" />
          {label || 'Aguardar'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-end space-x-2">
          <div className="flex-grow">
            <Label htmlFor={`delayAmount-${id}`} className="text-xs font-medium">Tempo</Label>
            <Input
              id={`delayAmount-${id}`}
              type="number"
              min="0"
              value={delayAmount}
              // onChange={(e) => updateData('delayAmount', parseInt(e.target.value, 10) || 0)}
              className="w-full h-8 text-xs"
            />
          </div>
          <div>
            <Label htmlFor={`delayUnit-${id}`} className="text-xs font-medium">Unidade</Label>
            <Select
              value={delayUnit}
              // onValueChange={(value) => updateData('delayUnit', value as DelayNodeData['delayUnit'])}
            >
              <SelectTrigger id={`delayUnit-${id}`} className="w-full h-8 text-xs min-w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-muted-foreground text-[10px] truncate">
          Aguardar por {delayAmount} {delayUnit}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(DelayNode);
