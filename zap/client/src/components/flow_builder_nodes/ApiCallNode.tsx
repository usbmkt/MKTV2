import React, { memo, useState, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Handle, Position, useReactFlow, NodeToolbar, NodeProps as ReactFlowNodeProps } from '@xyflow/react';
import { ApiCallNodeData, FlowNodeType, HandleData, ApiHeader, ApiQueryParam, ApiResponseMapping } from '@zap_client/features/types/whatsapp_flow_types';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Button } from '@zap_client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Webhook, Trash2, Edit3, PlusCircle, XCircle } from 'lucide-react';
import { cn } from '@zap_client/lib/utils';
import { Badge } from '@zap_client/components/ui/badge';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';


const defaultHandles: HandleData[] = [
  { id: 'input', type: 'target', position: Position.Left, label: 'Entrada', style: {top: '50%'} },
  { id: 'output_success', type: 'source', position: Position.Right, label: 'Sucesso', style: {top: '35%'} },
  { id: 'output_error', type: 'source', position: Position.Right, label: 'Erro', style: {top: '65%'} },
];

const httpMethods: ApiCallNodeData['method'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const ApiCallNodeComponent: React.FC<ReactFlowNodeProps<ApiCallNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();

  const [label, setLabel] = useState<string>(data.label || 'Chamada API');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [apiUrl, setApiUrl] = useState<string>(data.apiUrl || '');
  const [method, setMethod] = useState<ApiCallNodeData['method']>(data.method || 'GET');
  const [headers, setHeaders] = useState<ApiHeader[]>(data.headers || []);
  const [queryParams, setQueryParams] = useState<ApiQueryParam[]>(data.queryParams || []);
  const [body, setBody] = useState<string>(data.body || ''); // Armazenar como string JSON
  const [variableToStoreResponse, setVariableToStoreResponse] = useState<string>(data.variableToStoreResponse || '');
  const [responsePath, setResponsePath] = useState<string>(data.responsePath || '');
  const [responseMappings, setResponseMappings] = useState<ApiResponseMapping[]>(data.responseMappings || []);

  useEffect(() => {
    setLabel(data.label || 'Chamada API');
    setApiUrl(data.apiUrl || '');
    setMethod(data.method || 'GET');
    setHeaders(data.headers || []);
    setQueryParams(data.queryParams || []);
    setBody(typeof data.body === 'string' ? data.body : (data.body ? JSON.stringify(data.body, null, 2) : ''));
    setVariableToStoreResponse(data.variableToStoreResponse || '');
    setResponsePath(data.responsePath || '');
    setResponseMappings(data.responseMappings || []);
  }, [data]);

  const updateNodeDataCallback = useCallback(
    (newData: Partial<ApiCallNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const currentData = node.data as ApiCallNodeData;
            // Se o body for um objeto, converter para string JSON antes de salvar nos dados do nó
            let processedNewData = { ...newData };
            if (newData.body && typeof newData.body !== 'string') {
                try {
                    processedNewData.body = JSON.stringify(newData.body, null, 2);
                } catch (e) {
                    console.error("Erro ao serializar body para JSON:", e);
                    // Manter como está ou tratar o erro
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
    updateNodeDataCallback({ label });
    setIsEditingLabel(false);
  };

  const handleGenericInputChange = (field: keyof ApiCallNodeData, value: string | ApiCallNodeData['method']) => {
    if (field === 'body') {
        setBody(value as string); // O Textarea já fornece string
        updateNodeDataCallback({ body: value as string });
    } else {
        (field === 'apiUrl') && setApiUrl(value as string);
        (field === 'method') && setMethod(value as ApiCallNodeData['method']);
        (field === 'variableToStoreResponse') && setVariableToStoreResponse(value as string);
        (field === 'responsePath') && setResponsePath(value as string);
        updateNodeDataCallback({ [field]: value });
    }
  };

  const createNewItem = (type: 'header' | 'queryParam' | 'responseMapping'): ApiHeader | ApiQueryParam | ApiResponseMapping => {
    const newItemId = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    if (type === 'header') return { id: newItemId, key: '', value: '' };
    if (type === 'queryParam') return { id: newItemId, key: '', value: '' };
    // if (type === 'responseMapping')
    return { id: newItemId, sourcePath: '', targetVariable: '' };
  };

  const handleArrayItemChange = (
    index: number, 
    field: keyof ApiHeader | keyof ApiQueryParam | keyof ApiResponseMapping, 
    value: string, 
    arrayType: 'headers' | 'queryParams' | 'responseMappings'
  ) => {
    let newArray: any[];
    if (arrayType === 'headers') newArray = [...headers];
    else if (arrayType === 'queryParams') newArray = [...queryParams];
    else newArray = [...responseMappings];

    (newArray[index] as any)[field] = value;

    if (arrayType === 'headers') setHeaders(newArray as ApiHeader[]);
    else if (arrayType === 'queryParams') setQueryParams(newArray as ApiQueryParam[]);
    else setResponseMappings(newArray as ApiResponseMapping[]);
    
    updateNodeDataCallback({ [arrayType]: newArray });
  };

  const addArrayItem = (arrayType: 'headers' | 'queryParams' | 'responseMappings') => {
    if (arrayType === 'headers') {
        const newHeaders = [...headers, createNewItem('header') as ApiHeader];
        setHeaders(newHeaders); updateNodeDataCallback({ headers: newHeaders });
    } else if (arrayType === 'queryParams') {
        const newParams = [...queryParams, createNewItem('queryParam') as ApiQueryParam];
        setQueryParams(newParams); updateNodeDataCallback({ queryParams: newParams });
    } else {
        const newMappings = [...responseMappings, createNewItem('responseMapping') as ApiResponseMapping];
        setResponseMappings(newMappings); updateNodeDataCallback({ responseMappings: newMappings });
    }
  };

  const removeArrayItem = (indexToRemove: number, arrayType: 'headers' | 'queryParams' | 'responseMappings') => {
    let newArray: any[];
    if (arrayType === 'headers') {
        newArray = headers.filter((_: ApiHeader, i: number) => i !== indexToRemove);
        setHeaders(newArray as ApiHeader[]);
    } else if (arrayType === 'queryParams') {
        newArray = queryParams.filter((_: ApiQueryParam, i: number) => i !== indexToRemove);
        setQueryParams(newArray as ApiQueryParam[]);
    } else {
        newArray = responseMappings.filter((_: ApiResponseMapping, i: number) => i !== indexToRemove);
        setResponseMappings(newArray as ApiResponseMapping[]);
    }
    updateNodeDataCallback({ [arrayType]: newArray });
  };

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter(node => node.id !== id));
  };

  const handlesToRender = data.handles || defaultHandles;

  return (
    <Card className={cn("w-96 shadow-md neu-card", selected && "ring-2 ring-slate-500 ring-offset-2")}>
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
                <Webhook className="h-4 w-4 mr-2 text-slate-600 dark:text-slate-400" />
                {data.label || 'Chamada API'}
            </CardTitle>
        )}
        <Badge variant="default" className="bg-slate-500 text-white capitalize">{data.nodeType.replace('Node', '')}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-96">
        <ScrollArea className="h-80 pr-3">
            <div><Label htmlFor={`api-url-${id}`} className="text-xs">URL da API *</Label><Input id={`api-url-${id}`} value={apiUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('apiUrl', e.target.value)} placeholder="https://api.example.com/data" className="mt-1 neu-input"/></div>
            <div>
                <Label htmlFor={`api-method-${id}`} className="text-xs">Método HTTP *</Label>
                <Select value={method} onValueChange={(value: string) => handleGenericInputChange('method', value as ApiCallNodeData['method'])}>
                    <SelectTrigger id={`api-method-${id}`} className="mt-1 neu-input"><SelectValue /></SelectTrigger>
                    <SelectContent>{httpMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            <div className="space-y-1 border-t pt-2 mt-2">
                <div className="flex justify-between items-center"><Label className="text-xs">Headers (Opcional)</Label><Button variant="link" size="xs" onClick={() => addArrayItem('headers')}><PlusCircle className="h-3 w-3 mr-1"/>Add Header</Button></div>
                {headers.map((header: ApiHeader, index: number) => (
                    <div key={header.id || index} className="flex items-center gap-1">
                        <Input value={header.key} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'key', e.target.value, 'headers')} placeholder="Chave (Ex: Authorization)" className="neu-input text-xs h-7"/>
                        <Input value={header.value} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'value', e.target.value, 'headers')} placeholder="Valor (Ex: Bearer token)" className="neu-input text-xs h-7"/>
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem(index, 'headers')} className="h-7 w-7 text-destructive"><XCircle className="h-3 w-3"/></Button>
                    </div>
                ))}
            </div>
             <div className="space-y-1 border-t pt-2 mt-2">
                <div className="flex justify-between items-center"><Label className="text-xs">Query Params (Opcional)</Label><Button variant="link" size="xs" onClick={() => addArrayItem('queryParams')}><PlusCircle className="h-3 w-3 mr-1"/>Add Param</Button></div>
                {queryParams.map((param: ApiQueryParam, index: number) => (
                    <div key={param.id || index} className="flex items-center gap-1">
                        <Input value={param.key} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'key', e.target.value, 'queryParams')} placeholder="Chave (Ex: userId)" className="neu-input text-xs h-7"/>
                        <Input value={param.value} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'value', e.target.value, 'queryParams')} placeholder="Valor (Ex: 123)" className="neu-input text-xs h-7"/>
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem(index, 'queryParams')} className="h-7 w-7 text-destructive"><XCircle className="h-3 w-3"/></Button>
                    </div>
                ))}
            </div>

            {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
                <div><Label htmlFor={`api-body-${id}`} className="text-xs">Corpo da Requisição (JSON)</Label><Textarea id={`api-body-${id}`} value={body} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleGenericInputChange('body', e.target.value)} placeholder='{ "chave": "valor", "user": "{{user_id}}" }' className="mt-1 neu-input" rows={3}/></div>
            )}
            
            <div><Label htmlFor={`api-store-var-${id}`} className="text-xs">Salvar Resposta Completa na Variável (Opcional)</Label><Input id={`api-store-var-${id}`} value={variableToStoreResponse} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('variableToStoreResponse', e.target.value)} placeholder="Ex: dados_api" className="mt-1 neu-input"/></div>
            <div><Label htmlFor={`api-resp-path-${id}`} className="text-xs">Extrair de JSONPath da Resposta (Opcional)</Label><Input id={`api-resp-path-${id}`} value={responsePath} onChange={(e: ChangeEvent<HTMLInputElement>) => handleGenericInputChange('responsePath', e.target.value)} placeholder="Ex: $.data.token (para var acima)" className="mt-1 neu-input"/></div>
            
            <div className="space-y-1 border-t pt-2 mt-2">
                <div className="flex justify-between items-center"><Label className="text-xs">Mapear Resposta para Variáveis (Opcional)</Label><Button variant="link" size="xs" onClick={() => addArrayItem('responseMappings')}><PlusCircle className="h-3 w-3 mr-1"/>Add Mapping</Button></div>
                {responseMappings.map((map: ApiResponseMapping, index: number) => (
                    <div key={map.id || index} className="flex items-center gap-1">
                        <Input value={map.sourcePath} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'sourcePath', e.target.value, 'responseMappings')} placeholder="Caminho JSON (Ex: $.user.id)" className="neu-input text-xs h-7"/>
                        <Input value={map.targetVariable} onChange={(e: ChangeEvent<HTMLInputElement>) => handleArrayItemChange(index, 'targetVariable', e.target.value, 'responseMappings')} placeholder="Nome Variável (Ex: id_usuario_api)" className="neu-input text-xs h-7"/>
                        <Button variant="ghost" size="icon" onClick={() => removeArrayItem(index, 'responseMappings')} className="h-7 w-7 text-destructive"><XCircle className="h-3 w-3"/></Button>
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
          style={{ ...handleItem.style, background: '#64748b', width: '10px', height: '10px' }} 
          aria-label={handleItem.label}
        />
      ))}
    </Card>
  );
};

export default memo(ApiCallNodeComponent);
