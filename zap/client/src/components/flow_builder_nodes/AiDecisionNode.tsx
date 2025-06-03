import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { GptQueryNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { CloudCog, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const GptQueryNodeComponent: React.FC<ReactFlowNodeProps<GptQueryNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Consulta GPT');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>(data.prompt || 'Resuma o seguinte texto: {{input}}');
  const [model, setModel] = useState<string>(data.model || 'gemini-1.5-flash-latest'); // Ou gpt-3.5-turbo etc.
  const [temperature, setTemperature] = useState<number>(data.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState<number>(data.maxTokens ?? 256);
  const [variableToStoreResponse, setVariableToStoreResponse] = useState<string>(data.variableToStoreResponse || 'gpt_response');

  useEffect(() => {
    setLabel(data.label || 'Consulta GPT');
    setPrompt(data.prompt || 'Resuma o seguinte texto: {{input}}');
    setModel(data.model || 'gemini-1.5-flash-latest');
    setTemperature(data.temperature ?? 0.7);
    setMaxTokens(data.maxTokens ?? 256);
    setVariableToStoreResponse(data.variableToStoreResponse || 'gpt_response');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<GptQueryNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as GptQueryNodeData;
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

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    updateNodePartialData({ prompt: e.target.value });
  };
  
  const handleModelChange = (e: ChangeEvent<HTMLInputElement>) => {
    setModel(e.target.value);
    updateNodePartialData({ model: e.target.value });
  };

  const handleTemperatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTemperature(isNaN(value) ? 0.7 : Math.max(0, Math.min(2, value))); // Clamp temperature
    updateNodePartialData({ temperature: isNaN(value) ? 0.7 : Math.max(0, Math.min(2, value)) });
  };

  const handleMaxTokensChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setMaxTokens(isNaN(value) ? 256 : value);
    updateNodePartialData({ maxTokens: isNaN(value) ? 256 : value });
  };
  
  const handleVariableChange = (e: ChangeEvent<HTMLInputElement>) => {
    setVariableToStoreResponse(e.target.value);
    updateNodePartialData({ variableToStoreResponse: e.target.value });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-80 shadow-md neu-card", selected && "ring-2 ring-blue-600 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-blue-500/10 dark:bg-blue-700/20 rounded-t-lg">
        {isEditingLabel ? (
          <div className="flex items-center gap-2">
            <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
            <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
          </div>
        ) : (
          <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
            <CloudCog className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            {data.label || 'Consulta GPT'}
          </CardTitle>
        )}
        <Badge variant="default" className="bg-blue-600 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`prompt-${id}`} className="text-xs">Prompt (Template)</Label>
          <Textarea id={`prompt-${id}`} value={prompt} onChange={handlePromptChange} placeholder="Ex: Resuma o seguinte: {{texto_usuario}}" className="mt-1 neu-input" rows={3}/>
          <p className="text-xs text-muted-foreground mt-1">Use {"{{variavel}}"} para inserir variáveis.</p>
        </div>
        <div>
          <Label htmlFor={`model-${id}`} className="text-xs">Modelo IA (Opcional)</Label>
          <Input id={`model-${id}`} value={model} onChange={handleModelChange} placeholder="Ex: gemini-1.5-flash-latest" className="mt-1 neu-input"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div>
                <Label htmlFor={`temperature-${id}`} className="text-xs">Temperatura</Label>
                <Input id={`temperature-${id}`} type="number" value={temperature} onChange={handleTemperatureChange} step="0.1" min="0" max="2" className="mt-1 neu-input"/>
            </div>
            <div>
                <Label htmlFor={`max-tokens-${id}`} className="text-xs">Max Tokens</Label>
                <Input id={`max-tokens-${id}`} type="number" value={maxTokens} onChange={handleMaxTokensChange} step="1" min="1" className="mt-1 neu-input"/>
            </div>
        </div>
        <div>
          <Label htmlFor={`variable-store-${id}`} className="text-xs">Salvar Resposta na Variável *</Label>
          <Input id={`variable-store-${id}`} value={variableToStoreResponse} onChange={handleVariableChange} placeholder="Ex: resposta_gpt" className="mt-1 neu-input"/>
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#2563eb', width: '10px', height: '10px' }} // Cor Blue
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(GptQueryNodeComponent);
