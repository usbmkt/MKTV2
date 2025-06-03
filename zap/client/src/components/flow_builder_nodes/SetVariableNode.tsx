import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { GripVertical, PlusCircle, Trash2, Settings2 } from 'lucide-react';
import { SetVariableNodeData, VariableAssignment } from '@zap_client/features/types/whatsapp_flow_types'; // Ajustado o import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';


const SetVariableNode: React.FC<NodeProps<SetVariableNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<SetVariableNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<SetVariableNodeData>) => {
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

  const handleAssignmentChange = (index: number, field: keyof VariableAssignment, value: string | VariableAssignment['source']) => {
    const newAssignments = [...(nodeData.assignments || [])];
    if (newAssignments[index]) {
      (newAssignments[index] as any)[field] = value;
      updateNodeData({ assignments: newAssignments });
    }
  };

  const addAssignment = () => {
    const newAssignment: VariableAssignment = { variableName: '', value: '', source: 'static' };
    updateNodeData({ assignments: [...(nodeData.assignments || []), newAssignment] });
  };

  const removeAssignment = (index: number) => {
    const newAssignments = (nodeData.assignments || []).filter((_, i) => i !== index);
    updateNodeData({ assignments: newAssignments });
  };

  return (
    <Card className={`w-96 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Settings2 className="w-4 h-4 mr-2 text-gray-600" />
          <CardTitle className="text-sm font-medium">{nodeData.label || 'Definir Variável'}</CardTitle>
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
            placeholder="Ex: Salvar Email do Usuário"
            className="mt-1 w-full nodrag"
          />
        </div>

        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-gray-800">Atribuições de Variáveis</h4>
                <Button variant="outline" size="sm" onClick={addAssignment} className="nodrag">
                    <PlusCircle className="w-3 h-3 mr-1" /> Add Atribuição
                </Button>
            </div>
          {(nodeData.assignments || []).map((assignment: VariableAssignment, index: number) => (
            <div key={index} className="p-3 border rounded bg-gray-50 space-y-2">
              <div className="flex items-end space-x-2">
                <div className="flex-grow">
                  <Label htmlFor={`variableName-${id}-${index}`} className="text-xs">Nome da Variável</Label>
                  <Input
                    id={`variableName-${id}-${index}`}
                    placeholder="Ex: userEmail"
                    value={assignment.variableName || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'variableName', e.target.value)}
                    className="mt-1 w-full nodrag"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeAssignment(index)} className="nodrag mb-1">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div>
                <Label htmlFor={`source-${id}-${index}`} className="text-xs">Fonte do Valor</Label>
                <Select
                    value={assignment.source || 'static'}
                    onValueChange={(value) => handleAssignmentChange(index, 'source', value as VariableAssignment['source'])}
                >
                    <SelectTrigger id={`source-${id}-${index}`} className="w-full mt-1 nodrag">
                        <SelectValue placeholder="Selecione a fonte" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="static">Valor Estático</SelectItem>
                        <SelectItem value="expression">Expressão</SelectItem>
                        <SelectItem value="contact_data">Dado do Contato</SelectItem>
                        {/* Adicionar mais fontes se necessário */}
                    </SelectContent>
                </Select>
              </div>

              {assignment.source === 'static' && (
                <div>
                  <Label htmlFor={`value-${id}-${index}`} className="text-xs">Valor</Label>
                  <Input
                    id={`value-${id}-${index}`}
                    placeholder="Valor estático"
                    value={String(assignment.value || '')}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'value', e.target.value)}
                    className="mt-1 w-full nodrag"
                  />
                </div>
              )}
              {assignment.source === 'expression' && (
                <div>
                  <Label htmlFor={`expression-${id}-${index}`} className="text-xs">Expressão</Label>
                  <Input
                    id={`expression-${id}-${index}`}
                    placeholder="Ex: {{variavel1}} + {{variavel2}}"
                    value={assignment.expression || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'expression', e.target.value)}
                    className="mt-1 w-full nodrag"
                  />
                </div>
              )}
              {assignment.source === 'contact_data' && (
                <div>
                  <Label htmlFor={`contactField-${id}-${index}`} className="text-xs">Campo do Contato</Label>
                  <Input
                    id={`contactField-${id}-${index}`}
                    placeholder="Ex: email, phone_number, name"
                    value={assignment.contactField || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'contactField', e.target.value)}
                    className="mt-1 w-full nodrag"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
      </CardContent>
    </Card>
  );
};

export default memo(SetVariableNode);
