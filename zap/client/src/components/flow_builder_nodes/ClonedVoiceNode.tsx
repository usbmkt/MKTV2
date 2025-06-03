import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { ClonedVoiceNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Headphones, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
// Supondo que você tenha um Select para voiceId, se não, remova ou adapte
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';


const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const ClonedVoiceNodeComponent: React.FC<ReactFlowNodeProps<ClonedVoiceNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Voz Clonada');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [textToSpeak, setTextToSpeak] = useState<string>(data.textToSpeak || 'Olá, esta é uma mensagem de voz.');
  const [voiceId, setVoiceId] = useState<string>(data.voiceId || 'default_voice'); // ID da voz a ser usada
  const [language, setLanguage] = useState<string>(data.language || 'pt-BR');


  useEffect(() => {
    setLabel(data.label || 'Voz Clonada');
    setTextToSpeak(data.textToSpeak || 'Olá, esta é uma mensagem de voz.');
    setVoiceId(data.voiceId || 'default_voice');
    setLanguage(data.language || 'pt-BR');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<ClonedVoiceNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ClonedVoiceNodeData;
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

  const handleTextToSpeakChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTextToSpeak(e.target.value);
    updateNodePartialData({ textToSpeak: e.target.value });
  };

  const handleVoiceIdChange = (e: ChangeEvent<HTMLInputElement>) => { // ou Select se tiver lista de vozes
    setVoiceId(e.target.value);
    updateNodePartialData({ voiceId: e.target.value });
  };
  
  const handleLanguageChange = (e: ChangeEvent<HTMLInputElement>) => { // ou Select
    setLanguage(e.target.value);
    updateNodePartialData({ language: e.target.value });
  };


  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-72 shadow-md neu-card", selected && "ring-2 ring-green-400 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-green-400/10 dark:bg-green-600/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <Headphones className="h-4 w-4 mr-2 text-green-500 dark:text-green-300" />
                {data.label || 'Voz Clonada'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-green-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`text-to-speak-${id}`} className="text-xs">Texto para Falar</Label>
          <Textarea id={`text-to-speak-${id}`} value={textToSpeak} onChange={handleTextToSpeakChange} placeholder="Digite o texto que será convertido em áudio..." className="mt-1 neu-input" rows={3}/>
        </div>
        <div>
          <Label htmlFor={`voice-id-${id}`} className="text-xs">ID da Voz (Ex: ElevenLabs ID)</Label>
          <Input id={`voice-id-${id}`} value={voiceId} onChange={handleVoiceIdChange} placeholder="ID da voz pré-configurada" className="mt-1 neu-input"/>
        </div>
         <div>
          <Label htmlFor={`language-${id}`} className="text-xs">Idioma (Opcional)</Label>
          <Input id={`language-${id}`} value={language} onChange={handleLanguageChange} placeholder="Ex: pt-BR, en-US" className="mt-1 neu-input"/>
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#4ade80', width: '10px', height: '10px' }} // Cor Verde Claro
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ClonedVoiceNodeComponent);
