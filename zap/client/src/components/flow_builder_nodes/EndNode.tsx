import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { EndNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { LogOut, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  // Nó final geralmente não tem saída explícita no componente, mas pode ser configurado no HandleData se necessário.
];

// CORRIGIDO: Tipagem explícita das props
const EndNodeComponent: React.FC<ReactFlowNodeProps<EndNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Fim do Fluxo');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [endStateType, setEndStateType] = useState<EndNodeData['endStateType']>(data.endStateType || 'completed');
  const [finalMessage, setFinalMessage] = useState<string>(data.finalMessage || '');


  useEffect(() => {
    setLabel(data.label || 'Fim do Fluxo');
    setEndStateType(data.endStateType || 'completed');
    setFinalMessage(data.finalMessage || '');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<EndNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as EndNodeData;
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
  
  const handleStateTypeChange = (value: string) => {
    const newStateType = value as EndNodeData['endStateType'];
    setEndStateType(newStateType);
    updateNodePartialData({ endStateType: newStateType });
  };

  const handleFinalMessageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFinalMessage(e.target.value);
    updateNodePartialData({ finalMessage: e.target.value });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles.filter(h => h.type === 'target'); // Nó final só tem entrada

  return (
    <Card className={cn("w-64 shadow-md neu-card", selected && "ring-2 ring-slate-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-slate-500/10 dark:bg-slate-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <LogOut className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                {data.label || 'Fim do Fluxo'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-slate-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`end-state-${id}`} className="text-xs">Estado Final</Label>
          <Select value={endStateType} onValueChange={handleStateTypeChange}>
            <SelectTrigger id={`end-state-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="abandoned">Abandonado</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`final-message-${id}`} className="text-xs">Mensagem Final (Opcional)</Label>
          <Input id={`final-message-${id}`} value={finalMessage} onChange={handleFinalMessageChange} placeholder="Ex: Conversa encerrada." className="mt-1 neu-input"/>
        </div>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => ( 
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#64748b', width: '10px', height: '10px' }} 
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(EndNodeComponent);
