// zap/client/src/components/whatsapp_features/ZapFlowsList.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Badge } from '@zap_client/components/ui/badge';
import { Input } from '@zap_client/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@zap_client/components/ui/dialog';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { PlusCircle, Edit, Trash2, Search, Bot, Play, Settings, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@zap_client/hooks/use-toast'; // Certifique-se que os arquivos de toast estão em zap/client/...
import { ApiError, FlowElementData } from '@zap_client/features/types/whatsapp_flow_types'; // Importado

// Interface para as props do componente
export interface ZapFlowsListProps {
  onSelectFlow: (flowId: string, flowName: string) => void;
  onEditFlow: (flowId: string, flowName: string) => void; // Para editar metadados ou abrir no editor
}

// Funções da API (simuladas - substitua por chamadas reais)
const fetchFlows = async (): Promise<FlowElementData[]> => {
  console.log("Fetching flows (mocked)...");
  await new Promise(resolve => setTimeout(resolve, 700));
  // Exemplo de dados mockados
  return [
    { id: 'flow_1', name: 'Boas Vindas Cliente', description: 'Fluxo inicial para novos clientes.', triggerType: 'keyword', status: 'active', lastEdited: '2024-05-28' },
    { id: 'flow_2', name: 'Recuperação de Carrinho', description: 'Envia lembretes para carrinhos abandonados.', triggerType: 'webhook', status: 'inactive', lastEdited: '2024-05-25' },
    { id: 'flow_3', name: 'Suporte Nível 1', description: 'Primeiro atendimento para dúvidas comuns.', triggerType: 'manual', status: 'draft', lastEdited: '2024-05-29' },
  ];
};

const createFlow = async (flowData: Omit<FlowElementData, 'id' | 'lastEdited'>): Promise<FlowElementData> => {
  console.log("Creating flow (mocked):", flowData);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { ...flowData, id: `flow_${Date.now()}`, lastEdited: new Date().toISOString(), status: flowData.status || 'draft' };
};

const updateFlow = async (flowId: string, flowData: Partial<Omit<FlowElementData, 'id' | 'lastEdited'>>): Promise<FlowElementData> => {
    console.log("Updating flow (mocked):", flowId, flowData);
    await new Promise(resolve => setTimeout(resolve, 500));
    // Simula a atualização
    const updatedFlow = { 
        id: flowId, 
        name: flowData.name || "Nome Antigo",
        description: flowData.description,
        triggerType: flowData.triggerType,
        status: flowData.status,
        lastEdited: new Date().toISOString() 
    };
    return updatedFlow as FlowElementData;
};

const deleteFlowApi = async (flowId: string): Promise<void> => {
  console.log("Deleting flow (mocked):", flowId);
  await new Promise(resolve => setTimeout(resolve, 500));
};


const ZapFlowsList: React.FC<ZapFlowsListProps> = ({ onSelectFlow, onEditFlow }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowElementData | null>(null);
  const [newFlowData, setNewFlowData] = useState<Partial<Omit<FlowElementData, 'id' | 'lastEdited'>>>({
    name: '', description: '', triggerType: 'manual', status: 'draft'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: flows = [], isLoading, error } = useQuery<FlowElementData[], ApiError>({
    queryKey: ['zapFlows'],
    queryFn: fetchFlows,
  });

  const mutationConfig = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapFlows'] });
      setIsModalOpen(false);
      setEditingFlow(null);
      setNewFlowData({ name: '', description: '', triggerType: 'manual', status: 'draft' });
    },
    onError: (err: ApiError) => {
      toast({ title: "Erro", description: err.message || "Ocorreu um erro inesperado.", variant: "destructive" });
    }
  };

  const createFlowMutation = useMutation<FlowElementData, ApiError, Omit<FlowElementData, 'id' | 'lastEdited'>>({
    mutationFn: createFlow,
    ...mutationConfig,
    onSuccess: (...args) => {
        mutationConfig.onSuccess();
        toast({ title: "Fluxo criado com sucesso!", variant: "default" });
    }
  });

  const updateFlowMutation = useMutation<FlowElementData, ApiError, { flowId: string; data: Partial<Omit<FlowElementData, 'id' | 'lastEdited'>> }>({
    mutationFn: (variables) => updateFlow(variables.flowId, variables.data),
    ...mutationConfig,
     onSuccess: (...args) => {
        mutationConfig.onSuccess();
        toast({ title: "Fluxo atualizado com sucesso!", variant: "default" });
    }
  });
  
  const deleteFlowMutation = useMutation<void, ApiError, string>({
    mutationFn: deleteFlowApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapFlows'] });
      toast({ title: "Fluxo excluído!", variant: "default" });
    },
    onError: (err: ApiError) => {
      toast({ title: "Erro ao excluir fluxo", description: err.message, variant: "destructive" });
    }
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewFlowData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setNewFlowData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newFlowData.name?.trim()) {
      toast({ title: "Erro de Validação", description: "O nome do fluxo é obrigatório.", variant: "destructive" });
      return;
    }
    if (editingFlow) {
      updateFlowMutation.mutate({ flowId: editingFlow.id, data: newFlowData });
    } else {
      createFlowMutation.mutate(newFlowData as Omit<FlowElementData, 'id' | 'lastEdited'>);
    }
  };

  const openModalToEdit = (flow: FlowElementData) => {
    setEditingFlow(flow);
    setNewFlowData({
        name: flow.name,
        description: flow.description,
        triggerType: flow.triggerType,
        status: flow.status
    });
    setIsModalOpen(true);
  };

  const openModalToCreate = () => {
    setEditingFlow(null);
    setNewFlowData({ name: '', description: '', triggerType: 'manual', status: 'draft' });
    setIsModalOpen(true);
  };


  const filteredFlows = flows.filter(flow =>
    flow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flow.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Carregando fluxos...</div>;
  if (error) return <div className="p-4 text-center text-destructive"><AlertTriangle className="w-6 h-6 mx-auto mb-2"/>Erro ao carregar fluxos: {error.message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Meus Fluxos de Automação</h2>
        <Button onClick={openModalToCreate} className="neu-button">
          <PlusCircle className="w-4 h-4 mr-2" /> Criar Novo Fluxo
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar fluxos por nome ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 neu-input"
        />
      </div>

      {filteredFlows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Bot className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p>Nenhum fluxo encontrado. Que tal criar um novo?</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlows.map((flow) => (
            <Card key={flow.id} className="neu-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-semibold truncate">{flow.name}</CardTitle>
                  <Badge variant={flow.status === 'active' ? 'default' : 'outline'} className={flow.status === 'active' ? 'bg-green-500 text-white' : ''}>
                    {flow.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs truncate">{flow.description || 'Sem descrição.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p><strong>Gatilho:</strong> <span className="text-muted-foreground">{flow.triggerType || 'N/A'}</span></p>
                <p><strong>Última Edição:</strong> <span className="text-muted-foreground">{flow.lastEdited ? new Date(flow.lastEdited).toLocaleDateString() : 'N/A'}</span></p>
                <div className="flex space-x-2 mt-3 pt-3 border-t">
                  <Button variant="outline" size="sm" className="text-xs flex-1 neu-button" onClick={() => onSelectFlow(flow.id, flow.name)}>
                    <Play className="w-3 h-3 mr-1.5" /> Abrir no Editor
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs px-2 neu-button" onClick={() => openModalToEdit(flow)}>
                    <Settings className="w-3 h-3 mr-1.5" /> Config
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs px-2 text-destructive hover:bg-destructive/10 neu-button" onClick={() => deleteFlowMutation.mutate(flow.id)} disabled={deleteFlowMutation.isPending}>
                    <Trash2 className="w-3 h-3 mr-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFlow ? 'Editar Fluxo' : 'Criar Novo Fluxo'}</DialogTitle>
            <DialogDescription>
              {editingFlow ? `Modificando o fluxo "${editingFlow.name}".` : 'Preencha os detalhes para criar um novo fluxo de automação.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="flow-name">Nome do Fluxo*</Label>
              <Input id="flow-name" name="name" value={newFlowData.name || ''} onChange={handleInputChange} placeholder="Ex: Boas-vindas Automático" className="neu-input" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flow-description">Descrição</Label>
              <Textarea id="flow-description" name="description" value={newFlowData.description || ''} onChange={handleInputChange} placeholder="Descreva o objetivo deste fluxo..." className="neu-input" rows={3}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                <Label htmlFor="flow-triggerType">Tipo de Gatilho</Label>
                <Select name="triggerType" value={newFlowData.triggerType || 'manual'} onValueChange={(value) => handleSelectChange('triggerType', value)}>
                    <SelectTrigger id="flow-triggerType" className="neu-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="keyword">Palavra-chave</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    {/* Adicione mais tipos de gatilho */}
                    </SelectContent>
                </Select>
                </div>
                <div className="space-y-1">
                <Label htmlFor="flow-status">Status</Label>
                <Select name="status" value={newFlowData.status || 'draft'} onValueChange={(value) => handleSelectChange('status', value as FlowElementData['status'])}>
                    <SelectTrigger id="flow-status" className="neu-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={createFlowMutation.isPending || updateFlowMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" className="neu-button-primary" disabled={createFlowMutation.isPending || updateFlowMutation.isPending}>
                {(createFlowMutation.isPending || updateFlowMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingFlow ? 'Salvar Alterações' : 'Criar Fluxo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZapFlowsList;
