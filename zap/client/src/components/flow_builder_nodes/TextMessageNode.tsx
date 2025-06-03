import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases para @zap_client
import { TextMessageNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input'; 
import { MessageSquareText, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';


const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: { top: '50%' } },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: { top: '50%' } },
];

const TextMessageNodeComponent: React.FC<ReactFlowNodeProps<TextMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [message, setMessage] = useState<string>(data.message || '');
  const [label, setLabel] = useState<string>(data.label || 'Mensagem de Texto');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);

  useEffect(() => {
    setMessage(data.message || '');
    setLabel(data.label || 'Mensagem de Texto');
  }, [data]);

  const updateNodeDataCallback = useCallback(
    (newData: Partial<TextMessageNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as TextMessageNodeData;
            return { ...node, data: { ...currentData, ...newData } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = event.target.value;
    setMessage(newMessage);
    updateNodeDataCallback({ message: newMessage });
  };
  
  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  const handleLabelSave = () => {
    updateNodeDataCallback({ label });
    setIsEditingLabel(false);
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-64 shadow-md neu-card", selected && "ring-2 ring-sky-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó">
          <Trash2 className="h-4 w-4" />
        </Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-sky-500/10 dark:bg-sky-700/20 rounded-t-lg">
        {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <MessageSquareText className="h-4 w-4 mr-2 text-sky-600 dark:text-sky-400" />
                {data.label || 'Mensagem Texto'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-sky-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-2">
          <Label htmlFor={`text-message-content-${id}`} className="text-xs sr-only">
            Conteúdo da Mensagem:
          </Label>
          <Textarea
            id={`text-message-content-${id}`}
            value={message}
            onChange={handleMessageChange}
            placeholder="Digite sua mensagem aqui... Use {{variavel}} para variáveis."
            className="text-xs min-h-[80px] neu-input"
            rows={3}
          />
          {/* CORRIGIDO: Sintaxe JSX para exibir o texto corretamente */}
          <p className="text-xs text-muted-foreground">
            Use <code>{"{{variavel}}"}</code> para inserir variáveis.
          </p>
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={handleItem.isConnectable !== undefined ? handleItem.isConnectable : true}
          style={{ ...handleItem.style, background: '#38bdf8', width: '10px', height: '10px' }}
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(TextMessageNodeComponent);
