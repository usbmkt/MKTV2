import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
import { TriggerNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Zap, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'output', type: 'source', position: Position.Right, label: 'Início do Fluxo', style: { top: '50%' } },
];

const TriggerNodeComponent: React.FC<ReactFlowNodeProps<TriggerNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  
  const [triggerType, setTriggerType] = useState(data.triggerType || 'keyword');
  const [keywords, setKeywords] = useState(data.keywords?.join(', ') || '');
  const [pattern, setPattern] = useState(data.pattern || '');
  const [label, setLabel] = useState(data.label || 'Gatilho');
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  useEffect(() => {
    setTriggerType(data.triggerType || 'keyword');
    setKeywords(data.keywords?.join(', ') || '');
    setPattern(data.pattern || '');
    setLabel(data.label || 'Gatilho');
  }, [data]);

  const updateNodeData = useCallback(
    (newData: Partial<TriggerNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...(node.data as TriggerNodeData), ...newData } };
          }
          return node;
        })
      );
    },
    [id, setNodes] // Adicionado setNodes às dependências
  );

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  const handleLabelSave = () => {
    updateNodeData({ label });
    setIsEditingLabel(false);
  };

  const handleTriggerTypeChange = (value: string) => {
    const newType = value as TriggerNodeData['triggerType'];
    setTriggerType(newType);
    // Ao mudar o tipo, preservamos os valores relevantes se possível
    const currentKeywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k);
    const currentPattern = pattern;
    updateNodeData({ 
        triggerType: newType, 
        keywords: (newType === 'keyword' || newType === 'exact_match') ? currentKeywordsArray : undefined, 
        pattern: newType === 'pattern' ? currentPattern : undefined 
    });
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKeywords = e.target.value;
    setKeywords(newKeywords);
    updateNodeData({ keywords: newKeywords.split(',').map(k => k.trim()).filter(k => k) });
  };

  const handlePatternChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPattern = e.target.value;
    setPattern(newPattern);
    updateNodeData({ pattern: newPattern });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-72 shadow-lg neu-card border-2 border-green-500/50", selected && "ring-2 ring-green-600 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó">
          <Trash2 className="h-4 w-4" />
        </Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-green-500/10 dark:bg-green-700/20 rounded-t-lg">
        {isEditingLabel ? (
          <div className="flex items-center gap-2">
            <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e) => e.key === 'Enter' && handleLabelSave()}/>
            <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
          </div>
        ) : (
          <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
            <Zap className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
            {data.label || 'Gatilho do Fluxo'}
          </CardTitle>
        )}
         <Badge variant="default" className="bg-green-600 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`trigger-type-${id}`} className="text-xs font-medium">Tipo de Gatilho</Label>
          <Select value={triggerType} onValueChange={handleTriggerTypeChange}>
            <SelectTrigger id={`trigger-type-${id}`} className="w-full mt-1 neu-input">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keyword">Palavra-chave (Contém)</SelectItem>
              <SelectItem value="exact_match">Palavra-chave (Exata)</SelectItem>
              <SelectItem value="pattern">Padrão (Regex)</SelectItem>
              <SelectItem value="api_call">Chamada de API</SelectItem>
              <SelectItem value="manual">Início Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(triggerType === 'keyword' || triggerType === 'exact_match') && (
          <div>
            <Label htmlFor={`keywords-${id}`} className="text-xs font-medium">
              {triggerType === 'keyword' ? "Palavras-chave (separadas por vírgula)" : "Frase Exata"}
            </Label>
            <Input
              id={`keywords-${id}`}
              type="text"
              value={keywords}
              onChange={handleKeywordsChange}
              placeholder={triggerType === 'keyword' ? "ex: promoção, ajuda, oi" : "ex: quero meu boleto"}
              className="mt-1 neu-input"
            />
          </div>
        )}

        {triggerType === 'pattern' && (
          <div>
            <Label htmlFor={`pattern-${id}`} className="text-xs font-medium">Padrão Regex</Label>
            <Textarea
              id={`pattern-${id}`}
              value={pattern}
              onChange={handlePatternChange}
              placeholder="ex: ^(pedido|compra)\s#?(\d+)$"
              className="mt-1 neu-input"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">Use para padrões complexos. Cuidado com a sintaxe.</p>
          </div>
        )}
         {triggerType === 'api_call' && (
          <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
            Este fluxo pode ser iniciado por uma chamada de API externa para um endpoint específico.
          </p>
        )}
        {triggerType === 'manual' && (
          <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
            Este fluxo só pode ser iniciado manualmente ou por outro fluxo.
          </p>
        )}
         <p className="text-xs text-muted-foreground pt-2">
            Nota: O gatilho define como o fluxo é iniciado. Apenas um gatilho por fluxo.
          </p>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => ( 
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={handleItem.isConnectable !== undefined ? handleItem.isConnectable : true}
          style={{ ...handleItem.style, background: '#22c55e', width: '12px', height: '12px', borderColor: 'white', borderWidth: '1px' }}
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(TriggerNodeComponent);
