// client/src/pages/funnel.tsx
import { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select as ShadSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, Plus, Edit, Trash2, Loader2, AlertTriangle, Link as LinkIcon, Filter as FilterIcon, BarChartHorizontalBig, Settings, Percent, ShoppingBag, DollarSign as DollarSignIcon } from 'lucide-react';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { Funnel as FunnelType, FunnelStage, InsertFunnel, insertFunnelSchema, Campaign as CampaignType } from '@shared/schema';

interface FunnelWithStages extends FunnelType {
  stages: FunnelStage[]; // Backend deve garantir que isso é um array
  totalVisitors?: number; 
  totalConversions?: number;
  overallConversionRate?: number;
}

type FunnelFormData = Pick<InsertFunnel, "name" | "description" | "campaignId">;

const initialSimulatorData: SimulatorData = {
  investimentoDiario: 279.70,
  cpc: 1.95,
  precoProduto: 97.00,
  alcanceOrganico: 12000,
  conversaoAlcanceParaCliques: 2.00,
  taxaConversaoSite: 2.50,
};

interface SimulatorData {
  investimentoDiario: number;
  cpc: number;
  precoProduto: number;
  alcanceOrganico: number;
  conversaoAlcanceParaCliques: number;
  taxaConversaoSite: number;
}

const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];
const SIMULATOR_FUNNEL_COLORS = ['#00C49F', '#FFBB28', '#FF8042'];


export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelType | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [simulatorData, setSimulatorData] = useState<SimulatorData>(initialSimulatorData);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allFunnels = [], isLoading: isLoadingFunnels, error: funnelsError, refetch: refetchFunnelsList } = useQuery<FunnelType[]>({
    queryKey: ['funnels'],
    queryFn: async () => apiRequest('GET', '/api/funnels').then(res => res.json()),
  });

  const { data: selectedFunnelData, isLoading: isLoadingSelectedFunnel, error: selectedFunnelError } = useQuery<FunnelWithStages>({
    queryKey: ['funnelDetails', selectedFunnelId],
    queryFn: async () => {
        const response = await apiRequest('GET', `/api/funnels/${selectedFunnelId}`);
        const data = await response.json();
        // Garantir que stages seja sempre um array
        return { ...data, stages: Array.isArray(data.stages) ? data.stages : [] };
    },
    enabled: !!selectedFunnelId,
  });
  
  const { data: campaignsList = [] } = useQuery<CampaignType[]>({
    queryKey: ['campaignsForFunnelForm'],
    queryFn: () => apiRequest('GET', '/api/campaigns').then(res => res.json()),
  });

  const form = useForm<FunnelFormData>({
    resolver: zodResolver(insertFunnelSchema.pick({ name: true, description: true, campaignId: true })),
    defaultValues: { name: '', description: '', campaignId: null },
  });
  
  useEffect(() => {
    if (editingFunnel) {
      form.reset({
        name: editingFunnel.name,
        description: editingFunnel.description || '',
        campaignId: editingFunnel.campaignId === undefined || editingFunnel.campaignId === null ? null : editingFunnel.campaignId,
      });
    } else {
      form.reset({ name: '', description: '', campaignId: null });
    }
  }, [editingFunnel, form, isFormModalOpen]);

  const funnelMutation = useMutation<FunnelType, Error, FunnelFormData & { id?: number }>({
    mutationFn: async (data) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/funnels/${data.id}` : '/api/funnels';
      return apiRequest(method, url, data).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast({ title: `Funil ${editingFunnel ? 'atualizado' : 'criado'}!` });
      setIsFormModalOpen(false);
      setEditingFunnel(null);
      setSelectedFunnelId(data.id);
      queryClient.invalidateQueries({ queryKey: ['funnelDetails', data.id] });
    },
    onError: (error) => toast({ title: 'Erro ao salvar funil', description: error.message, variant: 'destructive' }),
  });

  const deleteFunnelMutation = useMutation<void, Error, number>({
    mutationFn: (id) => apiRequest('DELETE', `/api/funnels/${id}`).then(res => { if(!res.ok) throw new Error('Falha ao excluir'); return res.json()}),
    onSuccess: (_, deletedFunnelId) => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      toast({ title: 'Funil excluído!' });
      if (selectedFunnelId === deletedFunnelId) {
        const remainingFunnels = allFunnels.filter(f => f.id !== deletedFunnelId);
        setSelectedFunnelId(remainingFunnels.length > 0 ? remainingFunnels[0].id : null);
      }
    },
    onError: (error) => toast({ title: 'Erro ao excluir funil', description: error.message, variant: 'destructive' }),
  });

  const handleOpenFormModal = (funnel?: FunnelType) => {
    setEditingFunnel(funnel || null);
    setIsFormModalOpen(true);
  };
  
  const onSubmitFunnelForm = (data: FunnelFormData) => funnelMutation.mutate({ ...data, id: editingFunnel?.id });
  const handleDeleteFunnel = (id: number) => { if (window.confirm('Excluir este funil e suas etapas?')) deleteFunnelMutation.mutate(id); };
  
  const filteredFunnelsList = useMemo(() => {
    if (!allFunnels) return []; // Adicionada verificação
    if (campaignFilter === 'all') return allFunnels;
    const campaignIdNum = parseInt(campaignFilter);
    return allFunnels.filter(funnel => funnel.campaignId === campaignIdNum);
  }, [allFunnels, campaignFilter]);

  useEffect(() => {
    if (!selectedFunnelId && filteredFunnelsList && filteredFunnelsList.length > 0) {
      setSelectedFunnelId(filteredFunnelsList[0].id);
    } else if (selectedFunnelId && filteredFunnelsList && !filteredFunnelsList.find(f => f.id === selectedFunnelId)) {
      setSelectedFunnelId(filteredFunnelsList.length > 0 ? filteredFunnelsList[0].id : null);
    } else if (filteredFunnelsList && filteredFunnelsList.length === 0) { // Adicionada verificação
      setSelectedFunnelId(null);
    }
  }, [filteredFunnelsList, selectedFunnelId]);

  const savedFunnelChartData = useMemo(() => {
    // Garantir que stages é um array antes de chamar .length ou .map
    const stages = selectedFunnelData?.stages && Array.isArray(selectedFunnelData.stages) ? selectedFunnelData.stages : [];
    if (!selectedFunnelData || stages.length === 0) return [];
    
    let currentStageValue = selectedFunnelData.totalVisitors || 1000; 
    return stages
      .sort((a, b) => a.order - b.order)
      .map((stage, index) => {
        if (index > 0) currentStageValue = Math.max(1, Math.floor(currentStageValue * (0.4 + Math.random() * 0.45))); 
        return { 
          value: currentStageValue, 
          name: `${stage.order}. ${stage.name}`, 
          fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length], 
          stageId: stage.id,
          description: stage.description 
        };
    });
  }, [selectedFunnelData]);

  const handleSimulatorInputChange = (e: ChangeEvent<HTMLInputElement>) => { /* ... (como antes) ... */ };
  const handleSimulatorSliderChange = (name: keyof SimulatorData, value: number[]) => { /* ... (como antes) ... */ };
  const simulatorCalculations = useMemo(() => { /* ... (como antes) ... */ }, [simulatorData]);
  const simulatorFunnelChartData = useMemo(() => [ /* ... (como antes, baseado em simulatorCalculations) ... */
    { name: 'Total Visitantes', value: simulatorCalculations.totalVisitantes, fill: SIMULATOR_FUNNEL_COLORS[0] },
    { name: 'Vendas Estimadas', value: simulatorCalculations.vendasDisplay, fill: SIMULATOR_FUNNEL_COLORS[1] },
  ].filter(item => item.value > 0), [simulatorCalculations]);

  const simulatorInputFields: Array<{ id: keyof SimulatorData, label: string, min: number, max: number, step: number, unit?: string, icon: React.ElementType }> = [ /* ... (como antes) ... */ ];
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  if (isLoadingFunnels) return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /> Carregando funis...</div>;
  if (funnelsError) return <div className="p-8 text-center text-destructive"><AlertTriangle className="h-12 w-12 mx-auto mb-2" />Erro: {funnelsError.message}<Button onClick={() => refetchFunnelsList()} className="mt-4">Tentar Novamente</Button></div>;

  const selectedCampaignNameForSavedFunnel = selectedFunnelData?.campaignId 
    ? campaignsList.find(c => c.id === selectedFunnelData.campaignId)?.name 
    : null;
  
  // Garantir que selectedFunnelData.stages é um array para as abas
  const stagesForDetailedView = selectedFunnelData?.stages && Array.isArray(selectedFunnelData.stages) ? selectedFunnelData.stages : [];


  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold tracking-tight">Análise e Simulação de Funis</h1><p className="text-muted-foreground">Gerencie funis existentes e simule novas previsões.</p></div>
        <Button onClick={() => handleOpenFormModal()}><Plus className="w-4 h-4 mr-2" /> Novo Funil Salvo</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
            <TabsTrigger value="overview">Funis Salvos</TabsTrigger>
            <TabsTrigger value="simulator">Simulador de Previsão</TabsTrigger>
            <TabsTrigger value="detailed" disabled={!selectedFunnelId || !stagesForDetailedView?.length}>Análise Detalhada (Salvo)</TabsTrigger>
            <TabsTrigger value="optimization" disabled={!selectedFunnelId}>Otimização (Salvo)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Selecionar Funil Salvo</CardTitle>
              <div className="w-64">
                <ShadSelect value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger><FilterIcon className="w-4 h-4 mr-2" /><SelectValue placeholder="Filtrar por Campanha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Campanhas</SelectItem>
                    {campaignsList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </ShadSelect>
              </div>
            </CardHeader>
            <CardContent>
              {filteredFunnelsList.length === 0 ? <p className="text-muted-foreground text-center py-4">Nenhum funil salvo encontrado.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFunnelsList.map((f) => {
                     const campaignName = f.campaignId ? campaignsList.find(c => c.id === f.campaignId)?.name : null;
                     return (
                      <div key={f.id} className={`p-4 border rounded-lg cursor-pointer ${selectedFunnelId === f.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => setSelectedFunnelId(f.id)}>
                        <div className="flex justify-between items-start"><h3 className="font-semibold flex-1 mr-2">{f.name}</h3><div className="flex-shrink-0 space-x-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenFormModal(f);}}><Edit className="h-3.5 w-3.5"/></Button><Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(f.id);}} disabled={deleteFunnelMutation.isPending && deleteFunnelMutation.variables === f.id}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></div></div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{f.description || "Sem descrição"}</p>
                        {campaignName && <p className="text-xs text-primary/80 mt-1 flex items-center"><LinkIcon className="w-3 h-3 mr-1"/> Campanha: {campaignName}</p>}
                      </div>
                     );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoadingSelectedFunnel && selectedFunnelId && <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> Carregando...</div>}
          {selectedFunnelError && <Card className="border-destructive bg-destructive/10"><CardContent className="p-4 text-destructive flex items-center"><AlertTriangle className="h-5 w-5 mr-2" />Erro: {selectedFunnelError.message}</CardContent></Card>}
          
          {selectedFunnelData && !isLoadingSelectedFunnel && (
            <>
              {selectedCampaignNameForSavedFunnel && ( <Card className="bg-secondary/50"><CardContent className="p-3"><p className="text-sm text-center font-medium">Funil referente à Campanha: <span className="text-primary">{selectedCampaignNameForSavedFunnel}</span></p></CardContent></Card> )}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> {/* KPIs */} </div>
              <Card>
                <CardHeader><CardTitle>Visualização do Funil Salvo</CardTitle><CardDescription>Fluxo de usuários por etapa.</CardDescription></CardHeader>
                <CardContent className="h-[400px] md:h-[500px] p-2">
                  {savedFunnelChartData && savedFunnelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <RechartsTooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} usuários (simulado)`, name.substring(name.indexOf('.') + 2)]} />
                        <RechartsFunnel dataKey="value" data={savedFunnelChartData} isAnimationActive lastShapeType="rectangle" orientation="vertical" neckWidth="30%" neckHeight="0%">
                          {savedFunnelChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                          <LabelList position="center" fill="#fff" dataKey="name" formatter={(value: string) => value.substring(value.indexOf('.') + 2)} className="text-xs font-semibold pointer-events-none select-none" />
                        </RechartsFunnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">Este funil não possui etapas ou os dados ainda estão carregando.</div>}
                </CardContent>
              </Card>
            </>
          )}
          {!selectedFunnelId && !isLoadingFunnels && !isLoadingSelectedFunnel && <Card><CardContent className="p-8 text-muted-foreground text-center">Selecione um funil salvo para ver os detalhes.</CardContent></Card>}
        </TabsContent>

        <TabsContent value="simulator" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 neu-card">
                  <CardHeader>
                    <CardTitle>Configurar Métricas da Simulação</CardTitle>
                    <CardDescription>Ajuste os valores para simular seu funil.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {simulatorInputFields.map(field => {
                      const Icon = field.icon;
                      return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`sim-${field.id}`} className="flex items-center text-sm font-medium"><Icon className="w-4 h-4 mr-2 text-primary" />{field.label}</Label>
                        <div className="flex items-center space-x-2">
                          <Input type="number" id={`sim-${field.id}`} name={field.id} value={simulatorData[field.id]} onChange={handleSimulatorInputChange} min={field.min} max={field.max} step={field.step} className="neu-input w-28 text-sm"/>
                          <Slider name={field.id} value={[simulatorData[field.id]]} onValueChange={(value) => handleSimulatorSliderChange(field.id, value)} min={field.min} max={field.max} step={field.step} className="flex-1"/>
                        </div>
                        <p className="text-xs text-muted-foreground text-right">Min: {field.unit === '%' ? field.min.toFixed(1) : field.min}{field.unit || ''} / Max: {field.unit === '%' ? field.max.toFixed(1) : field.max}{field.unit || ''}</p>
                      </div>
                    )})}
                  </CardContent>
                </Card>
                <div className="lg:col-span-2 space-y-6"> {/* ... (conteúdo do simulador como antes) ... */} </div>
            </div>
        </TabsContent>
        
        <TabsContent value="detailed" className="space-y-4">
          {selectedFunnelData && stagesForDetailedView.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Análise Detalhada por Etapa (Funil Salvo)</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {stagesForDetailedView.sort((a,b) => a.order - b.order).map((stage, index) => { /* ... (renderização das etapas salvas, como antes) ... */ })}
                <div className="text-center mt-4">
                  <Button variant="outline" disabled> <Plus className="mr-2 h-4 w-4"/> Adicionar Etapa ao Funil Salvo</Button>
                </div>
              </CardContent>
            </Card>
          ) : <Card><CardContent className="p-8 text-center text-muted-foreground">{selectedFunnelId ? "Funil salvo não possui etapas." : "Selecione um funil salvo."}</CardContent></Card>}
        </TabsContent>
        <TabsContent value="optimization" className="space-y-4"> {/* Conteúdo estático */} </TabsContent>
      </Tabs>

      <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsFormModalOpen(false); setEditingFunnel(null); form.reset(); } else { setIsFormModalOpen(true); }}}>
        {/* ... (Modal de Criar/Editar Funil Salvo, como antes) ... */}
      </Dialog>
    </div>
  );
}
