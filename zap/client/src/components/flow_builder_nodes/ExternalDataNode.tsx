import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
// CORRIGIDO: Path Aliases
import { ExternalDataNodeData, FlowNodeType, HandleData, ApiResponseMapping } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { DatabaseZap, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';

const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output_success', type: 'source', position: Position.Right, label: 'Sucesso', style: {top: '35%'} },
  { id: 'output_error', type: 'source', position: Position.Right, label: 'Erro', style: {top: '65%'} },
];

// CORRIGIDO: Tipagem explícita das props
const ExternalDataNodeComponent: React.FC<ReactFlowNodeProps<ExternalDataNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Buscar Dados Externos');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [dataSourceUrl, setDataSourceUrl] = useState<string>(data.dataSourceUrl || '');
  const [requestType, setRequestType] = useState<ExternalDataNodeData['requestType']>(data.requestType || 'GET');
  const [requestPayload, setRequestPayload] = useState<string>(
    typeof data.requestPayload === 'string' ? data.requestPayload : (data.requestPayload ? JSON.stringify(data.requestPayload, null, 2) : '')
  );
  const [responseMapping, setResponseMapping] = useState<ApiResponseMapping[]>(data.responseMapping || []);

  useEffect(() => {
    setLabel(data.label || 'Buscar Dados Externos');
    setDataSourceUrl(data.dataSourceUrl || '');
    setRequestType(data.requestType || 'GET');
    setRequestPayload(
        typeof data.requestPayload === 'string' ? data.requestPayload : (data.requestPayload ? JSON.stringify(data.requestPayload, null, 2) : '')
    );
    setResponseMapping(data.responseMapping || []);
  }, [data]);

  const updateNodePartialData = useCallback(
    (newData: Partial<ExternalDataNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ExternalDataNodeData;
             // Se o payload for um objeto, converter para string JSON antes de salvar nos dados do nó
             let processedNewData = { ...newData };
             if (newData.requestPayload && typeof newData.requestPayload !== 'string') {
                 try {
                     processedNewData.requestPayload = JSON.stringify(newData.requestPayload, null, 2);
                 } catch (e) {
                     console.error("Erro ao serializar payload para JSON:", e);
                 }
             }
            return { ...node, data: { ...currentData, ...processedNewData } };
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

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDataSourceUrl(e.target.value);
    updateNodePartialData({ dataSourceUrl: e.target.value });
  };

  const handleRequestTypeChange = (value: string) => {
    const newType = value as ExternalDataNodeData['requestType'];
    setRequestType(newType);
    updateNodePartialData({ requestType: newType });
  };

  const handlePayloadChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const payloadString = e.target.value;
    setRequestPayload(payloadString);
    try {
        updateNodePartialData({ requestPayload: JSON.parse(payloadString) });
    } catch (error) {
        // Se não for JSON válido, talvez salvar como string ou mostrar erro
        updateNodePartialData({ requestPayload: payloadString });
    }
  };
  
  const handleMappingChange = (index: number, field: keyof ApiResponseMapping, value: string) => {
    const newMappings = [...responseMapping];
    (newMappings[index] as any)[field] = value;
    setResponseMapping(newMappings);
    updateNodePartialData({ responseMapping: newMappings });
  };

  const addMapping = () => {
    const newMap: ApiResponseMapping = { id: `map-<span class="math-inline">\{Date\.now\(\)\}\-</span>{Math.random().toString(36).substring(2,7)}`, sourcePath: '', targetVariable: '' };
    const newMappings = [...responseMapping, newMap];
    setResponseMapping(newMappings);
    updateNodePartialData({ responseMapping: newMappings });
  };

  const removeMapping = (indexToRemove: number) => {
    const newMappings = responseMapping.filter((_: ApiResponseMapping, index: number) => index !== indexToRemove);
    setResponseMapping(newMappings);
    updateNodePartialData({ responseMapping: newMappings });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-emerald-500 ring-offset-2")}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditingLabel(true)} title="Editar Nome"><Edit3 className="h-4 w-4" /></Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteNode} title="Remover Nó"><Trash2 className="h-4 w-4" /></Button>
      </NodeToolbar>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 bg-emerald-500/10 dark:bg-emerald-700/20 rounded-t-lg">
         {isEditingLabel ? (
            <div className="flex items-center gap-2">
                <Input value={label} onChange={handleLabelChange} className="text-sm h-7" autoFocus onBlur={handleLabelSave} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLabelSave()} />
                <Button size="sm" onClick={handleLabelSave} className="h-7">Salvar</Button>
            </div>
        ) : (
            <CardTitle className="text-sm font-semibold flex items-center cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                <DatabaseZap className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                {data.label || 'Dados Externos'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-emerald-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-96">
        <ScrollArea className="h-80 pr-3">
            <div><Label htmlFor={`ds-url-${id}`} className="text-xs">URL da Fonte de Dados *</Label><Input id={`ds-url-${id}`} value={dataSourceUrl} onChange={handleUrlChange} placeholder="https://api.minhafonte.com/dados" className="mt-1 neu-input"/></div>
            <div>
                <Label htmlFor={`ds-req-type-${id}`} className="text-xs">Tipo de Requisição *</Label>
                <Select value={requestType} onValueChange={handleRequestTypeChange}>
                    <SelectTrigger id={`ds-req-type-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {requestType === 'POST' && (
                <div><Label htmlFor={`ds-payload-${id}`} className="text-xs">Payload da Requisição (JSON)</Label><Textarea id={`ds-payload-${id}`} value={requestPayload} onChange={handlePayloadChange} placeholder='{ "filtro": "valor" }' className="mt-1 neu-input" rows={3}/></div>
            )}
             <div className="space-y-1 border-t pt-2 mt-2">
                <div className="flex justify-between items-center"><Label className="text-xs">Mapeamento da Resposta para Variáveis</Label><Button variant="link" size="xs" onClick={addMapping}><PlusCircle className="h-3 w-3 mr-1"/>Add Mapeamento</Button></div>
                {responseMapping.map((mapItem: ApiResponseMapping, index: number) => ( // Tipado mapItem
                    <div key={mapItem.id || index} className="flex items-center gap-1">
                        <Input value={mapItem.sourcePath} onChange={(e: ChangeEvent<HTMLInputElement>) => handleMappingChange(index, 'sourcePath', e.target.value)} placeholder="Caminho JSON (Ex: $.user.id)" className="neu-input text-xs h-7"/>
                        <Input value={mapItem.targetVariable} onChange={(e: ChangeEvent<HTMLInputElement>) => handleMappingChange(index, 'targetVariable', e.target.value)} placeholder="Nome Variável (Ex: id_usuario_api)" className="neu-input text-xs h-7"/>
                        <Button variant="ghost" size="icon" onClick={() => removeMapping(index)} className="h-7 w-7 text-destructive"><XCircle className="h-3 w-3"/></Button>
                    </div>
                ))}
            </div>
        </ScrollArea>
      </CardContent>

      {handlesToRender.map((handleItem: HandleData) => (
        <Handle
          key={handleItem.id}
          id={handleItem.id}
          type={handleItem.type}
          position={handleItem.position}
          isConnectable={true}
          style={{
