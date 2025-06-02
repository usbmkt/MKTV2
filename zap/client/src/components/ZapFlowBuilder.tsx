// zap/client/src/components/ZapFlowBuilder.tsx
// ... (importações como antes)
import ApiCallNode, { type ApiCallNodeData } from './flow_builder_nodes/ApiCallNode'; // Importado

// Configuração dos tipos de nós disponíveis na paleta e para o React Flow
export const availableNodeTypesConfig = [
    // ... (nós anteriores como triggerNode, textMessageNode, conditionNode)
    { type: 'apiCallNode', label: 'Chamada de API', icon: CloudCog, group: 'IA & Externo', defaultData: { label: 'Requisição HTTP', method: 'GET', url: 'https://api.example.com/data', headers:'{}', body:'{}', saveResponseTo: 'apiResult' }, inputs: 1, outputs: 2 }, // Saídas para sucesso/falha
    // ... (outros tipos de nós como endNode)
];

// Mapeamento para o React Flow
const nodeTypes: NodeTypes = {
  textMessageNode: TextMessageNode,
  conditionNode: ConditionNode,
  apiCallNode: ApiCallNode, // Adicionado
  // ... (outros nós e placeholders como antes)
};

// Dentro do ZapFlowBuilderInternal:
// ... (state, queries, mutations, handlers como antes) ...

// ATENÇÃO: Modificar o painel de propriedades para incluir a configuração do ApiCallNode:
// Dentro do return do ZapFlowBuilderInternal, na seção do Painel de Propriedades:
// if (selectedNodeForEdit) { ...
//   {selectedNodeForEdit.type === 'textMessageNode' && ( ... )}
//   {selectedNodeForEdit.type === 'conditionNode' && ( ... )}
//   {selectedNodeForEdit.type === 'apiCallNode' && (
//     <div className="space-y-2 border-t pt-3 mt-3">
//         <h5 className="text-xs font-medium text-muted-foreground">Configurar Chamada de API</h5>
//         <div>
//             <Label htmlFor="node-api-method" className="text-xs">Método HTTP*</Label>
//             <Select value={(selectedNodeForEdit.data as ApiCallNodeData).method || 'GET'} onValueChange={(val) => handleNodeDataChange('method', val as ApiCallNodeData['method'])}>
//                 <SelectTrigger id="node-api-method" className="h-8 text-xs neu-input mt-1"><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                     <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
//                     <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
//                     <SelectItem value="PATCH">PATCH</SelectItem>
//                 </SelectContent>
//             </Select>
//         </div>
//         <div>
//             <Label htmlFor="node-api-url" className="text-xs">URL do Endpoint*</Label>
//             <Input id="node-api-url" value={(selectedNodeForEdit.data as ApiCallNodeData).url || ''} onChange={(e) => handleNodeDataChange('url', e.target.value)} placeholder="https://..." className="h-8 text-xs neu-input mt-1" />
//         </div>
//         <div>
//             <Label htmlFor="node-api-headers" className="text-xs">Cabeçalhos (JSON)</Label>
//             <Textarea id="node-api-headers" value={(selectedNodeForEdit.data as ApiCallNodeData).headers || '{}'} onChange={(e) => handleNodeDataChange('headers', e.target.value)} placeholder='{ "Authorization": "Bearer ..." }' rows={3} className="text-xs neu-input mt-1 font-mono" />
//         </div>
//         {( (selectedNodeForEdit.data as ApiCallNodeData).method === 'POST' || (selectedNodeForEdit.data as ApiCallNodeData).method === 'PUT' || (selectedNodeForEdit.data as ApiCallNodeData).method === 'PATCH' ) && (
//             <div>
//                 <Label htmlFor="node-api-body" className="text-xs">Corpo da Requisição (JSON)</Label>
//                 <Textarea id="node-api-body" value={(selectedNodeForEdit.data as ApiCallNodeData).body || '{}'} onChange={(e) => handleNodeDataChange('body', e.target.value)} placeholder='{ "key": "value" }' rows={4} className="text-xs neu-input mt-1 font-mono" />
//             </div>
//         )}
//         <div>
//             <Label htmlFor="node-api-saveResponseTo" className="text-xs">Salvar Resposta na Variável</Label>
//             <Input id="node-api-saveResponseTo" value={(selectedNodeForEdit.data as ApiCallNodeData).saveResponseTo || ''} onChange={(e) => handleNodeDataChange('saveResponseTo', e.target.value)} placeholder="Ex: resultadoApi" className="h-8 text-xs neu-input mt-1" />
//             <p className="text-xxs text-muted-foreground mt-0.5">O corpo da resposta (JSON) será salvo nesta variável.</p>
//         </div>
//          <p className="text-xxs text-muted-foreground mt-2 border-t pt-2">
//             Este nó terá duas saídas: "success" (código 2xx) e "failure" (outros códigos ou erro de rede).
//         </p>
//     </div>
//   )}
// ... (restante do painel de propriedades e do componente)
// }