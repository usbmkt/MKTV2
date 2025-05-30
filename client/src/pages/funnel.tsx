import { useState, useMemo, useEffect } from 'react';
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
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { Funnel as FunnelType, FunnelStage, InsertFunnel, insertFunnelSchema, Campaign as CampaignType } from '@shared/schema';

interface FunnelWithStages extends FunnelType {
  stages: FunnelStage[];
  totalVisitors?: number; 
  totalConversions?: number;
  overallConversionRate?: number;
}

type FunnelFormData = Pick<InsertFunnel, "name" | "description" | "campaignId">;

const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelType | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: funnelsList = [], isLoading: isLoadingFunnels, error: funnelsError, refetch: refetchFunnelsList } = useQuery<FunnelType[]>({
    queryKey: ['funnels'],
    queryFn: async () => apiRequest('GET', '/api/funnels').then(res => res.json()),
  });

  const { data: selectedFunnelData, isLoading: isLoadingSelectedFunnel, error: selectedFunnelError } = useQuery<FunnelWithStages>({
    queryKey: ['funnelDetails', selectedFunnelId],
    queryFn: async () => apiRequest('GET', `/api/funnels/${selectedFunnelId}`).then(res => res.json()),
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
        const remainingFunnels = funnelsList.filter(f => f.id !== deletedFunnelId);
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
  
  useEffect(() => {
    if (!selectedFunnelId && funnelsList && funnelsList.length > 0) {
      setSelectedFunnelId(funnelsList[0].id);
    }
  }, [funnelsList, selectedFunnelId]);

  const funnelChartData = useMemo(() => {
    if (!selectedFunnelData || !selectedFunnelData.stages || selectedFunnelData.stages.length === 0) return [];
    // Simulação de valores para o gráfico. Idealmente, viriam do backend com contagens reais por etapa.
    let currentStageValue = 1000; // Valor inicial simulado
    return selectedFunnelData.stages
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

  if (isLoadingFunnels) return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /> Carregando funis...</div>;
  if (funnelsError) return <div className="p-8 text-center text-destructive"><AlertTriangle className="h-12 w-12 mx-auto mb-2" />Erro: {funnelsError.message}<Button onClick={() => refetchFunnelsList()} className="mt-4">Tentar Novamente</Button></div>;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold tracking-tight">Análise de Funil</h1><p className="text-muted-foreground">Monitore a jornada e otimize conversões.</p></div>
        <Button onClick={() => handleOpenFormModal()}><Plus className="w-4 h-4 mr-2" /> Novo Funil</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList><TabsTrigger value="overview">Visão Geral</TabsTrigger><TabsTrigger value="detailed" disabled={!selectedFunnelId || !selectedFunnelData?.stages?.length}>Análise Detalhada</TabsTrigger><TabsTrigger value="optimization" disabled={!selectedFunnelId}>Otimização</TabsTrigger></TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Selecionar Funil</CardTitle></CardHeader>
            <CardContent>
              {funnelsList.length === 0 ? <p className="text-muted-foreground text-center py-4">Nenhum funil criado.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funnelsList.map((f) => (
                    <div key={f.id} className={`p-4 border rounded-lg cursor-pointer ${selectedFunnelId === f.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => setSelectedFunnelId(f.id)}>
                      <div className="flex justify-between items-start"><h3 className="font-semibold flex-1 mr-2">{f.name}</h3><div className="flex-shrink-0 space-x-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenFormModal(f);}}><Edit className="h-3.5 w-3.5"/></Button><Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(f.id);}} disabled={deleteFunnelMutation.isPending && deleteFunnelMutation.variables === f.id}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></div></div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{f.description || "Sem descrição"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoadingSelectedFunnel && selectedFunnelId && <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> Carregando...</div>}
          {selectedFunnelError && <Card className="border-destructive bg-destructive/10"><CardContent className="p-4 text-destructive flex items-center"><AlertTriangle className="h-5 w-5 mr-2" />Erro: {selectedFunnelError.message}</CardContent></Card>}

          {selectedFunnelData && !isLoadingSelectedFunnel && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Visitantes (Início)</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{funnelChartData[0]?.value.toLocaleString() || 0}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Conversões (Fim)</CardTitle><MousePointer className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{funnelChartData[funnelChartData.length-1]?.value.toLocaleString() || 0}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Taxa Conv. Total</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{(funnelChartData[0]?.value > 0 ? ( (funnelChartData[funnelChartData.length-1]?.value || 0) / funnelChartData[0]?.value * 100).toFixed(1) : 0)}%</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Etapas</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{selectedFunnelData.stages?.length || 0}</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Visualização do Funil</CardTitle><CardDescription>Fluxo de usuários por etapa.</CardDescription></CardHeader>
                <CardContent className="h-[400px] md:h-[500px] p-2">
                  {funnelChartData && funnelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <RechartsTooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} usuários (simulado)`, name.substring(name.indexOf('.') + 2)]} />
                        <RechartsFunnel dataKey="value" data={funnelChartData} isAnimationActive lastShapeType="rectangle" orientation="vertical" neckWidth="30%" neckHeight="0%">
                          {funnelChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                          <LabelList position="center" fill="#fff" dataKey="name" formatter={(value: string) => value.substring(value.indexOf('.') + 2)} className="text-xs font-semibold pointer-events-none select-none" />
                        </RechartsFunnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">Este funil não possui etapas ou os dados ainda estão carregando.</div>}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="detailed" className="space-y-4">
          {selectedFunnelData && selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Análise Detalhada por Etapa</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {selectedFunnelData.stages.sort((a,b) => a.order - b.order).map((stage, index) => {
                  const stageValueInChart = funnelChartData.find(fd => fd.stageId === stage.id)?.value || 0;
                  const prevStageValueInChart = index > 0 ? (funnelChartData.find(fd => fd.stageId === selectedFunnelData.stages.find(s => s.order === stage.order - 1)?.id)?.value || stageValueInChart) : stageValueInChart;
                  const conversionRateFromPrevious = prevStageValueInChart > 0 && index > 0 ? (stageValueInChart / prevStageValueInChart * 100) : (index === 0 ? 100 : 0) ;
                  const dropOffRate = prevStageValueInChart > 0 && index > 0 ? ((prevStageValueInChart - stageValueInChart) / prevStageValueInChart * 100) : 0;
                  return (
                  <div key={stage.id} className="border rounded-lg p-4">
                    <h3 className="text-lg font-semibold">{stage.order}. {stage.name}</h3>
                    {stage.description && <p className="text-xs mt-1 text-muted-foreground mb-2">{stage.description}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div><p className="text-sm text-muted-foreground">Valor (Simulado)</p><p className="text-2xl font-bold">{stageValueInChart.toLocaleString()}</p></div>
                      <div><p className="text-sm text-muted-foreground">Conv. da Etapa Ant. (Simulado)</p><p className="text-2xl font-bold">{conversionRateFromPrevious.toFixed(1)}%</p></div>
                      <div><p className="text-sm text-muted-foreground">Drop-off da Etapa Ant. (Simulado)</p><p className="text-2xl font-bold text-red-500">{dropOffRate.toFixed(1)}%</p></div>
                    </div>
                     {/* TODO: Adicionar botões para gerenciar esta etapa (futuro) */}
                  </div>
                );})}
                <div className="text-center">
                  <Button variant="outline" disabled> 
                    <Plus className="mr-2 h-4 w-4"/> Adicionar Nova Etapa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : <Card><CardContent className="p-8 text-center text-muted-foreground">{selectedFunnelId ? "Este funil não possui etapas." : "Selecione um funil."}</CardContent></Card>}
        </TabsContent>
        <TabsContent value="optimization" className="space-y-4"> </TabsContent>
      </Tabs>

      <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsFormModalOpen(false); setEditingFunnel(null); form.reset(); } else { setIsFormModalOpen(true); }}}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>{editingFunnel ? 'Editar Funil' : 'Novo Funil'}</DialogTitle><DialogDescription>{editingFunnel ? 'Altere os detalhes.' : 'Crie um novo funil.'}</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitFunnelForm)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome*</FormLabel><FormControl><Input placeholder="Ex: Funil Black Friday" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea placeholder="Objetivo, público..." {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="campaignId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Associar à Campanha</FormLabel>
                  <ShadSelect onValueChange={(value) => field.onChange(value === "NONE" ? null : parseInt(value))} value={field.value === null || field.value === undefined ? "NONE" : String(field.value)} disabled={campaignsList.length === 0}>
                    <FormControl><SelectTrigger><SelectValue placeholder={campaignsList.length === 0 ? "Nenhuma campanha" : "Nenhuma"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhuma</SelectItem>
                      {campaignsList.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </ShadSelect>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsFormModalOpen(false); setEditingFunnel(null); form.reset();}}>Cancelar</Button>
                <Button type="submit" disabled={funnelMutation.isPending}>{funnelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingFunnel ? 'Salvar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
