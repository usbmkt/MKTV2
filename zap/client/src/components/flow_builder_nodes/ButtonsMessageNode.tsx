import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { ButtonsMessageNodeData, FlowNodeType, HandleData, ButtonMessageItem } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Textarea } from '@zap_client/components/ui/textarea'; // Importado Textarea
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { MousePointerClick, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  // As saídas para botões são geralmente manipuladas como respostas que levam a um próximo nó
  // ou um handle de saída padrão.
  { id: 'output_default', type: 'source', position: Position.Right, label: 'Próximo', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const ButtonsMessageNodeComponent: React.FC<ReactFlowNodeProps<ButtonsMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais
  const [label, setLabel] = useState<string>(data.label || 'Mensagem com Botões');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [headerText, setHeaderText] = useState<string>(data.headerText || '');
  const [bodyText, setBodyText] = useState<string>(data.bodyText || 'Escolha uma opção:');
  const [footerText, setFooterText] = useState<string>(data.footerText || '');
  const [buttons, setButtons] = useState<ButtonMessageItem[]>(data.buttons || [{ id: Date.now().toString(), type: 'reply', title: 'Opção 1' }]);
  const [variableToStoreReply, setVariableToStoreReply] = useState<string>(data.variableToStoreReply || '');

  useEffect(() => {
    setLabel(data.label || 'Mensagem com Botões');
    setHeaderText(data.headerText || '');
    setBodyText(data.bodyText || 'Escolha uma opção:');
    setFooterText(data.footerText || '');
    setButtons(data.buttons || [{ id: Date.now().toString(), type: 'reply', title: 'Opção 1' }]);
    setVariableToStoreReply(data.variableToStoreReply || '');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<ButtonsMessageNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ButtonsMessageNodeData;
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

  const handleGenericInputChange = (field: keyof ButtonsMessageNodeData, value: string) => {
    // @ts-ignore - Permitir atribuição
    updateNodePartialData({ [field]: value });
    if (field === 'headerText') setHeaderText(value);
    if (field === 'bodyText') setBodyText(value);
    if (field === 'footerText') setFooterText(value);
    if (field === 'variableToStoreReply') setVariableToStoreReply(value);
  };
  
  const handleButtonChange = (index: number, field: keyof ButtonMessageItem, value: string) => {
    const newButtons = [...buttons];
    (newButtons[index] as any)[field] = value; // Simples para título, url, phoneNumber
    if (field === 'type') { // Resetar campos irrelevantes ao mudar o tipo
        if (value !== 'url') delete newButtons[index].url;
        if (value !== 'call') delete newButtons[index].phoneNumber;
    }
    setButtons(newButtons);
    updateNodePartialData({ buttons: newButtons });
  };

  const addButton = () => {
    if (buttons.length < 3) { // Limite do WhatsApp para botões de resposta rápida
      const newButton: ButtonMessageItem = { id: `btn-${Date.now()}`, type: 'reply', title: `Botão ${buttons.length + 1}` };
      const newButtons = [...buttons, newButton];
      setButtons(newButtons);
      updateNodePartialData({ buttons: newButtons });
    } else {
      alert("Máximo de 3 botões permitido.");
    }
  };

  const removeButton = (indexToRemove: number) => {
    const newButtons = buttons.filter((_: ButtonMessageItem, index: number) => index !== indexToRemove);
    setButtons(newButtons);
    updateNodePartialData({ buttons: newButtons });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-80 shadow-md neu-card", selected && "ring-2 ring-orange-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-orange-500/10 dark:bg-orange-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <MousePointerClick className="h-4 w-4 mr-2 text-orange-600 dark:text-orange-400" />
                {data.label || 'Mensagem com Botões'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-orange-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-96">
        <ScrollArea className="h-80 pr-3">
            <div><Label htmlFor={`header-text-${id}`} className="text-xs">Texto do Cabeçalho (Opcional)</Label><Input id={`header-text-${id}`} value={headerText} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('headerText', e.target.value)} placeholder="Cabeçalho da mensagem" className="mt-1 neu-input"/></div>
            <div><Label htmlFor={`body-text-${id}`} className="text-xs">Texto do Corpo *</Label><Textarea id={`body-text-${id}`} value={bodyText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleGenericInputChange('bodyText', e.target.value)} placeholder="Corpo da mensagem" className="mt-1 neu-input" rows={3}/></div>
            <div><Label htmlFor={`footer-text-${id}`} className="text-xs">Texto do Rodapé (Opcional)</Label><Input id={`footer-text-${id}`} value={footerText} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('footerText', e.target.value)} placeholder="Rodapé da mensagem" className="mt-1 neu-input"/></div>

            <div className="space-y-2 border-t pt-2 mt-2">
                <Label className="text-xs">Botões (Máx. 3)</Label>
                {buttons.map((button, index) => (
                <Card key={button.id || index} className="p-2 neu-card-inset space-y-1">
                    <div className="flex items-center gap-2">
                        <Input value={button.title} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(index, 'title', e.target.value)} placeholder={`Texto Botão ${index + 1}`} className="neu-input text-xs h-8 flex-grow"/>
                        <Button variant="ghost" size="icon" onClick={() => removeButton(index)} className="h-8 w-8 text-destructive"><XCircle className="h-4 w-4"/></Button>
                    </div>
                    <Select value={button.type} onValueChange={(value: string) => handleButtonChange(index, 'type', value as ButtonMessageItem['type'])}>
                        <SelectTrigger className="neu-input text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="reply">Resposta Rápida</SelectItem>
                            <SelectItem value="url">Link (URL)</SelectItem>
                            <SelectItem value="call">Ligar (Telefone)</SelectItem>
                        </SelectContent>
                    </Select>
                    {button.type === 'url' && <Input value={button.url || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(index, 'url', e.target.value)} placeholder="https://exemplo.com" className="mt-1 neu-input text-xs h-8"/>}
                    {button.type === 'call' && <Input value={button.phoneNumber || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(index, 'phoneNumber', e.target.value)} placeholder="+5511999998888" className="mt-1 neu-input text-xs h-8"/>}
                </Card>
                ))}
                {buttons.length < 3 && 
                    <Button variant="outline" size="sm" onClick={addButton} className="mt-1 text-xs"><PlusCircle className="h-3 w-3 mr-1"/> Adicionar Botão</Button>
                }
            </div>
            <div><Label htmlFor={`button-variable-${id}`} className="text-xs">Salvar Resposta na Variável (Opcional)</Label><Input id={`button-variable-${id}`} value={variableToStoreReply} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('variableToStoreReply', e.target.value)} placeholder="Ex: acao_usuario" className="mt-1 neu-input"/></div>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#f97316', width: '10px', height: '10px' }} // Cor Laranja
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ButtonsMessageNodeComponent);
