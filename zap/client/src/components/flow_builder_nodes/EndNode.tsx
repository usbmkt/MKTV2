// zap/client/src/components/flow_builder_nodes/EndNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { FlagOff, CheckCircle2, AlertOctagon } from 'lucide-react'; // Ícones para diferentes estados finais
import { EndNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const EndNode: React.FC<NodeProps<EndNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Fim do Fluxo', 
    endStateType = 'completed',
    message = ''
  } = data;
  
  // const updateData = (field: keyof EndNodeData, value: any) => { /* ... */ };

  const getIcon = () => {
    switch (endStateType) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />;
      case 'abandoned': return <FlagOff className="w-4 h-4 text-orange-500 mr-2" />;
      case 'error_fallback': return <AlertOctagon className="w-4 h-4 text-red-500 mr-2" />;
      default: return <FlagOff className="w-4 h-4 text-gray-500 mr-2" />;
    }
  };

  return (
    <Card className={`text-xs shadow-md w-60 ${selected ? 'ring-2 ring-gray-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          {getIcon()}
          {label || 'Fim'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`endStateType-${id}`} className="text-xs font-medium">Tipo de Finalização</Label>
          <Select
            value={endStateType}
            // onValueChange={(value) => updateData('endStateType', value as EndNodeData['endStateType'])}
          >
            <SelectTrigger id={`endStateType-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Concluído com Sucesso</SelectItem>
              <SelectItem value="abandoned">Abandonado</SelectItem>
              <SelectItem value="error_fallback">Fallback de Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        { (endStateType === 'completed' || endStateType === 'error_fallback') &&
            <div>
                <Label htmlFor={`endMessage-${id}`} className="text-xs font-medium">Mensagem Final (Opcional)</Label>
                <Input 
                    id={`endMessage-${id}`} 
                    type="text"
                    placeholder="Ex: Obrigado!" 
                    value={message}
                    // onChange={(e) => updateData('message', e.target.value)}
                    className="w-full h-8 text-xs" 
                />
            </div>
        }
        <p className="text-muted-foreground text-[10px] truncate">
          Finaliza o fluxo como: {endStateType}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {/* EndNode geralmente não tem um handle de saída (source) */}
    </Card>
  );
};

export default memo(EndNode);
