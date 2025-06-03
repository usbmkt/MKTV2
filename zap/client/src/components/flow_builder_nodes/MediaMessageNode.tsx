// zap/client/src/components/flow_builder_nodes/MediaMessageNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Image as ImageIcon, Video, FileText, Mic } from 'lucide-react'; // Usando Mic para áudio
import { MediaMessageNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const MediaMessageNode: React.FC<NodeProps<MediaMessageNodeData>> = ({ data, id, selected }) => {
  const {
    label = 'Mensagem de Mídia',
    mediaType = 'image',
    mediaUrl = '',
    caption = '',
    fileName = '' // Para documentos
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof MediaMessageNodeData, value: any) => { /* ... */ };

  const getIcon = () => {
    switch (mediaType) {
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500 mr-2" />;
      case 'video': return <Video className="w-4 h-4 text-red-500 mr-2" />;
      case 'audio': return <Mic className="w-4 h-4 text-blue-500 mr-2" />;
      case 'document': return <FileText className="w-4 h-4 text-green-500 mr-2" />;
      default: return <ImageIcon className="w-4 h-4 text-gray-500 mr-2" />;
    }
  };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-purple-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          {getIcon()}
          {label || `Mídia: ${mediaType}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`mediaType-${id}`} className="text-xs font-medium">Tipo de Mídia</Label>
          <Select
            value={mediaType}
            // onValueChange={(value) => updateData('mediaType', value as MediaMessageNodeData['mediaType'])}
          >
            <SelectTrigger id={`mediaType-${id}`} className="w-full h-8 text-xs">
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
          <Label htmlFor={`mediaUrl-${id}`} className="text-xs font-medium">URL da Mídia*</Label>
          <Input
            id={`mediaUrl-${id}`}
            type="text"
            placeholder="https://servidor.com/arquivo.jpg"
            value={mediaUrl}
            // onChange={(e) => updateData('mediaUrl', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        {mediaType === 'document' && (
          <div>
            <Label htmlFor={`fileName-${id}`} className="text-xs font-medium">Nome do Arquivo (Documento)</Label>
            <Input
              id={`fileName-${id}`}
              type="text"
              placeholder="Ex: proposta.pdf"
              value={fileName}
              // onChange={(e) => updateData('fileName', e.target.value)}
              className="w-full h-8 text-xs"
            />
          </div>
        )}
        {(mediaType === 'image' || mediaType === 'video' || mediaType === 'document') && (
          <div>
            <Label htmlFor={`caption-${id}`} className="text-xs font-medium">Legenda (Opcional)</Label>
            <Textarea
              id={`caption-${id}`}
              placeholder="Legenda da mídia..."
              value={caption}
              // onChange={(e) => updateData('caption', e.target.value)}
              rows={2}
              className="w-full text-xs"
            />
          </div>
        )}
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(MediaMessageNode);
