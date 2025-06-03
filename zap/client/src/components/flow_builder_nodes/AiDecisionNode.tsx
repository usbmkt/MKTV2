// zap/client/src/components/flow_builder_nodes/AiDecisionNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Brain, ListPlus, Trash2 } from 'lucide-react';
import { AiDecisionNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const AiDecisionNode: React.FC<NodeProps<AiDecisionNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Decisão IA', 
    inputVariable = '', 
    decisionCategories = [] 
  } = data;

  // Lógica para atualizar 'data' (ex: via onNodesChange)
  // const updateData = (field: keyof AiDecisionNodeData, value: any) => { ... };
  // const addCategory = () => {
  //   const newCategories = [...(decisionCategories || []), { id: `cat_${Date.now()}`, name: 'Nova Categoria' }];
  //   updateData('decisionCategories', newCategories);
  // };
  // const updateCategory = (index: number, newName: string) => {
  //   const newCategories = [...(decisionCategories || [])];
  //   if (newCategories[index]) {
  //     newCategories[index] = { ...newCategories[index], name: newName };
  //     updateData('decisionCategories', newCategories);
  //   }
  // };
  // const removeCategory = (index: number) => {
  //   const newCategories = (decisionCategories || []).filter((_, i) => i !== index);
  //   updateData('decisionCategories', newCategories);
  // };


  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-purple-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <Brain className="w-4 h-4 text-purple-500 mr-2" />
          {label || 'Decisão por IA'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`inputVar-${id}`} className="text-xs font-medium">Variável de Entrada (Texto para IA)</Label>
          <Input
            id={`inputVar-${id}`}
            type="text"
            placeholder="Ex: {{ultima_mensagem_cliente}}"
            value={inputVariable}
            // onChange={(e) => updateData('inputVariable', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Categorias de Decisão (Handles de Saída)</Label>
          {(decisionCategories || []).map((category, index) => (
            <div key={category.id || index} className="flex items-center space-x-1 mt-1">
              <Input
                type="text"
                placeholder={`Categoria ${index + 1}`}
                value={category.name}
                // onChange={(e) => updateCategory(index, e.target.value)}
                className="w-full h-7 text-xs"
              />
              {/* <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCategory(index)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button> */}
              <Handle
                type="source"
                position={Position.Right}
                id={category.id || `cat-out-${index}`} // ID do handle deve ser único
                style={{ top: `${(index + 1) * 25 + 60}px`, background: '#555' }} // Ajuste o posicionamento
              />
            </div>
          ))}
          {/* <Button variant="outline" size="sm" className="text-xs mt-1 w-full h-7" onClick={addCategory}>
            <ListPlus className="w-3.5 h-3.5 mr-1" /> Adicionar Categoria
          </Button> */}
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {/* Handles de saída são criados dinamicamente acima para cada categoria */}
    </Card>
  );
};

export default memo(AiDecisionNode);
