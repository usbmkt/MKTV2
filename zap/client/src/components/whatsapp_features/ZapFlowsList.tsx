import React, { useState, useEffect, useCallback } from 'react';
import { MoreHorizontal, PlayCircle, PauseCircle, Copy, Trash2, PlusCircle, Search, Loader2, Users, BarChart2, Clock, Zap as BotIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WhatsAppSavedFlow, FlowNodeType, CustomFlowNode } from '@/types/whatsapp_flow_types'; // Atualizado
import { useToast } from '@/hooks/use-toast'; // Atualizado
import { apiRequest } from '@/lib/api'; // Atualizado
import { cn } from '@/lib/utils';

// Mock data (substituir com chamadas de API reais)
const mockFlows: WhatsAppSavedFlow[] = [
  {
    id: 'flow1',
    name: 'Boas Vindas Cliente Novo',
    description: 'Fluxo inicial para novos clientes que entram em contato.',
    status: 'active',
    version: 2,
    triggerKeywords: ['oi', 'olá', 'bom dia'],
    totalUsers: 1520,
    completionRate: 85,
    averageTime: 120, // seconds
    nodes: [], edges: [], // Simplificado para mock
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'flow2',
    name: 'Recuperação de Carrinho',
    description: 'Envia mensagem para clientes que abandonaram o carrinho.',
    status: 'inactive',
    version: 1,
    triggerKeywords: ['carrinho'],
    totalUsers: 340,
    completionRate: 60,
    averageTime: 90,
    nodes: [], edges: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 'flow3',
    name: 'Suporte Nível 1',
    description: 'Fluxo de triagem para dúvidas comuns de suporte.',
    status: 'draft',
    version: 1,
    nodes: [], edges: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  }
];


interface WhatsappFlowsListProps {
  onEditFlow: (flowId: string, flowData?: WhatsAppSavedFlow) => void; // Callback para abrir o editor de fluxo
}

const WhatsappFlowsList: React.FC<WhatsappFlowsListProps> = ({ onEditFlow }) => {
  const [flows, setFlows] = useState<WhatsAppSavedFlow[]>(mockFlows);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Partial<WhatsAppSavedFlow> | null>(null);
  const { toast } = useToast();

  const fetchFlows = useCallback(async () => {
    setIsLoading(true);
    try {
      // const response = await apiRequest('GET', '/api/whatsapp/flows');
      // setFlows(response.data as WhatsAppSavedFlow[]);
      setFlows(mockFlows); // Usando mock por enquanto
    } catch (error) {
      toast({ title: 'Erro ao buscar fluxos', description: String(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingFlow || !editingFlow.name) {
      toast({ title: "Erro", description: "Nome do fluxo é obrigatório.", variant: "destructive" });
      return;
    }

    const flowPayload: Partial<WhatsAppSavedFlow> = {
      ...editingFlow,
      id: editingFlow.id || `flow-${Date.now()}`, // Gerar ID se for novo
      status: editingFlow.status || 'draft',
      nodes: editingFlow.nodes || [], // Default para novo fluxo
      edges: editingFlow.edges || [], // Default para novo fluxo
    };

    try {
      setIsLoading(true);
      if (editingFlow.id && flows.find(f => f.id === editingFlow.id)) { // Check if it's an update by seeing if id exists in current flows
        // await apiRequest('PUT', `/api/whatsapp/flows/${editingFlow.id}`, flowPayload);
        setFlows(prev => prev.map(f => f.id === editingFlow!.id ? { ...f, ...flowPayload } as WhatsAppSavedFlow : f));
        toast({ title: "Fluxo atualizado!", description: `O fluxo "${flowPayload.name}" foi salvo.` });
      } else {
        // const response = await apiRequest('POST', '/api/whatsapp/flows', flowPayload);
        // setFlows(prev => [...prev, response.data as WhatsAppSavedFlow]);
        setFlows(prev => [...prev, flowPayload as WhatsAppSavedFlow]);
        toast({ title: "Fluxo criado!", description: `O fluxo "${flowPayload.name}" foi criado.` });
      }
      setIsFormOpen(false);
      setEditingFlow(null);
    } catch (error) {
      toast({ title: "Erro ao salvar fluxo", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.")) return;
    try {
      setIsLoading(true);
      // await apiRequest('DELETE', `/api/whatsapp/flows/${flowId}`);
      setFlows(prev => prev.filter(f => f.id !== flowId));
      toast({ title: "Fluxo excluído!", variant: "default" });
    } catch (error) {
      toast({ title: "Erro ao excluir fluxo", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicateFlow = async (flow: WhatsAppSavedFlow) => {
     const newFlowData: Partial<WhatsAppSavedFlow> = {
        ...flow,
        id: `flow-copy-${Date.now()}`, // Novo ID
        name: `${flow.name} (Cópia)`,
        status: 'draft',
     };
    try {
      setIsLoading(true);
      // const response = await apiRequest('POST', '/api/whatsapp/flows', newFlowData); // Endpoint de criação
      // setFlows(prev => [...prev, response.data as WhatsAppSavedFlow]);
      setFlows(prev => [...prev, newFlowData as WhatsAppSavedFlow]);
      toast({ title: "Fluxo duplicado!", description: `Fluxo "${newFlowData.name}" criado.` });
    } catch (error) {
      toast({ title: "Erro ao duplicar fluxo", description: String(error), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (flowId: string, newStatus: 'active' | 'inactive' | 'draft' | 'archived') => {
    try {
      setIsLoading(true);
      // await apiRequest('PATCH', `/api/whatsapp/flows/${flowId}/status`, { status: newStatus });
      setFlows(prev => prev.map(f => f.id === flowId ? { ...f, status: newStatus, updatedAt: new Date().toISOString() } : f));
      toast({ title: "Status do fluxo atualizado!", variant: "default" });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingFlow({ name: '', description: '', status: 'draft', triggerKeywords: [] });
    setIsFormOpen(true);
  };
  
  const openEditFormModal = (flow: WhatsAppSavedFlow) => {
    setEditingFlow(flow);
    setIsFormOpen(true);
  };


  const filteredFlows = flows.filter(flow =>
    flow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flow.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading && !flows.length) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-auto">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar fluxos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 neu-input w-full sm:w-64"
          />
        </div>
        <Button onClick={openCreateForm} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
          <PlusCircle className="h-4 w-4 mr-2" /> Novo Fluxo
        </Button>
      </div>

      {filteredFlows.length === 0 && !isLoading ? (
        <div className="text-center py-10">
          <BotIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum fluxo encontrado.</p>
          <p className="text-sm text-muted-foreground">Crie um novo fluxo para começar a automatizar suas conversas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlows.map((flow) => (
            <Card key={flow.id} className="flex flex-col neu-card">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onEditFlow(flow.id, flow)}>
                        <PlayCircle className="h-4 w-4 mr-2" /> Editar no Construtor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditFormModal(flow)}>
                        <Settings2 className="h-4 w-4 mr-2" /> Configurações
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateFlow(flow)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                       {flow.status !== 'active' && <DropdownMenuItem onClick={() => handleUpdateStatus(flow.id, 'active')}><PlayCircle className="h-4 w-4 mr-2 text-green-500" />Ativar</DropdownMenuItem>}
                       {flow.status === 'active' && <DropdownMenuItem onClick={() => handleUpdateStatus(flow.id, 'inactive')}><PauseCircle className="h-4 w-4 mr-2 text-orange-500" />Pausar</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => handleDeleteFlow(flow.id)} className="text-destructive hover:!bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="text-xs line-clamp-2 h-8 mt-1">{flow.description || 'Sem descrição.'}</CardDescription>
                <div className="mt-2">
                    {flow.status === 'active' && <Badge variant="default" className="bg-green-500 hover:bg-green-600">Ativo</Badge>}
                    {flow.status === 'inactive' && <Badge variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white">Pausado</Badge>}
                    {flow.status === 'draft' && <Badge variant="outline">Rascunho</Badge>}
                    {flow.status === 'archived' && <Badge variant="outline" className="bg-gray-500 text-white">Arquivado</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center"><Users className="h-3.5 w-3.5 mr-1.5 text-sky-500" /> Usuários no fluxo:</span>
                  <span className="font-medium text-foreground">{flow.totalUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center"><BarChart2 className="h-3.5 w-3.5 mr-1.5 text-purple-500" /> Taxa de Conclusão:</span>
                  <span className="font-medium text-foreground">{flow.completionRate || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Tempo Médio:</span>
                  <span className="font-medium text-foreground">{flow.averageTime ? `${Math.round(flow.averageTime / 60)} min` : 'N/A'}</span>
                </div>
                {flow.triggerKeywords && flow.triggerKeywords.length > 0 && (
                    <div className="pt-1">
                        <span className="font-medium text-foreground/80">Gatilhos: </span>
                        {flow.triggerKeywords.slice(0,3).map(kw => <Badge key={kw} variant="outline" className="mr-1 text-xs">{kw}</Badge>)}
                        {flow.triggerKeywords.length > 3 && <Badge variant="outline" className="text-xs">...</Badge>}
                    </div>
                )}
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground border-t pt-3">
                Última atualização: {new Date(flow.updatedAt || Date.now()).toLocaleDateString()}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px] neu-card">
          <DialogHeader>
            <DialogTitle>{editingFlow?.id && flows.find(f => f.id === editingFlow.id) ? 'Editar Fluxo' : 'Criar Novo Fluxo'}</DialogTitle>
            <DialogDescription>
              Configure os detalhes básicos do seu fluxo de automação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="flow-name" className="text-right col-span-1">
                  Nome
                </Label>
                <Input
                  id="flow-name"
                  value={editingFlow?.name || ''}
                  onChange={(e) => setEditingFlow(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3 neu-input"
                  placeholder="Ex: Boas Vindas VIP"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="flow-description" className="text-right col-span-1">
                  Descrição
                </Label>
                <Textarea
                  id="flow-description"
                  value={editingFlow?.description || ''}
                  onChange={(e) => setEditingFlow(prev => ({ ...prev, description: e.target.value }))}
                  className="col-span-3 neu-input"
                  placeholder="Descreva o objetivo deste fluxo."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="flow-keywords" className="text-right col-span-1">
                  Gatilhos (Palavras)
                </Label>
                <Input
                  id="flow-keywords"
                  value={editingFlow?.triggerKeywords?.join(', ') || ''}
                  onChange={(e) => setEditingFlow(prev => ({ ...prev, triggerKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) }))}
                  className="col-span-3 neu-input"
                  placeholder="oi, olá, ajuda (separado por vírgula)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Fluxo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsappFlowsList;
