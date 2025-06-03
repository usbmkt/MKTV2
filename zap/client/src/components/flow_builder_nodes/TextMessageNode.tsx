// zap/client/src/components/flow_builder_nodes/TextMessageNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { MessageSquareText } from 'lucide-react'; // Ícone para mensagem de texto
import { TextMessageNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const TextMessageNode: React.FC<NodeProps<TextMessageNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Mensagem de Texto', 
    message = '' 
  } = data;

  // Lógica para atualizar 'data' (ex: via onNodesChange passada como prop ou contexto)
  // const updateMessage = (newMessage: string) => {
  //   // onNodesChange([{ id, type: 'data', data: { ...data, message: newMessage } }]);
  // };

  return (
    <Card className={`text-xs shadow-md w-64 ${selected ? 'ring-2 ring-blue-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <MessageSquareText className="w-4 h-4 text-blue-500 mr-2" />
          {label || 'Enviar Mensagem'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div>
          <Label htmlFor={`message-${id}`} className="text-xs font-medium">Conteúdo da Mensagem</Label>
          <Textarea
            id={`message-${id}`}
            value={message}
            // onChange={(e) => updateMessage(e.target.value)}
            placeholder="Digite sua mensagem aqui... Use {{variavel}} para variáveis."
            rows={4}
            className="w-full text-xs mt-1"
          />
        </div>
        <p className="text-muted-foreground text-[10px] mt-1 truncate" title={message}>
          {message || "Nenhuma mensagem definida."}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} id="a" className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} id="b" className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(TextMessageNode);
