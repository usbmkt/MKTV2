// zap/client/src/components/flow_builder_nodes/QuestionNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { HelpCircle, MessageCircleQuestion } from 'lucide-react'; // Ícone alterado
import { QuestionNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const QuestionNode: React.FC<NodeProps<QuestionNodeData>> = ({ data, id, selected }) => {
  const {
    label = 'Pergunta',
    questionText = '',
    expectedResponseType = 'text',
    variableToSaveAnswer = '',
    quickReplies = []
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof QuestionNodeData, value: any) => { /* ... */ };
  // const handleQuickReplyChange = (index: number, value: string) => { /* ... */ };
  // const addQuickReply = () => { /* ... */ };
  // const removeQuickReply = (index: number) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-blue-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <MessageCircleQuestion className="w-4 h-4 text-blue-500 mr-2" />
          {label || 'Fazer Pergunta'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`questionText-${id}`} className="text-xs font-medium">Texto da Pergunta*</Label>
          <Textarea
            id={`questionText-${id}`}
            placeholder="Ex: Qual o seu email?"
            value={questionText}
            // onChange={(e) => updateData('questionText', e.target.value)}
            rows={3}
            className="w-full text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`responseType-${id}`} className="text-xs font-medium">Tipo de Resposta Esperada</Label>
          <Select
            value={expectedResponseType}
            // onValueChange={(value) => updateData('expectedResponseType', value as QuestionNodeData['expectedResponseType'])}
          >
            <SelectTrigger id={`responseType-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Tipo de resposta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto Livre</SelectItem>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="quick_reply">Resposta Rápida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {expectedResponseType === 'quick_reply' && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Respostas Rápidas (Botões)</Label>
            {(quickReplies || []).map((reply, index) => (
              <div key={index} className="flex items-center space-x-1">
                <Input
                  type="text"
                  value={reply}
                  // onChange={(e) => handleQuickReplyChange(index, e.target.value)}
                  className="w-full h-7 text-xs"
                />
                {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuickReply(index)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button> */}
                 <Handle
                    type="source"
                    position={Position.Right}
                    id={`qr-${id}-${index}`}
                    style={{ top: `${(index * 28) + 160}px`, background: '#555' }} // Ajustar posição
                    className="!w-2 !h-2"
                />
              </div>
            ))}
            {/* {(quickReplies || []).length < 10 && ( // Limite de respostas rápidas
              <Button variant="outline" size="xs" className="text-xs mt-1 w-full h-7" onClick={addQuickReply}>
                Adicionar Resposta Rápida
              </Button>
            )} */}
          </div>
        )}
        <div>
          <Label htmlFor={`saveVar-${id}`} className="text-xs font-medium">Salvar Resposta na Variável</Label>
          <Input
            id={`saveVar-${id}`}
            type="text"
            placeholder="{{nome_da_variavel}}"
            value={variableToSaveAnswer}
            // onChange={(e) => updateData('variableToSaveAnswer', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {/* Se não for quick_reply, um handle de saída padrão. Quick replies têm handles individuais. */}
      {expectedResponseType !== 'quick_reply' && (
         <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
      )}
    </Card>
  );
};

export default memo(QuestionNode);
