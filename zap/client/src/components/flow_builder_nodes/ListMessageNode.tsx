import React, { memo, useState, ChangeEvent, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, Node } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Button } from '@zap_client/components/ui/button';
import { Textarea } from '@zap_client/components/ui/textarea';
import { GripVertical, PlusCircle, Trash2 } from 'lucide-react';
import { ListMessageNodeData, ListSection, ListItem } from '@zap_client/features/types/whatsapp_flow_types'; // Ajustado o import

const ListMessageNode: React.FC<NodeProps<ListMessageNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [nodeData, setNodeData] = useState<ListMessageNodeData>(data);

  const updateNodeData = useCallback((newData: Partial<ListMessageNodeData>) => {
    setNodes((nds) =>
      nds.map((node: Node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
        }
        return node;
      })
    );
    setNodeData(prev => ({ ...prev, ...newData }));
  }, [id, setNodes]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateNodeData({ [name]: value });
  };

  const handleSectionTitleChange = (sectionIndex: number, value: string) => {
    const newSections = [...(nodeData.sections || [])];
    newSections[sectionIndex] = { ...newSections[sectionIndex], title: value };
    updateNodeData({ sections: newSections });
  };

  const handleItemChange = (sectionIndex: number, itemIndex: number, field: keyof ListItem, value: string) => {
    const newSections = [...(nodeData.sections || [])];
    if (newSections[sectionIndex] && newSections[sectionIndex].rows[itemIndex]) {
      (newSections[sectionIndex].rows[itemIndex] as any)[field] = value; // Usar 'as any' temporariamente se ListItem for complexo
      updateNodeData({ sections: newSections });
    }
  };

  const addSection = () => {
    const newSection: ListSection = { title: 'Nova Seção', rows: [{ id: `item-${Date.now()}`, title: 'Novo Item', description: '' }] };
    updateNodeData({ sections: [...(nodeData.sections || []), newSection] });
  };

  const removeSection = (sectionIndex: number) => {
    const newSections = (nodeData.sections || []).filter((_, index) => index !== sectionIndex);
    updateNodeData({ sections: newSections });
  };

  const addItemToSection = (sectionIndex: number) => {
    const newSections = [...(nodeData.sections || [])];
    if (newSections[sectionIndex]) {
      newSections[sectionIndex].rows.push({ id: `item-${Date.now()}`, title: 'Novo Item', description: '' });
      updateNodeData({ sections: newSections });
    }
  };

  const removeItemFromSection = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...(nodeData.sections || [])];
    if (newSections[sectionIndex]) {
      newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter((_, index) => index !== itemIndex);
      updateNodeData({ sections: newSections });
    }
  };


  return (
    <Card className={`w-80 shadow-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="bg-gray-100 p-4 rounded-t-lg flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Mensagem de Lista</CardTitle>
        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab drag-handle" />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 rounded-full" />
        <div>
          <label htmlFor={`messageText-${id}`} className="text-xs font-medium text-gray-700">Texto Principal</label>
          <Textarea
            id={`messageText-${id}`}
            name="messageText"
            placeholder="Olá! Escolha uma opção:"
            value={nodeData.messageText || ''}
            onChange={handleInputChange}
            className="mt-1 w-full nodrag" // nodrag para permitir interação com textarea
            rows={2}
          />
        </div>
        <div>
          <label htmlFor={`buttonText-${id}`} className="text-xs font-medium text-gray-700">Texto do Botão da Lista</label>
          <Input
            id={`buttonText-${id}`}
            name="buttonText"
            placeholder="Ver Opções"
            value={nodeData.buttonText || ''}
            onChange={handleInputChange}
            className="mt-1 w-full nodrag"
          />
        </div>
        <div>
          <label htmlFor={`footerText-${id}`} className="text-xs font-medium text-gray-700">Texto do Rodapé (opcional)</label>
          <Input
            id={`footerText-${id}`}
            name="footerText"
            placeholder="Rodapé da lista"
            value={nodeData.footerText || ''}
            onChange={handleInputChange}
            className="mt-1 w-full nodrag"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold text-gray-800">Seções e Itens</h4>
            <Button variant="outline" size="sm" onClick={addSection} className="nodrag">
              <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Seção
            </Button>
          </div>
          {(nodeData.sections || []).map((section: ListSection, sectionIndex: number) => (
            <div key={sectionIndex} className="p-2 border rounded bg-gray-50 space-y-2">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Título da Seção"
                  value={section.title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleSectionTitleChange(sectionIndex, e.target.value)}
                  className="flex-grow nodrag"
                />
                <Button variant="ghost" size="icon" onClick={() => removeSection(sectionIndex)} className="nodrag">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              {section.rows.map((item: ListItem, itemIndex: number) => (
                <div key={item.id || itemIndex} className="pl-4 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Título do Item"
                      value={item.title}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(sectionIndex, itemIndex, 'title', e.target.value)}
                      className="flex-grow nodrag"
                    />
                     <Button variant="ghost" size="icon" onClick={() => removeItemFromSection(sectionIndex, itemIndex)} className="nodrag">
                        <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Descrição do Item (opcional)"
                    value={item.description || ''}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleItemChange(sectionIndex, itemIndex, 'description', e.target.value)}
                    className="w-full text-xs nodrag"
                    rows={1}
                  />
                </div>
              ))}
              <Button variant="outline" size="xs" onClick={() => addItemToSection(sectionIndex)} className="mt-1 nodrag">
                <PlusCircle className="w-3 h-3 mr-1" /> Adicionar Item à Seção
              </Button>
            </div>
          ))}
        </div>
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 rounded-full" />
      </CardContent>
    </Card>
  );
};

export default memo(ListMessageNode);
