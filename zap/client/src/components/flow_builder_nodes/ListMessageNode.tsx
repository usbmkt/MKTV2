// zap/client/src/components/flow_builder_nodes/ListMessageNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { ListChecks, PlusCircle, Trash2 } from 'lucide-react';
import { ListMessageNodeDataFE, ListSectionData, ListItemData } from '@zap_client/features/types/whatsapp_flow_types';

const ListMessageNode: React.FC<NodeProps<ListMessageNodeDataFE>> = ({ data, id, selected }) => {
  const {
    label = 'Mensagem de Lista',
    headerText = '',
    bodyText = '',
    footerText = '',
    buttonText = 'Ver Opções',
    sections = [{ title: 'Seção 1', rows: [{ id: 'item1', title: 'Item 1', description: '' }] }]
  } = data;

  // Lógica para atualizar 'data' (ex: via onNodesChange)
  // const updateData = (field: keyof ListMessageNodeDataFE, value: any) => { /* ... */ };
  // const addSection = () => { /* ... */ };
  // const updateSectionTitle = (sectionIndex: number, title: string) => { /* ... */ };
  // const removeSection = (sectionIndex: number) => { /* ... */ };
  // const addItemToSection = (sectionIndex: number) => { /* ... */ };
  // const updateItem = (sectionIndex: number, itemIndex: number, field: keyof ListItemData, value: string) => { /* ... */ };
  // const removeItem = (sectionIndex: number, itemIndex: number) => { /* ... */ };

  return (
    <Card className={`text-xs shadow-md w-80 ${selected ? 'ring-2 ring-green-500' : 'border-border'} bg-card`}>
      <CardHeader className="bg-muted/50 p-2 rounded-t-lg">
        <CardTitle className="text-xs font-semibold flex items-center">
          <ListChecks className="w-4 h-4 text-green-500 mr-2" />
          {label || 'Mensagem de Lista Interativa'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2 max-h-96 overflow-y-auto">
        <div>
          <Label htmlFor={`headerText-${id}`} className="text-xs font-medium">Texto do Cabeçalho (Opcional)</Label>
          <Input
            id={`headerText-${id}`}
            type="text"
            placeholder="Título principal da lista"
            value={headerText}
            // onChange={(e) => updateData('headerText', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`bodyText-${id}`} className="text-xs font-medium">Texto do Corpo*</Label>
          <Textarea
            id={`bodyText-${id}`}
            placeholder="Corpo da mensagem da lista"
            value={bodyText}
            // onChange={(e) => updateData('bodyText', e.target.value)}
            rows={2}
            className="w-full text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`footerText-${id}`} className="text-xs font-medium">Texto do Rodapé (Opcional)</Label>
          <Input
            id={`footerText-${id}`}
            type="text"
            placeholder="Rodapé da lista"
            value={footerText}
            // onChange={(e) => updateData('footerText', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`buttonText-${id}`} className="text-xs font-medium">Texto do Botão de Abertura*</Label>
          <Input
            id={`buttonText-${id}`}
            type="text"
            placeholder="Ex: Ver Opções"
            value={buttonText}
            // onChange={(e) => updateData('buttonText', e.target.value)}
            className="w-full h-8 text-xs"
          />
        </div>

        {(sections || []).map((section, sectionIndex) => (
          <div key={`section-${sectionIndex}`} className="mt-2 p-2 border rounded border-dashed">
            <div className="flex justify-between items-center mb-1">
              <Input
                type="text"
                placeholder={`Título Seção ${sectionIndex + 1}`}
                value={section.title}
                // onChange={(e) => updateSectionTitle(sectionIndex, e.target.value)}
                className="w-full h-7 text-xs font-semibold"
              />
              {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSection(sectionIndex)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button> */}
            </div>
            {(section.rows || []).map((item, itemIndex) => (
              <div key={item.id || `item-${sectionIndex}-${itemIndex}`} className="ml-2 mt-1 space-y-1">
                <Input
                  type="text"
                  placeholder={`Título Item ${itemIndex + 1}`}
                  value={item.title}
                  // onChange={(e) => updateItem(sectionIndex, itemIndex, 'title', e.target.value)}
                  className="w-full h-7 text-xs"
                />
                <Input
                  type="text"
                  placeholder="Descrição (Opcional)"
                  value={item.description || ''}
                  // onChange={(e) => updateItem(sectionIndex, itemIndex, 'description', e.target.value)}
                  className="w-full h-7 text-xs"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    id={`${id}-section-${sectionIndex}-item-${item.id || itemIndex}`}
                    style={{ top: 'auto', bottom: 'auto', background: '#555' }} // Ajustar posicionamento conforme necessário
                    className="w-2 h-2"
                />
                 {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(sectionIndex, itemIndex)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                 </Button> */}
              </div>
            ))}
            {/* <Button variant="outline" size="xs" className="text-xs mt-1 w-full h-6" onClick={() => addItemToSection(sectionIndex)}>
              <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Item à Seção
            </Button> */}
          </div>
        ))}
        {/* <Button variant="outline" size="sm" className="text-xs mt-2 w-full h-7" onClick={addSection}>
          <PlusCircle className="w-3.5 h-3.5 mr-1" /> Adicionar Seção
        </Button> */}
      </CardContent>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground w-2.5 h-2.5" />
      {/* Os handles de saída são por item da lista */}
    </Card>
  );
};

export default memo(ListMessageNode);
