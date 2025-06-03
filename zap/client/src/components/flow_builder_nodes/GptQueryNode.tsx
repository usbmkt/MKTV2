// zap/client/src/components/flow_builder_nodes/GptQueryNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Sparkles } from 'lucide-react';
import { GptQueryNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const GptQueryNode: React.FC<NodeProps<GptQueryNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Consulta GPT', 
    promptTemplate = '', 
    // inputVariables = [], // Se for usar array de strings
    variableToSaveResult = '' 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof GptQueryNodeData, value: any) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-indigo-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <Sparkles className="w-4 h-4 text-indigo-500 mr-2" />
          {label || 'Consulta Inteligência Artificial'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`prompt-${id}`} className="text-xs font-medium">Prompt / Pergunta para IA</Label>
          <Textarea
            id={`prompt-${id}`}
            placeholder="Ex: Resuma o seguinte texto: {{texto_cliente}}"
            value={promptTemplate}
            // onChange={(e) => updateData('promptTemplate', e.target.value)}
            rows={4}
            className="w-full text-xs"
          />
           <p className="text-[10px] text-muted-foreground mt-1">Use {'{{variavel}}'} para inserir variáveis.</p>
        </div>
        {/* // Se for usar inputVariables como um array de strings:
        <div>
          <Label htmlFor={`inputVars-${id}`} className="text-xs font-medium">Variáveis de Entrada (separadas por vírgula)</Label>
          <Input
            id={`inputVars-${id}`}
            type="text"
            placeholder="Ex: texto_cliente, tom_da_conversa"
            value={(inputVariables || []).join(', ')}
            // onChange={(e) => updateData('inputVariables', e.target.value.split(',').map(v => v.trim()))}
            className="w-full h-8 text-xs"
          />
        </div> 
        */}
        <div>
          <Label htmlFor={`saveVar-${id}`} className="text-xs font-medium">Salvar Resultado na Variável</Label>
          <Input
            id={`saveVar-${id}`}
            type="text"
            placeholder="{{resultado_ia}}"
            value={variableToSaveResult}
            // onChange={(e) => updateData('variableToSaveResult', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(GptQueryNode);
