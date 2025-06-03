// zap/client/src/components/flow_builder_nodes/TriggerNode.tsx
import React, { memo, ChangeEvent } from 'react'; // Adicionado ChangeEvent
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { PlayCircle, Zap as ZapIconOriginal, Keyboard, Webhook, FileInput, Link2 } from 'lucide-react'; // ZapIconOriginal para evitar conflito com nome do módulo
import { TriggerNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Gatilho', 
    triggerType = 'manual', 
    keywords = [],
    formId = '', // Adicionado com base na interface de exemplo
    webhookUrl = '' // Adicionado com base na interface de exemplo
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof TriggerNodeData, value: any) => { /* ... */ };
  // const handleKeywordsChange = (e: ChangeEvent<HTMLInputElement>) => {
  //   const kw = e.target.value.split(',').map(k => k.trim()).filter(k => k);
  //   updateData('keywords', kw);
  // };

  const getIcon = () => {
    switch (triggerType) {
      case 'keyword': return <Keyboard className="w-4 h-4 text-indigo-500 mr-2" />;
      case 'manual': return <PlayCircle className="w-4 h-4 text-green-500 mr-2" />;
      case 'webhook': return <Webhook className="w-4 h-4 text-purple-500 mr-2" />;
      case 'form_submission': return <FileInput className="w-4 h-4 text-orange-500 mr-2" />;
      case 'api_call': return <Link2 className="w-4 h-4 text-sky-500 mr-2" />;
      default: return <ZapIconOriginal className="w-4 h-4 text-gray-500 mr-2" />;
    }
  };

  return (
    <Card className={`text-xs shadow-md w-64 ${selected ? 'ring-2 ring-green-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          {getIcon()}
          {label || `Gatilho: ${triggerType}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`triggerType-${id}`} className="text-xs font-medium">Tipo de Gatilho</Label>
          <Select
            value={triggerType}
            // onValueChange={(value) => updateData('triggerType', value as TriggerNodeData['triggerType'])}
          >
            <SelectTrigger id={`triggerType-${id}`} className="w-full h-8 text-xs">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="keyword">Palavra-chave</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="form_submission">Envio de Formulário</SelectItem>
              <SelectItem value="api_call">Chamada de API Externa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {triggerType === 'keyword' && (
          <div>
            <Label htmlFor={`keywords-${id}`} className="text-xs font-medium">Palavras-chave (separadas por vírgula)</Label>
            <Input
              id={`keywords-${id}`}
              type="text"
              placeholder="Ex: olá, ajuda, suporte"
              value={(keywords || []).join(', ')}
              // onChange={handleKeywordsChange}
              className="w-full h-8 text-xs"
            />
          </div>
        )}
         {triggerType === 'form_submission' && (
          <div>
            <Label htmlFor={`formId-${id}`} className="text-xs font-medium">ID do Formulário</Label>
            <Input
              id={`formId-${id}`}
              type="text"
              placeholder="Ex: meu_form_contato"
              value={formId}
              // onChange={(e: ChangeEvent<HTMLInputElement>) => updateData('formId', e.target.value)}
              className="w-full h-8 text-xs"
            />
          </div>
        )}
         {triggerType === 'webhook' && (
          <div>
            <Label htmlFor={`webhookUrl-${id}`} className="text-xs font-medium">URL do Webhook (somente leitura)</Label>
            <Input
              id={`webhookUrl-${id}`}
              type="text"
              value={`/api/zap/webhooks/trigger/${id}`} // Exemplo de URL gerada
              readOnly
              className="w-full h-8 text-xs bg-muted"
            />
          </div>
        )}
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(TriggerNode);
