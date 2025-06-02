// zap/client/src/components/ZapFlowBuilder.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider, /* ... (outras importações do ReactFlow como antes) ... */
  useNodesState, useEdgesState, addEdge, Node, Edge, Connection, Panel, MarkerType, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select'; // Select local do Zap
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@zap_client/lib/api';
import { 
    type FlowElementData, type BaseNodeData,
    type TextMessageNodeData, type ConditionNodeData, type FlowCondition,
    type ApiCallNodeData, type ButtonsMessageNodeData, type FlowButtonOptionData,
    type QuestionNodeData, type MediaMessageNodeData,
    type ListMessageNodeDataFE, type FlowListSectionData, type FlowListItemData,
    type ExternalDataFetchNodeDataFE, type DelayNodeData, type SetVariableNodeData,
    type TriggerNodeData, type EndNodeData, type AiDecisionNodeData,
    type GptQueryNodeData, type TagContactNodeData, type ClonedVoiceNodeData
} from '@zap_client/features/types/whatsapp_flow_types'; // Certifique-se que todos os tipos de NodeData estão aqui
import { /* ... (todos os ícones como antes) ... */ } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';

// Nós Customizados (importar todos)
import TextMessageNode from './flow_builder_nodes/TextMessageNode';
import ConditionNode from './flow_builder_nodes/ConditionNode';
import ApiCallNode from './flow_builder_nodes/ApiCallNode';
import ButtonsMessageNode from './flow_builder_nodes/ButtonsMessageNode';
import QuestionNode from './flow_builder_nodes/QuestionNode';
import MediaMessageNode from './flow_builder_nodes/MediaMessageNode';
import ListMessageNode from './flow_builder_nodes/ListMessageNode';
import ExternalDataFetchNode from './flow_builder_nodes/ExternalDataFetchNode';
import DelayNode from './flow_builder_nodes/DelayNode';
import SetVariableNode from './flow_builder_nodes/SetVariableNode';
import TriggerNode from './flow_builder_nodes/TriggerNode';
import EndNode from './flow_builder_nodes/EndNode';
import AiDecisionNode from './flow_builder_nodes/AiDecisionNode';
import GptQueryNode from './flow_builder_nodes/GptQueryNode';
import TagContactNode from './flow_builder_nodes/TagContactNode';
import ClonedVoiceNode from './flow_builder_nodes/ClonedVoiceNode';


export const availableNodeTypesConfig = [ /* ... (como na rodada anterior, completa) ... */ ];
const PlaceholderNodeComponentInternal: React.FC<NodeProps<any> & {defaultIcon: React.ElementType, defaultLabel: string}> = ({ data, type, selected, defaultIcon: DefaultIcon, defaultLabel }) => { /* ... como antes ... */ return <div>...</div>};
const nodeTypes: NodeTypes = { /* ... (todos os nós mapeados como na rodada anterior) ... */ };
const initialNodesData: Node<any>[] = [ /* ... como antes ... */ ];
interface ZapFlowBuilderProps { /* ... como antes ... */ }
let idCounter = 0;
const getUniqueNodeId = (type = 'node') => `${type}_${Date.now()}_${idCounter++}`;
type AllNodeDataTypes = /* ... (todos os tipos de NodeData como na rodada anterior) ... */ BaseNodeData;


const ZapFlowBuilderInternal: React.FC<ZapFlowBuilderProps> = ({ flowId, initialFlowName, onSaveSuccess, onCloseEditor }) => {
  // ... (Hooks: useReactFlow, useQueryClient, useNodesState, useEdgesState, useState, useRef como antes) ...
  const { screenToFlowPosition, fitView, getNodes, getEdges, deleteElements, project, setViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesData);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState<Node<AllNodeDataTypes> | null>(null);
  const [flowName, setFlowName] = useState(initialFlowName || 'Novo Fluxo');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(true);
  // ... (useQuery para loadedFlow, saveFlowMutation como antes) ...
  // ... (onConnect, handleSaveFlow, onNodeClick, onPaneClick, onDragOver, onDrop como antes) ...

  // Função handleNodeDataChange APRIMORADA para ListMessageNode e ButtonsMessageNode
  const handleNodeDataChange = (
    key: PathValue<AllNodeDataTypes, Path<AllNodeDataTypes>> | string, // Permite path aninhado como string
    value: any, 
    // Para arrays aninhados (usado por ListMessageNode e ButtonsMessageNode)
    arrayName?: 'conditions' | 'buttons' | 'sections' | 'sections.rows',
    index?: number, 
    subIndex?: number, // para rows dentro de sections
    itemKey?: string // para propriedades de um item no array (ex: 'label' de um botão)
  ) => {
    if (!selectedNodeForEdit) return;
    
    const nodeId = selectedNodeForEdit.id;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const newData = { ...node.data };

          if (arrayName && typeof index === 'number') {
            let targetArray = (newData as any)[arrayName] as any[];
            if (!targetArray && (arrayName === 'conditions' || arrayName === 'buttons' || arrayName === 'sections')) {
                (newData as any)[arrayName] = []; // Inicializa se não existir
                targetArray = (newData as any)[arrayName];
            }
            
            if (arrayName === 'sections.rows' && typeof subIndex === 'number' && itemKey) { // Editar item de uma linha em uma seção
                const sections = (newData as ListMessageNodeDataFE).sections || [];
                if (sections[index]) {
                    const rows = sections[index].rows || [];
                    if (rows[subIndex]) {
                        (rows[subIndex] as any)[itemKey] = value;
                    }
                }
            } else if (itemKey) { // Editar propriedade de um item em um array de 1 nível
                if (targetArray && targetArray[index]) {
                    (targetArray[index] as any)[itemKey] = value;
                }
            } else { // Substituir o item inteiro ou o array inteiro (se value for o array)
                 if (targetArray && targetArray[index] !== undefined && value === null) { // Remover item
                    targetArray.splice(index, 1);
                 } else if (targetArray && targetArray[index] !== undefined) { // Atualizar item
                    targetArray[index] = value;
                 } else if (value !== null) { // Adicionar item (value é o novo item)
                     targetArray.push(value);
                 }
            }
          } else { // Atualização de propriedade direta do nó
            (newData as any)[key as string] = value;
          }
          
          // Atualiza o estado do nó selecionado também para refletir no painel
          setSelectedNodeForEdit(prev => prev ? { ...prev, data: newData } : null);
          return { ...node, data: newData };
        }
        return node;
      })
    );
  };

  // Funções helper para ListMessageNode Properties Panel
  const addListSectionToNode = () => {
    if (selectedNodeForEdit?.type !== 'listMessageNode') return;
    const newSection: FlowListSectionData = { title: `Nova Seção ${((selectedNodeForEdit.data as ListMessageNodeDataFE).sections?.length || 0) + 1}`, rows: [{id: getUniqueNodeId('listItem'), title: 'Novo Item'}] };
    const currentSections = (selectedNodeForEdit.data as ListMessageNodeDataFE).sections || [];
    handleNodeDataChange('sections', [...currentSections, newSection]);
  };
  const removeListSectionFromNode = (sectionIndex: number) => {
    if (selectedNodeForEdit?.type !== 'listMessageNode') return;
    const currentSections = (selectedNodeForEdit.data as ListMessageNodeDataFE).sections || [];
    handleNodeDataChange('sections', currentSections.filter((_, idx) => idx !== sectionIndex));
  };
  const addListItemToSectionInNode = (sectionIndex: number) => {
    if (selectedNodeForEdit?.type !== 'listMessageNode') return;
    const currentSections = (selectedNodeForEdit.data as ListMessageNodeDataFE).sections || [];
    if (!currentSections[sectionIndex]) return;
    const newListItem: FlowListItemData = { id: getUniqueNodeId('listItem'), title: `Novo Item ${(currentSections[sectionIndex].rows?.length || 0) + 1}`};
    const updatedSections = currentSections.map((sec, idx) => 
        idx === sectionIndex ? {...sec, rows: [...(sec.rows || []), newListItem]} : sec
    );
    handleNodeDataChange('sections', updatedSections);
  };
  const removeListItemFromSectionInNode = (sectionIndex: number, itemIndex: number) => {
     if (selectedNodeForEdit?.type !== 'listMessageNode') return;
    const currentSections = (selectedNodeForEdit.data as ListMessageNodeDataFE).sections || [];
    if (!currentSections[sectionIndex] || !currentSections[sectionIndex].rows) return;
    const updatedSections = currentSections.map((sec, idx) => 
        idx === sectionIndex ? {...sec, rows: (sec.rows || []).filter((_, rIdx) => rIdx !== itemIndex) } : sec
    );
    handleNodeDataChange('sections', updatedSections);
  };


  const addCondition = () => { /* ... como antes ... */ };
  const removeCondition = (conditionIdToRemove: string) => { /* ... como antes ... */ };
  const addButtonToNode = () => { /* ... como antes ... */ };
  const removeButtonFromNode = (buttonIdToRemove: string) => { /* ... como antes ... */ };
  const deleteSelectedNode = () => { /* ... como antes ... */ };

  if (isLoadingFlow && flowId) { /* ... */ }
  if (flowError && flowId) { /* ... */ }

  return (
      <div className="h-[calc(100vh-180px)] w-full flex flex-col md:flex-row border rounded-lg shadow-md bg-card neu-card overflow-hidden" ref={reactFlowWrapper}>
        {/* Paleta de Nós (como antes, usando availableNodeTypesConfig) */}
        <Card className="w-full md:w-64 ..."> {/* ... */} </Card>

        {/* Canvas do React Flow (como antes) */}
        <div className="flex-grow relative h-full min-h-[400px] md:min-h-0" onDrop={onDrop} onDragOver={onDragOver}> {/* ... */} </div>

        {/* Painel de Propriedades */}
        <Card className={cn("w-full md:w-80 ...", isPropertiesPanelOpen && selectedNodeForEdit ? "..." : "...")}> {/* Aumentar largura do painel */}
             <CardHeader className="p-3 border-b sticky top-0 bg-card z-10"> {/* ... Título e ID do nó ... */} </CardHeader>
            <CardContent className="p-3">
                <ScrollArea className="h-[calc(100vh-250px)] md:h-[calc(100vh-220px)] pr-2"> {/* Aumentar padding da scrollbar */}
                {selectedNodeForEdit ? (
                    <div className="space-y-4">
                        {/* Label do Nó (Comum a todos) */}
                        <div><Label className="text-xs">Título do Nó*</Label><Input value={selectedNodeForEdit.data.label || ''} onChange={(e) => handleNodeDataChange('label', e.target.value)} className="h-8 ..."/></div>

                        {/* Propriedades específicas por tipo de nó */}
                        {selectedNodeForEdit.type === 'triggerNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'endNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'textMessageNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'conditionNode' && ( /* ... painel como antes, usando FlowCondition ... */ )}
                        {selectedNodeForEdit.type === 'apiCallNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'questionNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'mediaMessageNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'delayNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'setVariableNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'aiDecisionNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'gptQueryNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'tagContactNode' && ( /* ... painel como antes ... */ )}
                        {selectedNodeForEdit.type === 'clonedVoiceNode' && ( /* ... painel como antes ... */ )}

                        {selectedNodeForEdit.type === 'buttonsMessageNode' && (
                            <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
                                <h5 className="text-xs font-medium text-muted-foreground">Mensagem com Botões</h5>
                                <div><Label className="text-xs">Texto Principal*</Label><Textarea value={(selectedNodeForEdit.data as ButtonsMessageNodeData).messageText || ''} onChange={(e) => handleNodeDataChange('messageText', e.target.value)} rows={3} className="text-xs ..."/></div>
                                <div><Label className="text-xs">Texto do Rodapé</Label><Input value={(selectedNodeForEdit.data as ButtonsMessageNodeData).footerText || ''} onChange={(e) => handleNodeDataChange('footerText', e.target.value)} className="h-8 ..."/></div>
                                <Label className="text-xs font-medium pt-1 block">Botões (Máx 3 de Resposta Rápida):</Label>
                                {((selectedNodeForEdit.data as ButtonsMessageNodeData).buttons || []).map((btn, index) => (
                                    <Card key={btn.id || `btn-${index}`} className="p-2.5 space-y-1.5 bg-muted/30 neu-inset-card-sm">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xxs">Botão {index + 1}</Label>
                                            <Button variant="ghost" size="xs" onClick={() => removeButtonFromNode(btn.id!)} className="text-destructive h-6 w-6 p-0"><Trash2 className="w-3 h-3"/></Button>
                                        </div>
                                        {/* ID do Botão é crucial para o handle de saída */}
                                        <div><Label className="text-xxs">ID do Botão/Handle*</Label><Input value={btn.id || ''} onChange={(e) => handleNodeDataChange('buttons', e.target.value, btn.id, 'id', index)} placeholder="Ex: opcao_sim" className="h-7 text-xxs font-mono ..."/></div>
                                        <div><Label className="text-xxs">Texto de Exibição*</Label><Input value={btn.label || ''} onChange={(e) => handleNodeDataChange('buttons', e.target.value, btn.id, 'label', index)} placeholder={`Opção ${index + 1}`} className="h-7 text-xxs ..."/></div>
                                        {/* Adicionar campos para tipo de botão (URL, CALL) e seus valores aqui se necessário */}
                                    </Card>
                                ))}
                                {((selectedNodeForEdit.data as ButtonsMessageNodeData).buttons || []).length < 3 && (
                                    <Button variant="outline" size="xs" onClick={addButtonToNode} className="w-full text-xxs neu-button"><Plus className="w-3 h-3 mr-1"/>Adicionar Botão de Resposta</Button>
                                )}
                            </div>
                        )}

                        {selectedNodeForEdit.type === 'listMessageNode' && (
                            <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
                                <h5 className="text-xs font-medium text-muted-foreground">Mensagem com Lista</h5>
                                <div><Label className="text-xs">Texto Principal (acima da lista)*</Label><Textarea value={(selectedNodeForEdit.data as ListMessageNodeDataFE).messageText || ''} onChange={(e) => handleNodeDataChange('messageText', e.target.value)} rows={2} className="text-xs ..."/></div>
                                <div><Label className="text-xs">Texto do Botão da Lista*</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).buttonText || ''} onChange={(e) => handleNodeDataChange('buttonText', e.target.value)} placeholder="Ex: Ver Opções" className="h-8 ..."/></div>
                                <div><Label className="text-xs">Título da Lista (Opcional)</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).title || ''} onChange={(e) => handleNodeDataChange('title', e.target.value)} className="h-8 ..."/></div>
                                <div><Label className="text-xs">Rodapé da Lista (Opcional)</Label><Input value={(selectedNodeForEdit.data as ListMessageNodeDataFE).footerText || ''} onChange={(e) => handleNodeDataChange('footerText', e.target.value)} className="h-8 ..."/></div>
                                
                                <Label className="text-xs font-medium pt-2 block">Seções e Itens:</Label>
                                {((selectedNodeForEdit.data as ListMessageNodeDataFE).sections || []).map((section, sectionIdx) => (
                                    <Card key={`section-${sectionIdx}`} className="p-3 space-y-2 bg-muted/30 neu-inset-card">
                                        <div className="flex justify-between items-center">
                                            <Input value={section.title} onChange={(e) => handleNodeDataChange('sections', e.target.value, undefined, 'title', sectionIdx)} placeholder={`Título Seção ${sectionIdx + 1}`} className="h-7 text-xxs flex-grow mr-1 neu-input"/>
                                            <Button variant="ghost" size="xs" onClick={() => removeListSectionFromNode(sectionIdx)} className="text-destructive h-6 w-6 p-0 neu-button"><Trash2 className="w-3 h-3"/></Button>
                                        </div>
                                        {(section.rows || []).map((row, rowIdx) => (
                                            <Card key={row.id || `row-${sectionIdx}-${rowIdx}`} className="p-2 space-y-1.5 bg-card/50 dark:bg-background/40 neu-inset-card-sm">
                                                <div className="flex justify-between items-center"><Label className="text-xxs">Item {rowIdx+1}</Label><Button variant="ghost" size="xs" onClick={() => removeListItemFromSectionInNode(sectionIdx, rowIdx)} className="text-destructive h-5 w-5 p-0 neu-button"><Trash2 className="w-2.5 h-2.5"/></Button></div>
                                                <div><Label className="text-xxs">Título do Item*</Label><Input value={row.title} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'title', sectionIdx, rowIdx, 'title')} className="h-6 text-xxs neu-input"/></div>
                                                <div><Label className="text-xxs">Descrição (Opcional)</Label><Input value={row.description || ''} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'description', sectionIdx, rowIdx, 'description')} className="h-6 text-xxs neu-input"/></div>
                                                <div><Label className="text-xxs">ID do Item/Handle*</Label><Input value={row.id} onChange={(e) => handleNodeDataChange('sections.rows', e.target.value, undefined, 'id', sectionIdx, rowIdx, 'id')} placeholder="ID único para saída" className="h-6 text-xxs font-mono neu-input"/></div>
                                            </Card>
                                        ))}
                                        <Button variant="outline" size="xs" onClick={() => addListItemToSectionInNode(sectionIdx)} className="w-full text-xxs h-6 neu-button"><Plus className="w-3 h-3 mr-1"/>Adicionar Item à Seção</Button>
                                    </Card>
                                ))}
                                <Button variant="outline" size="sm" onClick={addListSectionToNode} className="w-full text-xs neu-button"><Plus className="w-3.5 h-3.5 mr-1.5"/>Adicionar Seção</Button>
                            </div>
                        )}
                        
                        {/* ... (Dados brutos e botão Deletar Nó como antes) ... */}
                    </div>
                ) : ( <p className="text-xs text-muted-foreground text-center py-10">Selecione um nó no canvas para editar.</p> )}
                </ScrollArea>
            </CardContent>
        </Card>
      </div>
  );
};

const ZapFlowBuilderWrapper: React.FC<ZapFlowBuilderProps> = (props) => ( <ReactFlowProvider> <ZapFlowBuilderInternal {...props} /> </ReactFlowProvider> );
export default ZapFlowBuilderWrapper;

type ZapFlow = { /* ... como antes ... */ };
// Garantir que AllNodeDataTypes inclua TODOS os tipos de data dos nós