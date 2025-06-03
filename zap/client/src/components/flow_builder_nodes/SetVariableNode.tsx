import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
import { SetVariableNodeData, FlowNodeType, HandleData, VariableAssignment, VariableType } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { VariableIcon as VarIconPojo, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

const valueSourceTypes: VariableAssignment['sourceType'][] = ['static', 'variable', 'expression', 'api_response'];

const SetVariableNodeComponent: React.FC<ReactFlowNodeProps<SetVariableNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Definir Variável');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<VariableAssignment[]>(
    // Garantir que cada assignment tenha um ID único para a key do map
    (data.assignments || [{ id: `asg-${Date.now()}`, variableName: 'novaVariavel', value: '', sourceType: 'static' }])
    .map((asg, idx) => ({ ...asg, id: asg.id || `asg-${Date.now()}-${idx}`}))
  );

  useEffect(() => {
    setLabel(data.label || 'Definir Variável');
    setAssignments(
        (data.assignments || [{ id: `asg-${Date.now()}`, variableName: 'novaVariavel', value: '', sourceType: 'static' }])
        .map((asg, idx) => ({ ...asg, id: asg.id || `asg-effect-${Date.now()}-${idx}`}))
    );
  }, [data]);

  const updateNodeAssignments = useCallback(
    (newAssignments: VariableAssignment[]) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as SetVariableNodeData;
            return { ...node, data: { ...currentData, assignments: newAssignments, label: currentData.label, nodeType: currentData.nodeType } };
          }
          return node;
        })
      );
    },
    [id, setNodes] // Removido data.label e data.nodeType pois não são alterados aqui
  );
  
  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleLabelSave = () => {
    setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as SetVariableNodeData;
            return { ...node, data: { ...currentData, label: label } };
          }
          return node;
        })
      );
    setIsEditingLabel(false);
  };
  
  const handleAssignmentChange = (index: number, field: keyof VariableAssignment, value: string | VariableAssignment['sourceType']) => {
    const newAssignments = assignments.map((asg: VariableAssignment, i: number) => {
        if (i === index) {
            // Corrigido: Garantir que 'expression' e 'apiResponsePath' sejam undefined se não aplicável
            const updatedAsg = { ...asg, [field]: value };
            if (field === 'sourceType') {
                if (value !== 'expression') delete updatedAsg.expression;
                if (value !== 'api_response') delete updatedAsg.apiResponsePath;
            }
            return updatedAsg;
        }
        return asg;
    });
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const addAssignment = () => {
    const newAssignment: VariableAssignment = { 
        id: `asg-${Date.now()}-${assignments.length}`, 
        variableName: `var${assignments.length + 1}`, 
        value: '', 
        sourceType: 'static' 
    };
    const newAssignments = [...assignments, newAssignment];
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const removeAssignment = (indexToRemove: number) => {
    const newAssignments = assignments.filter((_: VariableAssignment, index: number) => index !== indexToRemove);
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-lime-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-lime-500/10 dark:bg-lime-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <VarIconPojo className="h-4 w-4 mr-2 text-lime-600 dark:text-lime-400" />
                {label} {/* Usar estado local para label */}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-lime-500 text-black capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-80">
        <ScrollArea className="h-72 pr-3">
            {assignments.map((assignment: VariableAssignment, index: number) => (
                <Card key={assignment.id || index} className="p-2 mb-2 neu-card-inset space-y-1">
                    <div className="flex items-center justify-end">
                        {assignments.length > 0 && 
                            <Button variant="ghost" size="icon" onClick={() => removeAssignment(index)} className="h-6 w-6 text-destructive"><XCircle className="h-3.5 w-3.5"/></Button>
                        }
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <div>
                            <Label htmlFor={`var-name-${id}-${index}`} className="text-xs">Nome da Variável *</Label>
                            <Input id={`var-name-${id}-${index}`} value={assignment.variableName} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'variableName', e.target.value)} placeholder="Ex: nome_usuario" className="neu-input text-xs h-8"/>
                        </div>
                        <div>
                            <Label htmlFor={`var-source-${id}-${index}`} className="text-xs">Fonte do Valor</Label>
                            <Select value={assignment.sourceType} onValueChange={(value: string) => handleAssignmentChange(index, 'sourceType', value as VariableAssignment['sourceType'])}>
                                <SelectTrigger id={`var-source-${id}-${index}`} className="neu-input text-xs h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {valueSourceTypes.map(vst => <SelectItem key={vst} value={vst}>{vst.replace('_', ' ').toLocaleUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor={`var-value-${id}-${index}`} className="text-xs">Valor</Label>
                            <Input id={`var-value-${id}-${index}`} value={String(assignment.value ?? '')} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'value', e.target.value)} placeholder="Valor ou {{outra_var}}" className="neu-input text-xs h-8"/>
                        </div>
                        {assignment.sourceType === 'expression' && (
                             <div>
                                <Label htmlFor={`var-expr-${id}-${index}`} className="text-xs">Expressão</Label>
                                <Input id={`var-expr-${id}-${index}`} value={assignment.expression || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'expression', e.target.value)} placeholder="Ex: {{var1}} + {{var2}}" className="neu-input text-xs h-8"/>
                            </div>
                        )}
                        {assignment.sourceType === 'api_response' && (
                             <div>
                                <Label htmlFor={`var-path-${id}-${index}`} className="text-xs">Caminho na Resposta API (JSONPath)</Label>
                                <Input id={`var-path-${id}-${index}`} value={assignment.apiResponsePath || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'apiResponsePath', e.target.value)} placeholder="Ex: $.data.items[0].name" className="neu-input text-xs h-8"/>
                            </div>
                        )}
                    </div>
                </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addAssignment} className="mt-2 text-xs w-full"><PlusCircle className="h-4 w-4 mr-1"/> Adicionar Atribuição</Button>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#84cc16', width: '10px', height: '10px' }} 
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(SetVariableNodeComponent);import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { SetVariableNodeData, FlowNodeType, HandleData, VariableAssignment, VariableType } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { VariableIcon as VarIconPojo, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';


const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output', type: 'source', position: Position.Right, label: 'Saída', style: {top: '50%'} },
];

const valueSourceTypes: VariableAssignment['sourceType'][] = ['static', 'variable', 'expression', 'api_response'];

// CORRIGIDO: Tipagem explícita das props
const SetVariableNodeComponent: React.FC<ReactFlowNodeProps<SetVariableNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Definir Variável');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<VariableAssignment[]>(
    data.assignments || [{ id: `asg-${Date.now()}`, variableName: 'novaVariavel', value: '', sourceType: 'static' }]
  );

  useEffect(() => {
    setLabel(data.label || 'Definir Variável');
    setAssignments(data.assignments || [{ id: `asg-${Date.now()}`, variableName: 'novaVariavel', value: '', sourceType: 'static' }]);
  }, [data]);

  const updateNodeAssignments = useCallback(
    (newAssignments: VariableAssignment[]) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as SetVariableNodeData; // Cast para o tipo específico
            return { ...node, data: { ...currentData, assignments: newAssignments } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );
  
  const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleLabelSave = () => {
    setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as SetVariableNodeData;
            return { ...node, data: { ...currentData, label: label } };
          }
          return node;
        })
      );
    setIsEditingLabel(false);
  };
  
  const handleAssignmentChange = (index: number, field: keyof VariableAssignment, value: string | VariableAssignment['sourceType']) => {
    const newAssignments = assignments.map((asg: VariableAssignment, i: number) => { // Tipado asg
        if (i === index) {
            return { ...asg, [field]: value };
        }
        return asg;
    });
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const addAssignment = () => {
    const newAssignment: VariableAssignment = { 
        id: `asg-${Date.now()}-${assignments.length}`, 
        variableName: `var${assignments.length + 1}`, 
        value: '', 
        sourceType: 'static' 
    };
    const newAssignments = [...assignments, newAssignment];
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const removeAssignment = (indexToRemove: number) => {
    const newAssignments = assignments.filter((_: VariableAssignment, index: number) => index !== indexToRemove); // Tipado _
    setAssignments(newAssignments);
    updateNodeAssignments(newAssignments);
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-lime-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-lime-500/10 dark:bg-lime-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <VarIconPojo className="h-4 w-4 mr-2 text-lime-600 dark:text-lime-400" />
                {data.label || 'Definir Variável'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-lime-500 text-black capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-80">
        <ScrollArea className="h-72 pr-3">
            {assignments.map((assignment: VariableAssignment, index: number) => (
                <Card key={assignment.id || index} className="p-2 mb-2 neu-card-inset space-y-1">
                    <div className="flex items-center justify-end">
                        {assignments.length > 0 && 
                            <Button variant="ghost" size="icon" onClick={() => removeAssignment(index)} className="h-6 w-6 text-destructive"><XCircle className="h-3.5 w-3.5"/></Button>
                        }
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <div>
                            <Label htmlFor={`var-name-${id}-${index}`} className="text-xs">Nome da Variável *</Label>
                            <Input id={`var-name-${id}-${index}`} value={assignment.variableName} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'variableName', e.target.value)} placeholder="Ex: nome_usuario" className="neu-input text-xs h-8"/>
                        </div>
                        <div>
                            <Label htmlFor={`var-source-${id}-${index}`} className="text-xs">Fonte do Valor</Label>
                            <Select value={assignment.sourceType} onValueChange={(value: string) => handleAssignmentChange(index, 'sourceType', value as VariableAssignment['sourceType'])}>
                                <SelectTrigger id={`var-source-${id}-${index}`} className="neu-input text-xs h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {valueSourceTypes.map(vst => <SelectItem key={vst} value={vst}>{vst.replace('_', ' ').toLocaleUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor={`var-value-${id}-${index}`} className="text-xs">Valor</Label>
                            <Input id={`var-value-${id}-${index}`} value={String(assignment.value ?? '')} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'value', e.target.value)} placeholder="Valor ou {{outra_var}}" className="neu-input text-xs h-8"/>
                        </div>
                        {assignment.sourceType === 'expression' && (
                             <div>
                                <Label htmlFor={`var-expr-${id}-${index}`} className="text-xs">Expressão</Label>
                                <Input id={`var-expr-${id}-${index}`} value={assignment.expression || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'expression', e.target.value)} placeholder="Ex: {{var1}} + {{var2}}" className="neu-input text-xs h-8"/>
                            </div>
                        )}
                        {assignment.sourceType === 'api_response' && (
                             <div>
                                <Label htmlFor={`var-path-${id}-${index}`} className="text-xs">Caminho na Resposta API (JSONPath)</Label>
                                <Input id={`var-path-${id}-${index}`} value={assignment.apiResponsePath || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleAssignmentChange(index, 'apiResponsePath', e.target.value)} placeholder="Ex: $.data.items[0].name" className="neu-input text-xs h-8"/>
                            </div>
                        )}
                    </div>
                </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addAssignment} className="mt-2 text-xs w-full"><PlusCircle className="h-4 w-4 mr-1"/> Adicionar Atribuição</Button>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#84cc16', width: '10px', height: '10px' }} 
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(SetVariableNodeComponent);
