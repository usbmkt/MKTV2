// zap/client/src/components/flow_builder_nodes/QuestionNode.tsx
import React, { memo, ChangeEvent } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Button } from '@zap_client/components/ui/button';
import { MessageCircleQuestion, Trash2, PlusCircle } from 'lucide-react';
import { QuestionNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Importe o tipo

const QuestionNode: React.FC<NodeProps<QuestionNodeData>> = ({ data, id, selected }) => {
  // Desestruture TODAS as propriedades de QuestionNodeData com valores padrão
  const {
    label = 'Pergunta',
    questionText = '',
    expectedResponseType = 'text',
    variableToSaveAnswer = '',
    quickReplies = []
  } = data;

  // Implemente a lógica de atualização de dados se este nó for editável
  // const updateData = (field: keyof QuestionNodeData, value: any) => {
  //   // Chamar a função onNodesChange do ReactFlow ou um setter de estado global
  // };

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
            // onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateData('questionText', e.target.value)}
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
            {(quickReplies).map((reply: string, index: number) => ( // Tipagem adicionada para reply e index
              <div key={index} className="flex items-center space-x-1">
                <Input
                  type="text"
                  value={reply}
                  // onChange={(e: ChangeEvent<HTMLInputElement>) => {/* Lógica para atualizar reply específico */}}
                  className="w-full h-7 text-xs"
                  placeholder={`Opção ${index + 1}`}
                />
                {/* Botão de remover e Handle aqui como no exemplo anterior, se necessário */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id={`qr-${id}-${index}`}
                    style={{ top: 'auto', background: '#555', right: -5, marginTop: `${index * 30}px` }} // Ajuste dinâmico de marginTop
                    className="!w-2 !h-2 !relative"
                />
              </div>
            ))}
            {/* Botão para adicionar mais quick replies */}
          </div>
        )}
        <div>
          <Label htmlFor={`saveVar-${id}`} className="text-xs font-medium">Salvar Resposta na Variável</Label>
          <Input
            id={`saveVar-${id}`}
            type="text"
            placeholder="{{nome_da_variavel}}"
            value={variableToSaveAnswer}
            // onChange={(e: ChangeEvent<HTMLInputElement>) => updateData('variableToSaveAnswer', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {expectedResponseType !== 'quick_reply' && (
         <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
      )}
    </Card>
  );
};
export default memo(QuestionNode);
