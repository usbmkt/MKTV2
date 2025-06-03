// zap/client/src/components/flow_builder_nodes/ClonedVoiceNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Input } from '@zap_client/components/ui/input';
import { MicVocal } from 'lucide-react'; // Ícone alterado para algo mais genérico de voz
import { ClonedVoiceNodeData } from '@zap_client/features/types/whatsapp_flow_types';

const ClonedVoiceNode: React.FC<NodeProps<ClonedVoiceNodeData>> = ({ data, id, selected }) => {
  const { 
    label = 'Voz Clonada', 
    textToSpeak = '', 
    voiceId = '' 
  } = data;

  // Lógica para atualizar 'data'
  // const updateData = (field: keyof ClonedVoiceNodeData, value: any) => { ... };

  return (
    <Card className={`text-xs shadow-md w-72 ${selected ? 'ring-2 ring-pink-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <MicVocal className="w-4 h-4 text-pink-500 mr-2" />
          {label || 'Áudio com Voz Clonada'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label htmlFor={`textToSpeak-${id}`} className="text-xs font-medium">Texto para Falar</Label>
          <Textarea
            id={`textToSpeak-${id}`}
            placeholder="Digite o texto que a voz clonada deve falar..."
            value={textToSpeak}
            // onChange={(e) => updateData('textToSpeak', e.target.value)}
            rows={4}
            className="w-full text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`voiceId-${id}`} className="text-xs font-medium">ID da Voz (Ex: ElevenLabs)</Label>
          <Input
            id={`voiceId-${id}`}
            type="text"
            placeholder="ID da voz clonada"
            value={voiceId}
            // onChange={(e) => updateData('voiceId', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-[10px] truncate">
          Serviço de TTS: {voiceId ? 'ElevenLabs (Configurado)' : 'Não configurado'}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2.5 h-2.5" />
    </Card>
  );
};

export default memo(ClonedVoiceNode);
