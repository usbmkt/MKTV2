import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { ListMessageNodeData, FlowNodeType, HandleData, ListMessageSection, ListMessageItem } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Textarea } from '@zap_client/components/ui/textarea';
import { ListChecks, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area'; // Adicionado ScrollArea

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  // Saídas podem ser dinâmicas baseadas nas seleções da lista, ou uma saída padrão
  { id: 'output_default', type: 'source', position: Position.Right, label: 'Após Seleção', style: {top: '50%'} },
];

// CORRIGIDO: Tipagem explícita das props
const ListMessageNodeComponent: React.FC<ReactFlowNodeProps<ListMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  // Estados locais baseados em `data`
  const [label, setLabel] = useState<string>(data.label || 'Mensagem de Lista');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [titleText, setTitleText] = useState<string>(data.titleText || '');
  const [bodyText, setBodyText] = useState<string>(data.bodyText || 'Selecione uma das opções:');
  const [buttonText, setButtonText] = useState<string>(data.buttonText || 'Ver Opções');
  const [sections, setSections] = useState<ListMessageSection[]>(data.sections || [{ id: Date.now().toString(), title: 'Seção Principal', rows: [{ id: (Date.now()+1).toString(), title: 'Item 1' }] }]);
  const [footerText, setFooterText] = useState<string>(data.footerText || '');
  const [variableToStoreSelection, setVariableToStoreSelection] = useState<string>(data.variableToStoreSelection || '');


  useEffect(() => {
    setLabel(data.label || 'Mensagem de Lista');
    setTitleText(data.titleText || '');
    setBodyText(data.bodyText || 'Selecione uma das opções:');
    setButtonText(data.buttonText || 'Ver Opções');
    setSections(data.sections || [{ id: Date.now().toString(), title: 'Seção Principal', rows: [{ id: (Date.now()+1).toString(), title: 'Item 1' }] }]);
    setFooterText(data.footerText || '');
    setVariableToStoreSelection(data.variableToStoreSelection || '');
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<ListMessageNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ListMessageNodeData;
            return { ...node, data: { ...currentData, ...newData } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );

  const handleGenericChange = (field: keyof ListMessageNodeData, value: string) => {
    // @ts-ignore - Permitir atribuição para campos específicos
    updateNodePartialData({ [field]: value });
    if (field === 'titleText') setTitleText(value);
    if (field === 'bodyText') setBodyText(value);
    if (field === 'buttonText') setButtonText(value);
    if (field === 'footerText') setFooterText(value);
    if (field === 'variableToStoreSelection') setVariableToStoreSelection(value);
  };

  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleLabelSave = () => {
    updateNodePartialData({ label });
    setIsEditingLabel(false);
  };

  // Seção e Item Handlers
  const handleSectionTitleChange = (sectionIndex: number, title: string) => {
    const newSections = [...sections];
    newSections[sectionIndex].title = title;
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };
  const addSection = () => {
    const newSectionId = `section-${Date.now()}`;
    const newSections = [...sections, { id: newSectionId, title: `Nova Seção ${sections.length + 1}`, rows: [{ id: `item-${Date.now()}`, title: 'Novo Item 1' }] }];
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };
  const removeSection = (sectionIndex: number) => {
    if (sections.length <= 1) {
        alert("Deve haver pelo menos uma seção.");
        return;
    }
    const newSections = sections.filter((_: ListMessageSection, i: number) => i !== sectionIndex);
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };

  const handleItemChange = (sectionIndex: number, rowIndex: number, field: keyof ListMessageItem, value: string) => {
    const newSections = [...sections];
    const targetSection = { ...newSections[sectionIndex] };
    const targetRow = { ...targetSection.rows[rowIndex] };
    (targetRow as any)[field] = value; // Simples para label e value
    targetSection.rows[rowIndex] = targetRow;
    newSections[sectionIndex] = targetSection;
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };
  const addItemToSection = (sectionIndex: number) => {
    const newSections = [...sections];
    const targetSection = { ...newSections[sectionIndex] };
    targetSection.rows = [...targetSection.rows, { id: `item-${Date.now()}`, title: `Novo Item ${targetSection.rows.length + 1}` }];
    newSections[sectionIndex] = targetSection;
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };
  const removeItemFromSection = (sectionIndex: number, rowIndex: number) => {
    const newSections = [...sections];
    const targetSection = { ...newSections[sectionIndex] };
    if (targetSection.rows.length <= 1 && sections.length <= 1) {
        alert("Deve haver pelo menos um item em uma seção, e pelo menos uma seção.");
        return;
    }
     if (targetSection.rows.length <= 1 && sections.length > 1) { // Se for o último item da seção e houver outras seções, remove a seção
        removeSection(sectionIndex);
        return;
    }
    targetSection.rows = targetSection.rows.filter((_: ListMessageItem, i: number) => i !== rowIndex);
    newSections[sectionIndex] = targetSection;
    setSections(newSections);
    updateNodePartialData({ sections: newSections });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  // Os handles de saída para cada item da lista seriam gerenciados pelo React Flow conectando-se a partir do nó.
  // Para fins de UI, podemos apenas ter um handle de saída padrão.
  const handlesToRender = data.handles || defaultHandles;


  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-teal-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-teal-500/10 dark:bg-teal-700/20 rounded-t-lg">
        {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <ListChecks className="h-4 w-4 mr-2 text-teal-600 dark:text-teal-400" />
                {data.label || 'Mensagem de Lista'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-teal-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-96"> {/* Adicionado max-h e overflow-y-auto */}
        <ScrollArea className="h-80 pr-3"> {/* ScrollArea para o conteúdo configurável */}
            <div><Label htmlFor={`list-title-${id}`} className="text-xs">Título da Lista (Opcional)</Label><Input id={`list-title-${id}`} value={titleText} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericChange('titleText', e.target.value)} placeholder="Título que aparece acima da lista" className="mt-1 neu-input"/></div>
            <div><Label htmlFor={`list-body-${id}`} className="text-xs">Texto do Corpo *</Label><Textarea id={`list-body-${id}`} value={bodyText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleGenericChange('bodyText', e.target.value)} placeholder="Corpo da mensagem da lista" className="mt-1 neu-input" rows={2}/></div>
            <div><Label htmlFor={`list-button-${id}`} className="text-xs">Texto do Botão da Lista *</Label><Input id={`list-button-${id}`} value={buttonText} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericChange('buttonText', e.target.value)} placeholder="Ex: Ver Opções" className="mt-1 neu-input"/></div>
            
            <div className="space-y-2 border-t pt-2 mt-2">
                <div className="flex justify-between items-center">
                    <Label className="text-xs">Seções e Itens</Label>
                    <Button variant="outline" size="xs" onClick={addSection} className="text-xs"><PlusCircle className="h-3 w-3 mr-1"/> Add Seção</Button>
                </div>
                {sections.map((section, sectionIndex) => (
                    <Card key={section.id || sectionIndex} className="p-2 neu-card-inset space-y-1">
                        <div className="flex items-center gap-2">
                            <Input value={section.title} onChange={(e: ChangeEvent<HTMLInputElement>) => handleSectionTitleChange(sectionIndex, e.target.value)} placeholder={`Título Seção ${sectionIndex + 1}`} className="neu-input text-xs h-7 flex-grow"/>
                            {sections.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeSection(sectionIndex)} className="h-7 w-7 text-destructive"><XCircle className="h-4 w-4"/></Button>}
                        </div>
                        {section.rows.map((row, rowIndex) => (
                             <div key={row.id || rowIndex} className="flex items-center gap-1 pl-2">
                                <Input value={row.title} onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(sectionIndex, rowIndex, 'title', e.target.value)} placeholder={`Item ${rowIndex + 1} Título`} className="neu-input text-xs h-7 flex-grow"/>
                                <Input value={row.description || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(sectionIndex, rowIndex, 'description', e.target.value)} placeholder="Descrição (Opcional)" className="neu-input text-xs h-7 flex-grow"/>
                                <Button variant="ghost" size="icon" onClick={() => removeItemFromSection(sectionIndex, rowIndex)} className="h-7 w-7 text-destructive"><XCircle className="h-3 w-3"/></Button>
                             </div>
                        ))}
                        <Button variant="link" size="xs" onClick={() => addItemToSection(sectionIndex)} className="text-xs mt-1"><PlusCircle className="h-3 w-3 mr-1"/> Add Item à Seção</Button>
                    </Card>
                ))}
            </div>

            <div><Label htmlFor={`list-footer-${id}`} className="text-xs">Rodapé (Opcional)</Label><Input id={`list-footer-${id}`} value={footerText} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericChange('footerText', e.target.value)} placeholder="Texto de rodapé" className="mt-1 neu-input"/></div>
            <div><Label htmlFor={`list-variable-${id}`} className="text-xs">Salvar Seleção na Variável (Opcional)</Label><Input id={`list-variable-${id}`} value={variableToStoreSelection} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericChange('variableToStoreSelection', e.target.value)} placeholder="Ex: produto_escolhido" className="mt-1 neu-input"/></div>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#14b8a6', width: '10px', height: '10px' }} // Cor Teal
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ListMessageNodeComponent);
