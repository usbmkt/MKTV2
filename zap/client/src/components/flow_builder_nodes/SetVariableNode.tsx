// zap/client/src/components/flow_builder_nodes/SetVariableNode.tsx
import React, { memo, ChangeEvent } from 'react'; // Adicionado ChangeEvent
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Variable, PlusCircle, Trash2 } from 'lucide-react';
import { SetVariableNodeData, SetVariableNodeDataAssignment } from '@zap_client/features/types/whatsapp_flow_types'; // Assumindo que SetVariableNodeDataAssignment é exportado ou defina-o aqui

const SetVariableNode: React.FC<NodeProps<SetVariableNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Definir Variável', 
    assignments = [{ variableName: '', value: '' }] 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (newAssignments: SetVariableNodeData['assignments']) => {
  //   // onNodesChange([{ id, type: 'dataUpdate', data: { ...data, assignments: newAssignments } }]);
  // };

  // const handleAssignmentChange = (index: number, field: keyof SetVariableNodeDataAssignment, val: string) => {
  //   const newAssignments = [...(assignments || [])];
  //   if(newAssignments[index]) {
  //     (newAssignments[index] as any)[field] = val; // Use um cast mais seguro se possível
  //     updateData(newAssignments);
  //   }
  // };

  // const addAssignment = () => {
  //   updateData([...(assignments || []), { variableName: '', value: '' }]);
  // };

  // const removeAssignment = (index: number) => {
  //   updateData((assignments || []).filter((_, i) => i !== index));
  // };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-lime-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <Variable className="w-4 h-4 text-lime-500 mr-2" />
          {label || 'Definir Variável'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        {(assignments || []).map((assignment: SetVariableNodeDataAssignment, index: number) => ( // Tipagem adicionada
          <div key={index} className="space-y-1 p-2 border rounded border-dashed">
            <div className="flex items-center justify-between">
                <Label htmlFor={`varName-${id}-${index}`} className="text-xs font-medium">Nome da Variável</Label>
                {/* { (assignments || []).length > 1 && (
                     <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAssignment(index)}>
                        <Trash2 className="h-3 w-3 text-destructive"/>
                    </Button>
                )} */}
            </div>
            <Input
              id={`varName-${id}-${index}`}
              type="text"
              placeholder="Ex: nome_cliente"
              value={assignment.variableName || ''}
              // onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'variableName', e.target.value)}
              className="w-full h-7 text-xs"
            />
            <div>
              <Label htmlFor={`varValue-${id}-${index}`} className="text-xs font-medium">Valor</Label>
              <Input
                id={`varValue-${id}-${index}`}
                type="text"
                placeholder="Ex: João ou {{outra_variavel}}"
                value={String(assignment.value ?? '')}
                // onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'value', e.target.value)}
                className="w-full h-7 text-xs"
              />
            </div>
          </div>
        ))}
        {/* <Button variant="outline" size="xs" className="text-xs mt-1 w-full h-7" onClick={addAssignment}>
          <PlusCircle className="w-3.5 h-3.5 mr-1" /> Adicionar Atribuição
        </Button> */}
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(SetVariableNode);
