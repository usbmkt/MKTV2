// zap/client/src/components/whatsapp_features/ZapFlowsList.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@zap_client/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Badge } from '@zap_client/components/ui/badge';
import { Input } from '@zap_client/components/ui/input';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@zap_client/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@zap_client/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@zap_client/components/ui/dropdown-menu';
import { apiRequest } from '@zap_client/lib/api';
import { Loader2, Plus, Edit, Trash2, Play, Pause, Bot, AlertTriangle, Settings, ChevronRight, Puzzle, MoreVertical } from 'lucide-react';
import { type FlowElementData } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';
import { z } from 'zod'; // Para validação de formulário opcional
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Tipos do schema do Zap
type ZapFlowTriggerType = 'keyword' | 'first_message' | 'button_click' | 'api_call' | 'scheduled';
type ZapFlowStatus = 'draft' | 'active' | 'inactive' | 'archived';

interface ZapFlow {
  id: number;
  mktv2UserId: number;
  name: string;
  description?: string | null;
  triggerType: ZapFlowTriggerType;
  triggerConfig: Record<string, any>;
  status: ZapFlowStatus;
  elements?: FlowElementData; // Pode ser opcional na listagem
  createdAt: string;
  updatedAt: string;
  analytics?: { // Mockado no backend por enquanto
    totalUsers: number;
    completionRate: number;
    avgTime: string;
  };
}

const flowFormSchema = z.object({
  name: z.string().min(3, { message: "Nome do fluxo deve ter pelo menos 3 caracteres." }),
  description: z.string().optional(),
  triggerType: z.enum(['keyword', 'first_message', 'button_click', 'api_call', 'scheduled']),
  triggerConfigValue: z.string().optional(), // Para 'keyword' e outros simples
  // Adicionar validações mais complexas para triggerConfig se necessário
});
type FlowFormData = z.infer<typeof flowFormSchema>;


interface ZapFlowsListProps {
    onEditFlowStructure?: (flowId: number, flowName: string) => void; // Callback para abrir o editor
}

const ZapFlowsList: React.FC<ZapFlowsListProps> = ({ onEditFlowStructure }) => {
  const queryClientHook = useQueryClient();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ZapFlow | null>(null);

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FlowFormData>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: { name: '', description: '', triggerType: 'keyword', triggerConfigValue: '' }
  });
  const watchedTriggerType = watch("triggerType");


  const { data: flows = [], isLoading: isLoadingFlows, error: flowsError } = useQuery<ZapFlow[], ApiError>({
    queryKey: ['zapFlows'],
    queryFn: () => apiRequest({ url: '/whatsapp/flows', method: 'GET' }),
    placeholderData: [],
  });

  const flowMutation = useMutation<ZapFlow, ApiError, { id?: number, data: FlowFormData }>({
    mutationFn: async ({ id, data }) => {
      const method = id ? 'PUT' : 'POST';
      const endpoint = id ? `/whatsapp/flows/${id}` : '/whatsapp/flows';
      
      let triggerConfig: Record<string, any> = {};
      if (data.triggerType === 'keyword' && data.triggerConfigValue) {
        triggerConfig = { keyword: data.triggerConfigValue };
      }
      // Adicionar outras lógicas de triggerConfig aqui

      const payload = {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: triggerConfig,
        status: editingFlow?.status || 'draft', // Mantém status ou default para novo
      };
      return apiRequest({ url: endpoint, method, data: payload });
    },
    onSuccess: (savedFlow) => {
      queryClientHook.invalidateQueries({ queryKey: ['zapFlows'] });
      setIsFormModalOpen(false);
      setEditingFlow(null);
      // TODO: Exibir toast de sucesso
      console.log(`Flow ${savedFlow.name} ${editingFlow ? 'atualizado' : 'criado'}.`);
      if (!editingFlow && onEditFlowStructure) { // Se for novo e houver callback
        onEditFlowStructure(savedFlow.id, savedFlow.name);
      }
    },
    onError: (error) => {
      console.error("Erro ao salvar fluxo:", error.message);
      // TODO: Exibir toast de erro (ex: usando o hook useToast do shadcn)
    }
  });

  const statusMutation = useMutation<ZapFlow, ApiError, { id: number; status: ZapFlowStatus }>({
    mutationFn: ({ id, status }) => apiRequest({ url: `/whatsapp/flows/${id}/status`, method: 'PATCH', data: { status } }),
    onSuccess: () => queryClientHook.invalidateQueries({ queryKey: ['zapFlows'] }),
    onError: (error) => console.error("Erro ao mudar status:", error.message)
  });

  const deleteFlowMutation = useMutation<void, ApiError, number>({
    mutationFn: (id) => apiRequest({ url: `/whatsapp/flows/${id}`, method: 'DELETE' }),
    onSuccess: () => queryClientHook.invalidateQueries({ queryKey: ['zapFlows'] }),
    onError: (error) => console.error("Erro ao deletar fluxo:", error.message)
  });

  const handleOpenFormModal = (flow?: ZapFlow) => {
    setEditingFlow(flow || null);
    reset({ // Resetar form com valores do flow ou default
      name: flow?.name || '',
      description: flow?.description || '',
      triggerType: flow?.triggerType || 'keyword',
      triggerConfigValue: flow?.triggerConfig?.keyword || (flow?.triggerType === 'keyword' && typeof flow?.triggerConfig === 'string' ? flow.triggerConfig : '')
    });
    setIsFormModalOpen(true);
  };
  
  const onFormSubmit = (data: FlowFormData) => {
    flowMutation.mutate({ id: editingFlow?.id, data });
  };

  const toggleFlowStatus = (flow: ZapFlow) => {
    const newStatus = flow.status === 'active' ? 'inactive' : 'active';
    statusMutation.mutate({ id: flow.id, status: newStatus });
  };

  const handleDeleteFlow = (flowId: number) => {
    if (window.confirm("Tem certeza que deseja excluir este fluxo? As automações associadas pararão de funcionar.")) {
      deleteFlowMutation.mutate(flowId);
    }
  };
  
  const getStatusBadgeVariant = (status: ZapFlowStatus): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    if (status === 'active') return 'success';
    if (status === 'inactive') return 'warning';
    return 'secondary';
  };

  const triggerTypeLabels: Record<ZapFlowTriggerType, string> = {
    keyword: "Palavra-chave",
    first_message: "Primeira Mensagem",
    button_click: "Clique em Botão",
    api_call: "Chamada de API",
    scheduled: "Agendado"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Meus Fluxos Automatizados</h2>
        <Button onClick={() => handleOpenFormModal()} className="neu-button">
          <Plus className="w-4 h-4 mr-2" /> Criar Novo Fluxo
        </Button>
      </div>

      {isLoadingFlows && <div className="text-center p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> Carregando fluxos...</div>}
      {flowsError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Erro!</AlertTitle><AlertDescription>{flowsError.message}</AlertDescription></Alert>}
      
      {!isLoadingFlows && flows.length === 0 && !flowsError && (
        <Card className="text-center py-12 neu-card">
          <CardContent className="flex flex-col items-center">
            <Bot className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Nenhum fluxo criado ainda.</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro fluxo para automatizar suas conversas!</p>
            <Button onClick={() => handleOpenFormModal()} className="neu-button-primary">
              <Plus className="w-4 h-4 mr-2" /> Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows.map((flow) => (
          <Card key={flow.id} className="flex flex-col neu-card hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold leading-tight line-clamp-2 text-foreground">{flow.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 neu-button"><MoreVertical className="w-4 h-4"/></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEditFlowStructure && <DropdownMenuItem onClick={() => onEditFlowStructure(flow.id, flow.name)} className="text-xs">
                        <Puzzle className="mr-2 h-3.5 w-3.5"/>Abrir Editor Visual
                    </DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => handleOpenFormModal(flow)} className="text-xs">
                        <Settings className="mr-2 h-3.5 w-3.5"/>Editar Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleFlowStatus(flow)} className="text-xs">
                      {flow.status === 'active' ? <Pause className="mr-2 h-3.5 w-3.5"/> : <Play className="mr-2 h-3.5 w-3.5"/>}
                      {flow.status === 'active' ? 'Desativar' : 'Ativar'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={() => handleDeleteFlow(flow.id)} className="text-destructive focus:text-destructive text-xs">
                        <Trash2 className="mr-2 h-3.5 w-3.5"/>Excluir Fluxo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription className="text-xs line-clamp-2 mt-1">{flow.description || 'Sem descrição.'}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2 flex-grow">
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Gatilho:</span> <Badge variant="outline" className="font-normal">{triggerTypeLabels[flow.triggerType] || flow.triggerType}</Badge></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Status:</span> <Badge variant={getStatusBadgeVariant(flow.status)} className="font-semibold">{flow.status}</Badge></div>
              {flow.analytics && (
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Execuções:</span> <span className="font-medium">{flow.analytics.totalUsers}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Conclusão:</span> <span className="font-medium">{flow.analytics.completionRate}%</span></div>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-3 border-t">
                {onEditFlowStructure ? (
                    <Button variant="outline" size="sm" className="w-full neu-button" onClick={() => onEditFlowStructure(flow.id, flow.name)}>
                        Editar Estrutura <ChevronRight className="w-3.5 h-3.5 ml-1"/>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="w-full neu-button" disabled>
                        Editor Indisponível
                    </Button>
                )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isFormModalOpen} onOpenChange={(open) => { setIsFormModalOpen(open); if (!open) setEditingFlow(null); }}>
        <DialogContent className="sm:max-w-lg neu-card p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl">{editingFlow ? 'Editar Metadados do Fluxo' : 'Criar Novo Fluxo'}</DialogTitle>
            <DialogDescription>Defina nome, descrição e o gatilho principal para seu fluxo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <Label htmlFor="flow-name">Nome do Fluxo*</Label>
                <Input id="flow-name" {...register("name")} placeholder="Ex: Boas-vindas Cliente VIP" className="neu-input mt-1"/>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="flow-description">Descrição</Label>
                <Textarea id="flow-description" {...register("description")} placeholder="Descreva o objetivo deste fluxo." rows={3} className="neu-input mt-1"/>
              </div>
              <div>
                <Label htmlFor="flow-triggerType">Tipo de Gatilho*</Label>
                <Controller
                    name="triggerType"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="flow-triggerType" className="neu-input mt-1">
                                <SelectValue placeholder="Selecione um gatilho" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="keyword">Palavra-chave</SelectItem>
                                <SelectItem value="first_message">Primeira Mensagem</SelectItem>
                                <SelectItem value="button_click">Clique em Botão</SelectItem>
                                <SelectItem value="api_call">Chamada de API</SelectItem>
                                <SelectItem value="scheduled">Agendado</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.triggerType && <p className="text-xs text-destructive mt-1">{errors.triggerType.message}</p>}
              </div>
              {watchedTriggerType === 'keyword' && (
                <div>
                  <Label htmlFor="flow-triggerConfigValue">Palavra(s)-chave*</Label>
                  <Input id="flow-triggerConfigValue" {...register("triggerConfigValue")} placeholder="Ex: !oferta, promoção, ajuda" className="neu-input mt-1"/>
                  {errors.triggerConfigValue && <p className="text-xs text-destructive mt-1">{errors.triggerConfigValue.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Separe múltiplas palavras por vírgula. O fluxo será ativado se a mensagem contiver alguma delas.</p>
                </div>
              )}
              {/* TODO: Adicionar inputs para outras triggerConfig (ex: ID do botão, URL da API, cron schedule) */}
            </div>
            <DialogFooter className="p-4 border-t bg-muted/30">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="neu-button">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={flowMutation.isPending} className="neu-button-primary">
                {flowMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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