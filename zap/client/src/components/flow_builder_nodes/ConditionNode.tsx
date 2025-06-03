import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps, Connection } from '@xyflow/react'; // Adicionado Connection
// CORRIGIDO: Path Aliases
import { ConditionNodeData, FlowNodeType, HandleData, ConditionRule, ConditionOperator, ConditionBranchConfig } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Share2, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area'; // Adicionado ScrollArea

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  // As saídas são dinâmicas baseadas nas branchConfigs
];

// CORRIGIDO: Tipagem explícita das props
const ConditionNodeComponent: React.FC<ReactFlowNodeProps<ConditionNodeData>> = ({ id, data, selected }) => {
  const { setNodes, deleteElements } = useReactFlow(); // Adicionado deleteElements para remover edges ao remover branch

  const [label, setLabel] = useState<string>(data.label || 'Condição');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [branchConfigs, setBranchConfigs] = useState<ConditionBranchConfig[]>(
    data.branchConfigs || [{ id: `branch-${Date.now()}`, handleId: `output-true-${Date.now()}`, label: 'Verdadeiro', rules: [], logicalOperator: 'AND' }]
  );

  useEffect(() => {
    setLabel(data.label || 'Condição');
    setBranchConfigs(data.branchConfigs || [{ id: `branch-${Date.now()}`, handleId: `output-true-${Date.now()}`, label: 'Verdadeiro', rules: [], logicalOperator: 'AND' }]);
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<ConditionNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ConditionNodeData;
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
  
  const handleBranchConfigChange = (branchIndex: number, field: keyof ConditionBranchConfig, value: string | ConditionRule[] | 'AND' | 'OR') => {
    const newBranchConfigs = [...branchConfigs];
    (newBranchConfigs[branchIndex] as any)[field] = value;
    setBranchConfigs(newBranchConfigs);
    updateNodePartialData({ branchConfigs: newBranchConfigs });
  };

  const handleRuleChange = (branchIndex: number, ruleIndex: number, field: keyof ConditionRule, value: string | ConditionOperator | any) => {
    const newBranchConfigs = [...branchConfigs];
    const newRules = [...newBranchConfigs[branchIndex].rules];
    (newRules[ruleIndex] as any)[field] = value;
    newBranchConfigs[branchIndex].rules = newRules;
    setBranchConfigs(newBranchConfigs);
    updateNodePartialData({ branchConfigs: newBranchConfigs });
  };

  const addRuleToBranch = (branchIndex: number) => {
    const newBranchConfigs = [...branchConfigs];
    newBranchConfigs[branchIndex].rules.push({ id: `rule-${Date.now()}`, variableName: '', operator: ConditionOperator.EQUALS, valueToCompare: '' });
    setBranchConfigs(newBranchConfigs);
    updateNodePartialData({ branchConfigs: newBranchConfigs });
  };
  const removeRuleFromBranch = (branchIndex: number, ruleIndex: number) => {
    const newBranchConfigs = [...branchConfigs];
    newBranchConfigs[branchIndex].rules = newBranchConfigs[branchIndex].rules.filter((_: ConditionRule, i: number) => i !== ruleIndex);
    setBranchConfigs(newBranchConfigs);
    updateNodePartialData({ branchConfigs: newBranchConfigs });
  };
  
  const addBranch = () => {
    const newBranchId = `branch-${Date.now()}`;
    const newHandleId = `output-${newBranchId}`;
    const newBranch: ConditionBranchConfig = { id: newBranchId, handleId: newHandleId, label: `Condição ${branchConfigs.length + 1}`, rules: [], logicalOperator: 'AND' };
    const newConfigs = [...branchConfigs, newBranch];
    setBranchConfigs(newConfigs);
    updateNodePartialData({ branchConfigs: newConfigs });
  };

  const removeBranch = (branchIndex: number) => {
    if (branchConfigs.length <= 1) {
        alert("Deve haver pelo menos uma ramificação de condição.");
        return;
    }
    const branchToRemove = branchConfigs[branchIndex];
    // Também precisaria remover as arestas conectadas a este handleId
    // Esta parte é mais complexa e pode precisar de acesso ao estado das arestas ou uma função da instância ReactFlow
    // deleteElements({ nodes: [], edges: edges.filter(edge => edge.sourceHandle === branchToRemove.handleId) }); // Exemplo
    
    const newConfigs = branchConfigs.filter((_: ConditionBranchConfig, i: number) => i !== branchIndex);
    setBranchConfigs(newConfigs);
    updateNodePartialData({ branchConfigs: newConfigs });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = useMemo(() => {
    const inputHandle = (data.handles?.find(h => h.type === 'target')) || 
                        (defaultHandles.find(h => h.type === 'target'));
    
    const outputHandles = branchConfigs.map((branch, index) => ({
        id: branch.handleId,
        type: 'source' as 'source',
        position: Position.Right,
        label: branch.label || `Saída ${index + 1}`,
        style: { top: `${(index + 0.5) * (100 / (branchConfigs.length || 1) )}%` }, // Distribui os handles
    }));
    
    return inputHandle ? [inputHandle, ...outputHandles] : outputHandles;
  }, [data.handles, branchConfigs]);


  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-cyan-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-cyan-500/10 dark:bg-cyan-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <Share2 className="h-4 w-4 mr-2 text-cyan-600 dark:text-cyan-400" />
                {data.label || 'Condição'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-cyan-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-96">
        <ScrollArea className="h-80 pr-3">
            {branchConfigs.map((branch, branchIndex) => (
                <Card key={branch.id || branchIndex} className="mb-3 p-2 neu-card-inset">
                    <div className="flex items-center justify-between mb-2">
                        <Input 
                            value={branch.label} 
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleBranchConfigChange(branchIndex, 'label', e.target.value)} 
                            placeholder={`Nome da Ramificação ${branchIndex + 1}`}
                            className="text-xs font-medium flex-grow mr-2 h-8 neu-input"
                        />
                        {branchConfigs.length > 1 && 
                            <Button variant="ghost" size="icon" onClick={() => removeBranch(branchIndex)} className="h-7 w-7 text-destructive"><XCircle className="h-4 w-4"/></Button>
                        }
                    </div>
                    {branch.rules.map((rule, ruleIndex) => (
                        <div key={rule.id || ruleIndex} className="grid grid-cols-1 md:grid-cols-3 gap-1 mb-1 items-end p-1 border rounded-md">
                            <Input value={rule.variableName} onChange={(e: ChangeEvent<HTMLInputElement>) => handleRuleChange(branchIndex, ruleIndex, 'variableName', e.target.value)} placeholder="Variável (ex: {{resposta}})" className="neu-input text-xs h-8"/>
                            <Select value={rule.operator} onValueChange={(value: string) => handleRuleChange(branchIndex, ruleIndex, 'operator', value as ConditionOperator)}>
                                <SelectTrigger className="neu-input text-xs h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                {Object.values(ConditionOperator).map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                                <Input value={rule.valueToCompare} onChange={(e: ChangeEvent<HTMLInputElement>) => handleRuleChange(branchIndex, ruleIndex, 'valueToCompare', e.target.value)} placeholder="Valor" className="neu-input text-xs h-8 flex-grow"/>
                                <Button variant="ghost" size="icon" onClick={() => removeRuleFromBranch(branchIndex, ruleIndex)} className="h-7 w-7 text-destructive shrink-0"><XCircle className="h-3 w-3"/></Button>
                            </div>
                        </div>
                    ))}
                     <Button variant="link" size="xs" onClick={() => addRuleToBranch(branchIndex)} className="text-xs mt-1"><PlusCircle className="h-3 w-3 mr-1"/> Add Regra</Button>
                     {branch.rules.length > 1 && (
                        <div className="mt-1">
                            <Label className="text-xs">Operador Lógico entre Regras:</Label>
                            <Select value={branch.logicalOperator} onValueChange={(value: string) => handleBranchConfigChange(branchIndex, 'logicalOperator', value as 'AND' | 'OR')}>
                                <SelectTrigger className="neu-input text-xs h-8 mt-0.5"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AND">E (Todas as regras)</SelectItem>
                                    <SelectItem value="OR">OU (Qualquer regra)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                     )}
                </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addBranch} className="mt-2 text-xs w-full"><PlusCircle className="h-4 w-4 mr-1"/> Adicionar Ramificação (Saída)</Button>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#06b6d4', width: '10px', height: '10px' }} // Cor Cyan
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ConditionNodeComponent);
