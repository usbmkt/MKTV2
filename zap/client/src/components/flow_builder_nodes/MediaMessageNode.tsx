import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { GripVertical, Paperclip } from 'lucide-react';
import { MediaMessageNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const MediaMessageNode: React.FC<NodeProps<MediaMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<MediaMessageNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<MediaMessageNodeData>) => {
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

  const handleSelectChange = (name: keyof MediaMessageNodeData, value: string) => {
    updateNodeData({ [name]: value as MediaMessageNodeData['mediaType'] });
  };

  return (
    <Card className={`w-80 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Paperclip className="w-4 h-4 mr-2 text-gray-600" />
          <CardTitle className="text-sm font-medium">{nodeData.label || 'Mensagem de Mídia'}</CardTitle>
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
            placeholder="Ex: Enviar Imagem Produto"
            className="mt-1 w-full nodrag"
          />
        </div>
        <div>
          <Label htmlFor={`mediaType-${id}`} className="text-xs font-medium">Tipo de Mídia</Label>
          <Select
            name="mediaType"
            value={nodeData.mediaType || ''}
            onValueChange={(value) => handleSelectChange('mediaType', value)}
          >
            <SelectTrigger id={`mediaType-${id}`} className="w-full mt-1 nodrag">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="document">Documento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`mediaUrl-${id}`} className="text-xs font-medium">URL da Mídia</Label>
          <Input
            id={`mediaUrl-${id}`}
            name="mediaUrl"
            value={nodeData.mediaUrl || ''}
            onChange={handleInputChange}
            placeholder="https://exemplo.com/midia.jpg"
            className="mt-1 w-full nodrag"
          />
        </div>
        {nodeData.mediaType === 'document' && (
          <div>
            <Label htmlFor={`fileName-${id}`} className="text-xs font-medium">Nome do Arquivo (para Documento)</Label>
            <Input
              id={`fileName-${id}`}
              name="fileName"
              value={nodeData.fileName || ''}
              onChange={handleInputChange}
              placeholder="Ex: catalogo.pdf"
              className="mt-1 w-full nodrag"
            />
          </div>
        )}
        {(nodeData.mediaType === 'image' || nodeData.mediaType === 'video') && (
          <div>
            <Label htmlFor={`caption-${id}`} className="text-xs font-medium">Legenda (para Imagem/Vídeo)</Label>
            <Input
              id={`caption-${id}`}
              name="caption"
              value={nodeData.caption || ''}
              onChange={handleInputChange}
              placeholder="Descrição da mídia"
              className="mt-1 w-full nodrag"
            />
          </div>
        )}
         <div>
          <Label htmlFor={`mimeType-${id}`} className="text-xs font-medium">MIME Type (opcional)</Label>
          <Input
            id={`mimeType-${id}`}
            name="mimeType"
            value={nodeData.mimeType || ''}
            onChange={handleInputChange}
            placeholder="Ex: image/png, application/pdf"
            className="mt-1 w-full nodrag"
          />
        </div>
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
      </CardContent>
    </Card>
  );
};

export default memo(MediaMessageNode);
