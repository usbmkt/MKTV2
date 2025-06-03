// zap/client/src/components/flow_builder_nodes/ConditionNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { GitCommitVertical } from 'lucide-react'; // Ícone para condição
import { ConditionNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Condição',
    // Assumindo a estrutura mais simples de condição do whatsapp_flow_types.ts de exemplo
    variableToCheck = '',
    operator = 'equals',
    valueToCompare = ''
  } = data;

  // Lógica para atualizar 'data' (ex: via onNodesChange)
  // const updateData = (field: keyof ConditionNodeData, value: any) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-yellow-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <GitCommitVertical className="w-4 h-4 text-yellow-500 mr-2" />
          {label || 'Condição Se/Então'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`variable-${id}`} className="text-xs font-medium">Variável a Verificar</Label>
          <Input
            id={`variable-${id}`}
            type="text"
            placeholder="Ex: {{user_score}}"
            value={variableToCheck}
            // onChange={(e) => updateData('variableToCheck', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`operator-${id}`} className="text-xs font-medium">Operador</Label>
          <Select
            value={operator}
            // onValueChange={(value) => updateData('operator', value as ConditionNodeData['operator'])}
          >
            <SelectTrigger id={`operator-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Selecione operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Igual a</SelectItem>
              <SelectItem value="not_equals">Diferente de</SelectItem>
              <SelectItem value="contains">Contém</SelectItem>
              <SelectItem value="greater_than">Maior que</SelectItem>
              <SelectItem value="less_than">Menor que</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`value-${id}`} className="text-xs font-medium">Valor para Comparar</Label>
          <Input
            id={`value-${id}`}
            type="text"
            placeholder="Ex: 100 ou 'aprovado'"
            value={String(valueToCompare ?? '')}
            // onChange={(e) => updateData('valueToCompare', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <p className="text-muted-foreground text-[10px] truncate">
          Se "{{variableToCheck}}" {operator} "{valueToCompare}"
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} id="a" className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} id="true" style={{ top: '35%', background: '#55FF55' }} className="w-2.5 h-2.5" >
        <span className="absolute -left-8 top-[-6px] text-[9px] text-muted-foreground">Sim</span>
      </Handle>
      <Handle type="source" position={Position.Right} id="false" style={{ top: '65%', background: '#FF5555' }} className="w-2.5 h-2.5" >
         <span className="absolute -left-8 top-[-6px] text-[9px] text-muted-foreground">Não</span>
      </Handle>
    </Card>
  );
};

export default memo(ConditionNode);
