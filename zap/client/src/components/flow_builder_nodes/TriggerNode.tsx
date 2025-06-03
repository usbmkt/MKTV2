import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Button } from '@zap_client/components/ui/button';
import { GripVertical, PlayCircle, AlertTriangle, PlusCircle, Trash2, ZapIcon } from 'lucide-react';
import { TriggerNodeData } from '@zap_client/features/types/whatsapp_flow_types'; // Ajustado o import
import { Checkbox } from '@zap_client/components/ui/checkbox';

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<TriggerNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<TriggerNodeData>) => {
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

  const handleSelectChange = (name: keyof TriggerNodeData, value: string) => {
    updateNodeData({ [name]: value as TriggerNodeData['triggerType'] });
  };

  const handleCheckboxChange = (name: keyof TriggerNodeData, checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean') {
      updateNodeData({ [name]: checked });
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...(nodeData.keywords || [])];
    newKeywords[index] = value;
    updateNodeData({ keywords: newKeywords });
  };

  const addKeyword = () => {
    updateNodeData({ keywords: [...(nodeData.keywords || []), ''] });
  };

  const removeKeyword = (index: number) => {
    const newKeywords = (nodeData.keywords || []).filter((_, i) => i !== index);
    updateNodeData({ keywords: newKeywords });
  };


  return (
    <Card className={`w-96 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''} ${!data.triggerType ? 'border-red-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <div className="flex items-center">
          <PlayCircle className="w-4 h-4 mr-2 text-gray-600" />
          <CardTitle className="text-sm font-medium">{nodeData.label || 'Gatilho Inicial'}</CardTitle>
        </div>
        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab drag-handle" />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!data.triggerType && (
          <div className="flex items-center text-red-600 text-xs mb-2">
            <AlertTriangle className="w-4 h-4 mr-1" />
            <span>Configure o tipo de gatilho.</span>
          </div>
        )}
        <div>
          <Label htmlFor={`label-${id}`} className="text-xs font-medium">Rótulo do Nó</Label>
          <Input
            id={`label-${id}`}
            name="label"
            value={nodeData.label || ''}
            onChange={handleInputChange}
            placeholder="Ex: Início por Palavra-Chave"
            className="mt-1 w-full nodrag"
          />
        </div>
        <div>
          <Label htmlFor={`triggerType-${id}`} className="text-xs font-medium">Tipo de Gatilho</Label>
          <Select
            name="triggerType"
            value={nodeData.triggerType || ''}
            onValueChange={(value) => handleSelectChange('triggerType', value)}
          >
            <SelectTrigger id={`triggerType-${id}`} className="w-full mt-1 nodrag">
              <SelectValue placeholder="Selecione o tipo de gatilho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keyword">Palavra-chave</SelectItem>
              <SelectItem value="form_submission">Envio de Formulário</SelectItem>
              <SelectItem value="webhook">Webhook Externo</SelectItem>
              <SelectItem value="manual">Manual (API)</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {nodeData.triggerType === 'keyword' && (
          <div className="space-y-2 p-2 border rounded bg-gray-50">
            <Label className="text-xs font-medium">Palavras-chave</Label>
            {(nodeData.keywords || []).map((keyword, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={keyword}
                  onChange={(e) => handleKeywordChange(index, e.target.value)}
                  placeholder="Digite a palavra-chave"
                  className="flex-grow nodrag"
                />
                <Button variant="ghost" size="icon" onClick={() => removeKeyword(index)} className="nodrag">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addKeyword} className="nodrag">
              <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Palavra-chave
            </Button>
            <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                    id={`exactMatch-${id}`}
                    checked={nodeData.exactMatch || false}
                    onCheckedChange={(checked) => handleCheckboxChange('exactMatch', checked)}
                    className="nodrag"
                />
                <Label htmlFor={`exactMatch-${id}`} className="text-xs font-medium">
                    Correspondência exata da palavra-chave
                </Label>
            </div>
          </div>
        )}

        {nodeData.triggerType === 'form_submission' && (
          <div>
            <Label htmlFor={`formId-${id}`} className="text-xs font-medium">ID do Formulário</Label>
            <Input
              id={`formId-${id}`}
              name="formId"
              value={nodeData.formId || ''}
              onChange={handleInputChange}
              placeholder="ID do formulário integrado"
              className="mt-1 w-full nodrag"
            />
          </div>
        )}

        {nodeData.triggerType === 'webhook' && (
          <div>
            <Label htmlFor={`webhookUrl-${id}`} className="text-xs font-medium">URL do Webhook (gerada pelo sistema)</Label>
            <Input
              id={`webhookUrl-${id}`}
              name="webhookUrl"
              value={nodeData.webhookUrl || 'Será gerada ao salvar o fluxo'}
              readOnly // Geralmente é apenas para exibição
              className="mt-1 w-full bg-gray-100 nodrag"
            />
             <p className="text-xs text-gray-500 mt-1">Este nó expõe uma URL para iniciar o fluxo via HTTP POST.</p>
          </div>
        )}

        {nodeData.triggerType === 'scheduled' && (
            <div>
                <Label htmlFor={`scheduleDateTime-${id}`} className="text-xs font-medium">Data e Hora do Agendamento</Label>
                <Input
                id={`scheduleDateTime-${id}`}
                name="scheduleDateTime"
                type="datetime-local"
                value={nodeData.scheduleDateTime || ''}
                onChange={handleInputChange}
                className="mt-1 w-full nodrag"
                />
            </div>
        )}

        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
      </CardContent>
    </Card>
  );
};

export default memo(TriggerNode);
