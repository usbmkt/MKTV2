// zap/client/src/components/flow_builder_nodes/ApiCallNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Zap as ZapIcon, Settings2 } from 'lucide-react'; // Usando ZapIcon ou Settings2
import { ApiCallNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const ApiCallNode: React.FC<NodeProps<ApiCallNodeData>> = ({ data, id, selected }) => {
  // Forneça valores padrão para todas as propriedades desestruturadas de 'data'
  // com base na sua definição em whatsapp_flow_types.ts
  const {
    label = 'Chamada API',
    url = '',
    method = 'GET', // Valor padrão
    headers = '{}', // JSON string como padrão
    body = '{}',    // JSON string como padrão
    responseMapping = ''
  } = data;

  // Exemplo de função para atualizar dados (precisa ser conectada ao estado do ReactFlow)
  // const handleChange = (field: keyof ApiCallNodeData, value: any) => {
  //   console.log(`Updating ${field} for node ${id}:`, value);
  //   // Aqui você chamaria uma função para atualizar o nó no estado do ReactFlow
  //   // Ex: props.onDataChange(id, { ...data, [field]: value });
  // };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-teal-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <ZapIcon className="w-4 h-4 text-teal-500 mr-2" />
          {label || 'Chamada de API'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`url-${id}`} className="text-xs font-medium">URL da API*</Label>
          <Input
            id={`url-${id}`}
            type="text"
            placeholder="https://sua.api.com/endpoint"
            value={url}
            // onChange={(e) => handleChange('url', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`method-${id}`} className="text-xs font-medium">Método HTTP</Label>
          <Select
            value={method}
            // onValueChange={(value) => handleChange('method', value as ApiCallNodeData['method'])}
          >
            <SelectTrigger id={`method-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Selecione o método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              {/* Adicione outros métodos se necessário */}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`headers-${id}`} className="text-xs font-medium">Cabeçalhos (JSON)</Label>
          <Textarea
            id={`headers-${id}`}
            placeholder='{ "Authorization": "Bearer SEU_TOKEN", "Content-Type": "application/json" }'
            value={headers}
            // onChange={(e) => handleChange('headers', e.target.value)}
            rows={3}
            className="w-full text-xs font-mono"
          />
        </div>
        {(method === 'POST' || method === 'PUT' || method === 'PATCH') && ( // Adicionado PATCH
          <div>
            <Label htmlFor={`body-${id}`} className="text-xs font-medium">Corpo da Requisição (JSON)</Label>
            <Textarea
              id={`body-${id}`}
              placeholder='{ "chave": "valor", "id_usuario": "{{user_id}}" }'
              value={body}
              // onChange={(e) => handleChange('body', e.target.value)}
              rows={4}
              className="w-full text-xs font-mono"
            />
          </div>
        )}
         <div>
          <Label htmlFor={`responseMapping-${id}`} className="text-xs font-medium">Mapeamento da Resposta (Opcional)</Label>
          <Input
            id={`responseMapping-${id}`}
            type="text"
            placeholder="Ex: data.token para var {{api_token}}"
            value={responseMapping}
            // onChange={(e) => handleChange('responseMapping', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="target" position={Position.Left} id="a" className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} id="onSuccess" style={{ top: '30%', background: '#22C55E' }} className="w-2.5 h-2.5" >
         <span className="absolute -left-[45px] top-[-7px] text-[9px] text-muted-foreground bg-background px-0.5 rounded-sm border border-input">Sucesso</span>
      </Handle>
      <Handle type="source" position={Position.Right} id="onFailure" style={{ top: '70%', background: '#EF4444' }} className="w-2.5 h-2.5" >
        <span className="absolute -left-[40px] top-[-7px] text-[9px] text-muted-foreground bg-background px-0.5 rounded-sm border border-input">Falha</span>
      </Handle>
    </Card>
  );
};

export default memo(ApiCallNode);
