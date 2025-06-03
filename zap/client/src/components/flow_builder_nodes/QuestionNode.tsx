import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { GripVertical, HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import { QuestionNodeData, QuickReply, ListItem } from '@zap_client/features/types/whatsapp_flow_types'; // Ajustado o import

const QuestionNode: React.FC<NodeProps<QuestionNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<QuestionNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<QuestionNodeData>) => {
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


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateNodeData({ [name]: value });
  };

  const handleSelectChange = (name: keyof QuestionNodeData, value: string) => {
    updateNodeData({ [name]: value as QuestionNodeData['expectedResponseType'] });
  };

  const handleQuickReplyChange = (index: number, field: keyof QuickReply, value: string) => {
    const newQuickReplies = [...(nodeData.quickReplies || [])];
    if (newQuickReplies[index]) {
      (newQuickReplies[index] as any)[field] = value;
      updateNodeData({ quickReplies: newQuickReplies });
    }
  };

  const addQuickReply = () => {
    const newQuickReply: QuickReply = { id: `qr-${Date.now()}`, text: 'Nova Resposta', payload: '' };
    updateNodeData({ quickReplies: [...(nodeData.quickReplies || []), newQuickReply] });
  };

  const removeQuickReply = (index: number) => {
    const newQuickReplies = (nodeData.quickReplies || []).filter((_, i) => i !== index);
    updateNodeData({ quickReplies: newQuickReplies });
  };
  
  // Funções para ListOptions (similar a QuickReplies se necessário)
  // Por simplicidade, não implementado aqui mas seguiria o mesmo padrão

  return (
    <Card className={`w-96 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <div className="flex items-center">
          <HelpCircle className="w-4 h-4 mr-2 text-gray-600" />
          <CardTitle className="text-sm font-medium">{nodeData.label || 'Fazer Pergunta'}</CardTitle>
        </div>
        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab drag-handle" />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 rounded-full" />
        <div>
          <Label htmlFor={`label-${id}`} className="text-xs font-medium">Rótulo do Nó</Label>
          <Input
            id={`label-${id}`}
            name="label"
            value={nodeData.label || ''}
            onChange={handleInputChange}
            placeholder="Ex: Perguntar Nome"
            className="mt-1 w-full nodrag"
          />
        </div>
        <div>
          <Label htmlFor={`questionText-${id}`} className="text-xs font-medium">Texto da Pergunta</Label>
          <Textarea
            id={`questionText-${id}`}
            name="questionText"
            value={nodeData.questionText || ''}
            onChange={handleInputChange}
            placeholder="Qual é o seu nome?"
            className="mt-1 w-full nodrag"
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor={`expectedResponseType-${id}`} className="text-xs font-medium">Tipo de Resposta Esperada</Label>
          <Select
            name="expectedResponseType"
            value={nodeData.expectedResponseType || ''}
            onValueChange={(value) => handleSelectChange('expectedResponseType', value)}
          >
            <SelectTrigger id={`expectedResponseType-${id}`} className="w-full mt-1 nodrag">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto Livre</SelectItem>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="quick_reply">Resposta Rápida (Botões)</SelectItem>
              <SelectItem value="list_reply">Resposta de Lista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`variableToSaveAnswer-${id}`} className="text-xs font-medium">Variável para Salvar Resposta</Label>
          <Input
            id={`variableToSaveAnswer-${id}`}
            name="variableToSaveAnswer"
            value={nodeData.variableToSaveAnswer || ''}
            onChange={handleInputChange}
            placeholder="Ex: nomeUsuario"
            className="mt-1 w-full nodrag"
          />
        </div>

        {nodeData.expectedResponseType === 'quick_reply' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-gray-800">Respostas Rápidas</h4>
                <Button variant="outline" size="sm" onClick={addQuickReply} className="nodrag">
                    <PlusCircle className="w-3 h-3 mr-1" /> Add Resposta
                </Button>
            </div>
            {(nodeData.quickReplies || []).map((reply: QuickReply, index: number) => (
              <div key={reply.id || index} className="flex items-center space-x-2 p-2 border rounded bg-gray-50">
                <Input
                  placeholder="Texto da Resposta"
                  value={reply.text}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleQuickReplyChange(index, 'text', e.target.value)}
                  className="flex-grow nodrag"
                />
                <Input
                  placeholder="Payload (opcional)"
                  value={reply.payload || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleQuickReplyChange(index, 'payload', e.target.value)}
                  className="flex-grow nodrag"
                />
                <Button variant="ghost" size="icon" onClick={() => removeQuickReply(index)} className="nodrag">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {/* Similar UI for listOptions if expectedResponseType is 'list_reply' */}

        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
        <Handle type="source" position={Position.Bottom} id="no-answer" style={{ bottom: -5, background: '#FFA500' }} className="w-3 h-3 rounded-full" />

      </CardContent>
    </Card>
  );
};

export default memo(QuestionNode);
