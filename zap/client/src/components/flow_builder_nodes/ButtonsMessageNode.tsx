// zap/client/src/components/flow_builder_nodes/ButtonsMessageNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { MessageSquare, PlusCircle, Trash2 } from 'lucide-react'; // RadioButton removido, MessageSquare como placeholder
import { ButtonsMessageNodeData, ButtonOptionData } from '@zap_client/features/types/whatsapp_flow_types';

const ButtonsMessageNode: React.FC<NodeProps<ButtonsMessageNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Msg. com Botões', 
    messageText = '', 
    headerText = '', // opcional
    footerText = '', // opcional
    buttons = [] 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof ButtonsMessageNodeData, value: any) => { ... };
  // const addButton = () => { ... };
  // const updateButtonText = (index: number, text: string) => { ... };
  // const removeButton = (index: number) => { ... };


  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-blue-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <MessageSquare className="w-4 h-4 text-blue-500 mr-2" /> {/* Ícone placeholder */}
          {label || 'Mensagem com Botões'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`headerText-${id}`} className="text-xs font-medium">Texto do Cabeçalho (Opcional)</Label>
          <Input
            id={`headerText-${id}`}
            type="text"
            placeholder="Cabeçalho da mensagem"
            value={headerText}
            // onChange={(e) => updateData('headerText', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`messageText-${id}`} className="text-xs font-medium">Texto da Mensagem*</Label>
          <Textarea
            id={`messageText-${id}`}
            placeholder="Digite sua mensagem aqui..."
            value={messageText}
            // onChange={(e) => updateData('messageText', e.target.value)}
            rows={3}
            className="w-full text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`footerText-${id}`} className="text-xs font-medium">Texto do Rodapé (Opcional)</Label>
          <Input
            id={`footerText-${id}`}
            type="text"
            placeholder="Rodapé da mensagem"
            value={footerText}
            // onChange={(e) => updateData('footerText', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Botões (Máx 3)</Label>
          {(buttons || []).map((button, index) => (
            <div key={button.id || index} className="flex items-center space-x-1 mt-1">
              <Input
                type="text"
                placeholder={`Texto Botão ${index + 1}`}
                value={button.displayText}
                // onChange={(e) => updateButtonText(index, e.target.value)}
                className="w-full h-7 text-xs"
              />
              {/* <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeButton(index)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button> */}
              <Handle
                type="source"
                position={Position.Right}
                id={button.id || `button-out-${index}`}
                style={{ top: `${(index + 1) * 30 + 150}px`, background: '#555' }} // Ajuste o posicionamento
              />
            </div>
          ))}
          {/* {(buttons || []).length < 3 && (
            <Button variant="outline" size="sm" className="text-xs mt-1 w-full h-7" onClick={addButton}>
              <PlusCircle className="w-3.5 h-3.5 mr-1" /> Adicionar Botão
            </Button>
          )} */}
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {/* Os handles de saída para botões são criados dinamicamente acima */}
    </Card>
  );
};

export default memo(ButtonsMessageNode);
