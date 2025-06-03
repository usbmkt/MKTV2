import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { MediaMessageNodeData, FlowNodeType, HandleData, MediaType } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Image as ImageIcon, Video, FileText, Headphones, StickerIcon, Trash2, Edit3, UploadCloud } from 'lucide-react'; // Adicionado UploadCloud
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

const mediaTypeOptions: MediaType[] = ['image', 'video', 'audio', 'document', 'sticker'];

// CORRIGIDO: Tipagem explícita das props
const MediaMessageNodeComponent: React.FC<ReactFlowNodeProps<MediaMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Mensagem de Mídia');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [mediaType, setMediaType] = useState<MediaType>(data.mediaType || 'image');
  const [mediaUrl, setMediaUrl] = useState<string>(data.media?.url || '');
  const [caption, setCaption] = useState<string>(data.media?.caption || '');
  const [fileName, setFileName] = useState<string>(data.media?.fileName || '');
  const [mimeType, setMimeType] = useState<string>(data.media?.mimeType || '');
  // Para upload de arquivo (simulado)
  const [filePreview, setFilePreview] = useState<string | null>(null);


  useEffect(() => {
    setLabel(data.label || 'Mensagem de Mídia');
    setMediaType(data.mediaType || 'image');
    setMediaUrl(data.media?.url || '');
    setCaption(data.media?.caption || '');
    setFileName(data.media?.fileName || '');
    setMimeType(data.media?.mimeType || '');
    if(data.media?.url) setFilePreview(data.media.url); else setFilePreview(null);
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<MediaMessageNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as MediaMessageNodeData;
            // Ao atualizar 'media', garantir que seja o objeto completo
            if (newData.media) {
                return { ...node, data: { ...currentData, ...newData, media: {...currentData.media, ...newData.media} } };
            }
            return { ...node, data: { ...currentData, ...newData } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );
  
  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleLabelSave = () => {
    updateNodePartialData({ label });
    setIsEditingLabel(false);
  };

  const handleMediaTypeChange = (value: string) => {
    const newType = value as MediaType;
    setMediaType(newType);
    updateNodePartialData({ mediaType: newType });
  };

  const handleMediaPropertyChange = (field: keyof MediaMessageNodeData['media'], value: string) => {
    const newMediaData = { ...data.media, [field]: value } as MediaMessageNodeData['media'];
    if (field === 'url') setMediaUrl(value);
    if (field === 'caption') setCaption(value);
    if (field === 'fileName') setFileName(value);
    if (field === 'mimeType') setMimeType(value);
    updateNodePartialData({ media: newMediaData });
  };
  
  // Simulação de upload de arquivo
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
        // Em um cenário real, faria o upload e obteria a URL
        const uploadedUrl = `https://example.com/uploads/${file.name}`; // URL simulada
        setMediaUrl(uploadedUrl);
        setFileName(file.name);
        setMimeType(file.type);
        updateNodePartialData({ 
            media: { 
                url: uploadedUrl, 
                fileName: file.name, 
                mimeType: file.type, 
                caption: caption // manter caption existente ou limpar
            } 
        });
      };
      reader.readAsDataURL(file);
    }
  };


  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  const getMediaIcon = (type: MediaType) => {
    switch(type) {
        case 'image': return <ImageIcon className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
        case 'video': return <Video className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
        case 'audio': return <Headphones className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
        case 'document': return <FileText className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
        case 'sticker': return <StickerIcon className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
        default: return <ImageIcon className="h-4 w-4 mr-2 text-pink-600 dark:text-pink-400" />;
    }
  }

  return (
    <Card className={cn("w-80 shadow-md neu-card", selected && "ring-2 ring-pink-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-pink-500/10 dark:bg-pink-700/20 rounded-t-lg">
        {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                {getMediaIcon(mediaType)}
                {data.label || 'Mensagem de Mídia'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-pink-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`media-type-${id}`} className="text-xs">Tipo de Mídia</Label>
          <Select value={mediaType} onValueChange={handleMediaTypeChange}>
            <SelectTrigger id={`media-type-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              {mediaTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor={`media-url-${id}`} className="text-xs">URL da Mídia *</Label>
          <Input id={`media-url-${id}`} value={mediaUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => handleMediaPropertyChange('url', e.target.value)} placeholder="https://servidor.com/midia.jpg" className="mt-1 neu-input"/>
        </div>
        
        <div className="text-xs text-center my-1">OU</div>

        <div>
            <Label htmlFor={`media-file-upload-${id}`} className="text-xs block mb-1">Upload de Arquivo (Simulado)</Label>
            <Input id={`media-file-upload-${id}`} type="file" onChange={handleFileChange} className="text-xs neu-input file:mr-2 file:py-1 file:px-2 file:rounded-sm file:border-0 file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/80"/>
            {filePreview && mediaType === 'image' && <img src={filePreview} alt="Preview" className="mt-2 max-h-20 rounded"/>}
            {filePreview && mediaType === 'video' && <video src={filePreview} controls className="mt-2 max-h-20 rounded w-full"/>}
             {filePreview && (mediaType === 'audio' || mediaType === 'document' || mediaType === 'sticker') && <p className="text-xs mt-1 text-muted-foreground">Preview não disponível para este tipo.</p>}
        </div>


        {(mediaType === 'image' || mediaType === 'video' || mediaType === 'document') && (
            <div>
                <Label htmlFor={`media-caption-${id}`} className="text-xs">Legenda (Opcional)</Label>
                <Textarea id={`media-caption-${id}`} value={caption} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleMediaPropertyChange('caption', e.target.value)} placeholder="Legenda da mídia" className="mt-1 neu-input" rows={2}/>
            </div>
        )}
        {mediaType === 'document' && (
            <div>
                <Label htmlFor={`media-filename-${id}`} className="text-xs">Nome do Arquivo (Opcional)</Label>
                <Input id={`media-filename-${id}`} value={fileName} onChange={(e: ChangeEvent<HTMLInputElement>) => handleMediaPropertyChange('fileName', e.target.value)} placeholder="documento.pdf" className="mt-1 neu-input"/>
            </div>
        )}
         <div>
            <Label htmlFor={`media-mimetype-${id}`} className="text-xs">MIME Type (Opcional)</Label>
            <Input id={`media-mimetype-${id}`} value={mimeType} onChange={(e: ChangeEvent<HTMLInputElement>) => handleMediaPropertyChange('mimeType', e.target.value)} placeholder="Ex: image/jpeg, application/pdf" className="mt-1 neu-input"/>
        </div>

      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#ec4899', width: '10px', height: '10px' }} // Cor Pink
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(MediaMessageNodeComponent);
