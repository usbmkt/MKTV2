import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
import { QuestionNodeData, FlowNodeType, HandleData } from '@zap_client/features/types/whatsapp_flow_types'; // Path Alias Corrigido
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card'; // Path Alias Corrigido
import { Textarea } from '@zap_client/components/ui/textarea'; // Path Alias Corrigido
import { Input } from '@zap_client/components/ui/input'; // Path Alias Corrigido
import { Label } from '@zap_client/components/ui/label'; // Path Alias Corrigido
import { Button } from '@zap_client/components/ui/button'; // Path Alias Corrigido
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select'; // Path Alias Corrigido
import { Checkbox } from '@zap_client/components/ui/checkbox'; // Path Alias Corrigido
import { HelpCircle, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils'; // Path Alias Corrigido
import { Badge } from '@zap_client/components/ui/badge'; // Path Alias Corrigido

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output_default', type: 'source', position: Position.Right, label: 'Próximo (Padrão)', style: {top: '50%'} },
];

const QuestionNodeComponent: React.FC<ReactFlowNodeProps<QuestionNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Pergunta');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [questionText, setQuestionText] = useState<string>(data.questionText || '');
  const [expectedResponseType, setExpectedResponseType] = useState<QuestionNodeData['expectedResponseType']>(data.expectedResponseType || 'text');
  const [variableToStoreAnswer, setVariableToStoreAnswer] = useState<string>(data.variableToStoreAnswer || 'user_answer');
  const [options, setOptions] = useState<Array<{ id: string; label: string; value: string }>>(
    data.options || [{ id: Date.now().toString(), label: 'Opção 1', value: 'opcao1' }]
  );
  const [validationRegex, setValidationRegex] = useState<string>(data.validationRegex || '');
  const [errorMessage, setErrorMessage] = useState<string>(data.errorMessage || 'Resposta inválida.');
  const [enableAiSuggestions, setEnableAiSuggestions] = useState<boolean>(data.enableAiSuggestions || false);


  useEffect(() => {
    setLabel(data.label || 'Pergunta');
    setQuestionText(data.questionText || '');
    setExpectedResponseType(data.expectedResponseType || 'text');
    setVariableToStoreAnswer(data.variableToStoreAnswer || 'user_answer');
    setOptions(data.options || [{ id: Date.now().toString(), label: 'Opção 1', value: 'opcao1' }]);
    setValidationRegex(data.validationRegex || '');
    setErrorMessage(data.errorMessage || 'Resposta inválida.');
    setEnableAiSuggestions(data.enableAiSuggestions || false);
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<QuestionNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as QuestionNodeData;
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

  const handleQuestionTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setQuestionText(e.target.value);
    updateNodePartialData({ questionText: e.target.value });
  };

  const handleExpectedResponseTypeChange = (value: string) => {
    const newType = value as QuestionNodeData['expectedResponseType'];
    setExpectedResponseType(newType);
    updateNodePartialData({ expectedResponseType: newType, options: newType === 'options' ? options : undefined });
  };
  
  const handleVariableChange = (e: ChangeEvent<HTMLInputElement>) => {
    setVariableToStoreAnswer(e.target.value);
    updateNodePartialData({ variableToStoreAnswer: e.target.value });
  };

  const handleOptionChange = (index: number, field: 'label' | 'value', value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
    updateNodePartialData({ options: newOptions });
  };

  const addOption = () => {
    const newOption = { id: Date.now().toString(), label: `Opção ${options.length + 1}`, value: `opcao${options.length + 1}` };
    const newOptions = [...options, newOption];
    setOptions(newOptions);
    updateNodePartialData({ options: newOptions });
  };

  const removeOption = (indexToRemove: number) => {
    const newOptions = options.filter((_: { id: string; label: string; value: string }, index: number) => index !== indexToRemove);
    setOptions(newOptions);
    updateNodePartialData({ options: newOptions });
  };
  
  const handleRegexChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValidationRegex(e.target.value);
    updateNodePartialData({ validationRegex: e.target.value });
  };

  const handleErrorMessageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(e.target.value);
    updateNodePartialData({ errorMessage: e.target.value });
  };
  
  const handleAiSuggestionsChange = (checked: boolean | string) => { // Shadcn checkbox onCheckedChange can return 'indeterminate'
    const isChecked = typeof checked === 'boolean' ? checked : false;
    setEnableAiSuggestions(isChecked);
    updateNodePartialData({ enableAiSuggestions: isChecked });
  };


  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = useMemo(() => {
    const baseHandles: HandleData[] = data.handles || defaultHandles; // data.handles pode ser undefined
    const inputHandle = baseHandles.find(h => h.type === 'target') || defaultHandles.find(h => h.type === 'target');
    
    if (expectedResponseType === 'options' && data.options && data.options.length > 0) { // Checa se data.options existe
        const optionHandles = data.options.map((opt, index) => ({
            id: `option_output_${opt.id || index}`, 
            type: 'source' as 'source',
            position: Position.Right,
            label: `Saída: ${opt.label || `Opção ${index + 1}`}`,
            style: { top: `${(index + 1) * (100 / (data.options!.length +1 ))}%` }, // Adicionado ! pois checamos acima
        }));
        return inputHandle ? [inputHandle, ...optionHandles] : optionHandles;
    }
    // Retorna o input e a saída padrão se não for 'options' ou se não houver opções
    const outputHandle = baseHandles.find(h => h.type === 'source' && h.id === 'output_default') || defaultHandles.find(h => h.type === 'source');
    return inputHandle && outputHandle ? [inputHandle, outputHandle] : (inputHandle ? [inputHandle] : (outputHandle ? [outputHandle] : []));
  }, [data.handles, data.options, expectedResponseType, options]); // Adicionado options aqui, pois ele é usado para calcular style


  return (
    <Card className={cn("w-80 shadow-md neu-card", selected && "ring-2 ring-purple-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"> <Edit3 className="h-4 w-4" /> </Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"> <Trash2 className="h-4 w-4" /> </Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-purple-500/10 dark:bg-purple-700/20 rounded-t-lg">
        {isEditingLabel ? (
          <div className="flex items-center gap-2">
            <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
            <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
          </div>
        ) : (
          <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
            <HelpCircle className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
            {data.label || 'Pergunta'}
          </CardTitle>
        )}
        <Badge variant="default" className="bg-purple-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <Label htmlFor={`question-text-${id}`} className="text-xs">Texto da Pergunta</Label>
          <Textarea id={`question-text-${id}`} value={questionText} onChange={handleQuestionTextChange} placeholder="Ex: Qual o seu email?" className="mt-1 neu-input" rows={2}/>
        </div>
        <div>
          <Label htmlFor={`response-type-${id}`} className="text-xs">Tipo de Resposta Esperada</Label>
          <Select value={expectedResponseType} onValueChange={handleExpectedResponseTypeChange}>
            <SelectTrigger id={`response-type-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto Livre</SelectItem>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="date">Data</SelectItem>
              <SelectItem value="options">Opções (Botões/Respostas Rápidas)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`variable-store-${id}`} className="text-xs">Salvar Resposta na Variável</Label>
          <Input id={`variable-store-${id}`} value={variableToStoreAnswer} onChange={handleVariableChange} placeholder="Ex: email_cliente" className="mt-1 neu-input"/>
        </div>

        {expectedResponseType === 'options' && (
          <div className="space-y-2 border-t pt-2">
            <Label className="text-xs">Opções de Resposta</Label>
            {options.map((opt: { id: string; label: string; value: string }, index: number) => ( // Adicionado tipo para opt
              <div key={opt.id || index} className="flex items-center gap-2">
                <Input value={opt.label} onChange={(e: ChangeEvent<HTMLInputElement>) => handleOptionChange(index, 'label', e.target.value)} placeholder={`Label Opção ${index + 1}`} className="neu-input text-xs h-8"/>
                <Input value={opt.value} onChange={(e: ChangeEvent<HTMLInputElement>) => handleOptionChange(index, 'value', e.target.value)} placeholder={`Valor Opção ${index + 1}`} className="neu-input text-xs h-8"/>
                <Button variant="ghost" size="icon" onClick={() => removeOption(index)} className="h-8 w-8 text-destructive"> <XCircle className="h-4 w-4"/> </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOption} className="mt-1 text-xs"> <PlusCircle className="h-3 w-3 mr-1"/> Adicionar Opção </Button>
          </div>
        )}
         {(expectedResponseType !== 'options' && expectedResponseType !== 'text') && ( 
            <div>
                <Label htmlFor={`validation-regex-${id}`} className="text-xs">Regex de Validação (Opcional)</Label>
                <Input id={`validation-regex-${id}`} value={validationRegex} onChange={handleRegexChange} placeholder="Ex: ^\d+$ para números" className="mt-1 neu-input"/>
            </div>
         )}
         <div>
            <Label htmlFor={`error-message-${id}`} className="text-xs">Mensagem de Erro (se inválido)</Label>
            <Input id={`error-message-${id}`} value={errorMessage} onChange={handleErrorMessageChange} placeholder="Ex: Por favor, insira um email válido." className="mt-1 neu-input"/>
        </div>
        <div className="flex items-center space-x-2 pt-2">
            <Checkbox id={`ai-suggestions-${id}`} checked={enableAiSuggestions} onCheckedChange={handleAiSuggestionsChange} />
            <Label htmlFor={`ai-suggestions-${id}`} className="text-xs font-normal">Habilitar sugestões da IA para respostas?</Label>
        </div>

      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{ ...handleItem.style, background: '#a855f7', width: '10px', height: '10px' }}
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(QuestionNodeComponent);
