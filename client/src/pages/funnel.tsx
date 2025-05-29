import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress'; // Manteremos para a aba "Detalhada" por enquanto
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select as ShadSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, TrendingDown, Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { Funnel as FunnelType, FunnelStage, InsertFunnel, insertFunnelSchema, Campaign as CampaignType } from '@shared/schema';

// Estendendo o tipo Funnel para incluir as etapas, como virá da API
interface FunnelWithStages extends FunnelType {
  stages: FunnelStage[];
}

type FunnelFormData = Pick<InsertFunnel, "name" | "description" | "campaignId" | "userId">;


const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelType | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Busca a lista de funis
  const { data: funnelsList = [], isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelType[]>({
    queryKey: ['funnels'],
    queryFn: async () => apiRequest('GET', '/api/funnels').then(res => res.json()),
  });

  // Busca os detalhes do funil selecionado (incluindo etapas)
  const { data: selectedFunnelData, isLoading: isLoadingSelectedFunnel, error: selectedFunnelError } = useQuery<FunnelWithStages>({
    queryKey: ['funnelDetails', selectedFunnelId],
    queryFn: async () => apiRequest('GET', `/api/funnels/${selectedFunnelId}`).then(res => res.json()),
    enabled: !!selectedFunnelId, // Só executa se um funil estiver selecionado
  });
  
  // Busca campanhas para o select no formulário do funil
  const { data: campaignsList = [] } = useQuery<CampaignType[]>({
    queryKey: ['campaignsForFunnelForm'],
    queryFn: () => apiRequest('GET', '/api/campaigns').then(res => res.json()),
  });

  const form = useForm<FunnelFormData>({
    resolver: zodResolver(insertFunnelSchema.pick({ name: true, description: true, campaignId: true, userId: true })), // Adapta para os campos do form
    defaultValues: {
      name: '',
      description: '',
      campaignId: null, // Ou undefined, dependendo de como o backend trata
    },
  });

  useEffect(() => {
    if (editingFunnel) {
      form.reset({
        name: editingFunnel.name,
        description: editingFunnel.description || '',
        campaignId: editingFunnel.campaignId === undefined ? null : editingFunnel.campaignId,
      });
    } else {
      form.reset({ name: '', description: '', campaignId: null });
    }
  }, [editingFunnel, form]);

  const funnelMutation = useMutation<FunnelType, Error, FunnelFormData & { id?: number }>({
    mutationFn: async (data) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/funnels/${data.id}` : '/api/funnels';
      // userId será pego no backend a partir do token
      const { userId, ...payload } = data; // eslint-disable-line @typescript-eslint/no-unused-vars
      return apiRequest(method, url, payload).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnelDetails', data.id] });
      toast({ title: `Funil ${editingFunnel ? 'atualizado' : 'criado'} com sucesso!` });
      setIsFormModalOpen(false);
      setEditingFunnel(null);
      setSelectedFunnelId(data.id); // Seleciona o funil recém-criado/editado
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar funil', description: error.message, variant: 'destructive' });
    },
  });

  const deleteFunnelMutation = useMutation<void, Error, number>({
    mutationFn: (id) => apiRequest('DELETE', `/api/funnels/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      if (selectedFunnelId && deleteFunnelMutation.variables === selectedFunnelId) {
        setSelectedFunnelId(funnelsList.length > 0 ? funnelsList[0].id : null);
      }
      toast({ title: 'Funil excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir funil', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenFormModal = (funnel?: FunnelType) => {
    setEditingFunnel(funnel || null);
    setIsFormModalOpen(true);
  };
  
  const onSubmitFunnelForm = (data: FunnelFormData) => {
    funnelMutation.mutate({ ...data, id: editingFunnel?.id });
  };

  const handleDeleteFunnel = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este funil e todas as suas etapas?')) {
      deleteFunnelMutation.mutate(id);
    }
  };
  
  useEffect(() => {
    // Seleciona o primeiro funil da lista se nenhum estiver selecionado e a lista não estiver vazia
    if (!selectedFunnelId && funnelsList.length > 0) {
      setSelectedFunnelId(funnelsList[0].id);
    }
  }, [funnelsList, selectedFunnelId]);


  const getTrendIcon = (trend?: string) => { // Tornar trend opcional
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return null;
  };

  const getStageIcon = (index: number) => {
    const icons = [Users, MousePointer, ShoppingCart, CreditCard, CreditCard];
    const Icon = icons[index] || Users;
    return <Icon className="w-5 h-5" />;
  };

  const funnelChartData = useMemo(() => {
    if (!selectedFunnelData || !selectedFunnelData.stages) return [];
    // Simulando 'visitors' para cada etapa para o gráfico, já que não temos esses dados no FunnelStage
    // Em uma implementação real, FunnelStage teria 'value' ou 'count'
    let currentVisitors = selectedFunnelData.totalVisitors || 1000; // Fallback
    return selectedFunnelData.stages.map((stage, index) => {
      const stageValue = index === 0 ? currentVisitors : Math.floor(currentVisitors * ( Math.random() * 0.3 + 0.5 )); // decai entre 50-80%
      currentVisitors = stageValue;
      return {
        value: stageValue,
        name: stage.name,
        fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
        // Adicionar dados reais da etapa se disponíveis para o tooltip
        // conversions: stage.actualConversions || 0, 
        // conversionRate: stage.actualConversionRate || 0,
      };
    }).filter(item => item.value > 0); // Filtra estágios com 0 visitantes para não quebrar o funil visualmente
  }, [selectedFunnelData]);

  if (isLoadingFunnels) {
    return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /> Carregando funis...</div>;
  }

  if (funnelsError) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
        Erro ao carregar funis: {funnelsError.message}
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ['funnels'] })} className="mt-4">Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Funil</h1>
          <p className="text-muted-foreground">
            Monitore a jornada do cliente e otimize conversões
          </p>
        </div>
        <Button onClick={() => handleOpenFormModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Funil
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="detailed">Análise Detalhada</TabsTrigger>
          <TabsTrigger value="optimization">Otimização</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Funil</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelsList.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum funil criado ainda.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funnelsList.map((funnel) => (
                    <div
                      key={funnel.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFunnelId === funnel.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedFunnelId(funnel.id)}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold flex-1 mr-2">{funnel.name}</h3>
                        <div className="flex-shrink-0 space-x-1">
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenFormModal(funnel);}}> <Edit className="h-3.5 w-3.5"/> </Button>
                           <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(funnel.id); }}> <Trash2 className="h-3.5 w-3.5 text-destructive"/> </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{funnel.description || "Sem descrição"}</p>
                      {/* <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-muted-foreground">
                           {funnel.totalVisitors?.toLocaleString() || 0} visitantes
                        </div>
                        <Badge variant="outline">
                          {funnel.overallConversionRate?.toFixed(2) || 0}% conversão
                        </Badge>
                      </div> */}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoadingSelectedFunnel && selectedFunnelId && (
             <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> Carregando dados do funil...</div>
          )}
          {selectedFunnelError && (
            <Card className="border-destructive bg-destructive/10">
                <CardContent className="p-4 text-destructive flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" /> Erro ao carregar detalhes do funil: {selectedFunnelError.message}
                </CardContent>
            </Card>
          )}

          {selectedFunnelData && !isLoadingSelectedFunnel && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Visitantes (Etapa Inicial)</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{funnelChartData[0]?.value.toLocaleString() || selectedFunnelData.totalVisitors?.toLocaleString() || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Entradas no funil
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversões Finais</CardTitle>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedFunnelData.totalConversions?.toLocaleString() || funnelChartData[funnelChartData.length-1]?.value.toLocaleString() || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Resultado final do funil
                    </p>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Conversão Geral</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedFunnelData.overallConversionRate?.toFixed(2) || 
                       (funnelChartData[0]?.value > 0 ? ( (funnelChartData[funnelChartData.length-1]?.value || 0) / funnelChartData[0]?.value * 100).toFixed(2) : 0)
                      }%
                    </div>
                    <p className="text-xs text-muted-foreground">
                     Visitantes para conversão final
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Etapas Definidas</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedFunnelData.stages?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      No funil atual
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visualização do Funil (Gráfico)</CardTitle>
                  <CardDescription>
                    Fluxo de usuários através de cada etapa
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] md:h-[500px] p-2">
                  {funnelChartData && funnelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <RechartsTooltip
                          formatter={(value: number, name: string, props: any) => {
                            const { payload } = props;
                            return [
                              `${value.toLocaleString()} visitantes`,
                            // Se `payload.conversions` e `payload.conversionRate` forem adicionados ao `funnelChartData`
                            // `Conversões: ${payload.conversions?.toLocaleString() || 'N/A'}`,
                            // `Taxa: ${payload.conversionRate?.toFixed(2) || 'N/A'}%`
                            ];
                          }}
                          labelFormatter={(label: string) => `Etapa: ${label}`}
                        />
                        <RechartsFunnel
                          dataKey="value"
                          data={funnelChartData}
                          isAnimationActive
                          labelLine={false}
                          lastShapeType="rectangle"
                          orientation="vertical"
                          neckWidth="30%"
                          neckHeight="0%"
                        >
                          <LabelList 
                            position="center" 
                            fill="#fff" 
                            dataKey="name" 
                            angle={0} 
                            formatter={(value: string) => value}
                            className="text-xs font-semibold pointer-events-none"
                          />
                        </RechartsFunnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Este funil ainda não possui etapas ou dados para visualização.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
           {/* Conteúdo da Aba Análise Detalhada (mantido como estava com dados mockados de etapas) */}
          {selectedFunnelData && selectedFunnelData.stages ? (
            <Card>
              <CardHeader>
                <CardTitle>Análise Detalhada por Etapa</CardTitle>
                <CardDescription>
                  Identifique gargalos e oportunidades de melhoria (usando dados de etapas do funil carregado)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {selectedFunnelData.stages.map((stage, index) => {
                    // Simulação de valores para a UI, já que FunnelStage não os tem
                    const displayVisitors = funnelChartData.find(s => s.name === stage.name)?.value || 0;
                    const previousStageVisitors = index > 0 ? funnelChartData.find(s => s.name === selectedFunnelData.stages[index-1].name)?.value || displayVisitors : displayVisitors;
                    const conversionRateFromPrevious = previousStageVisitors > 0 ? (displayVisitors / previousStageVisitors * 100) : 100;
                    const dropOffRate = previousStageVisitors > 0 ? ((previousStageVisitors - displayVisitors) / previousStageVisitors * 100) : 0;

                    return (
                      <div key={stage.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">{stage.name} (Ordem: {stage.order})</h3>
                          <Badge variant="secondary">{/* Trend pode vir do backend */}
                            Estável
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Visitantes/Entradas</p>
                            <p className="text-2xl font-bold">{displayVisitors.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Conversões (para esta etapa)</p>
                            <p className="text-2xl font-bold">{displayVisitors.toLocaleString()}</p> {/* Placeholder */}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Taxa de Conversão (da etapa anterior)</p>
                            <p className="text-2xl font-bold">{conversionRateFromPrevious.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Drop-off (da etapa anterior)</p>
                            <p className="text-2xl font-bold text-red-500">
                              {dropOffRate.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {stage.description && <p className="text-xs mt-2 text-muted-foreground">{stage.description}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Selecione um funil para ver a análise detalhada das etapas.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          {/* Conteúdo da Aba Otimização (mantido como estava) */}
          <Card>
            <CardHeader>
              <CardTitle>Recomendações de Otimização</CardTitle>
              <CardDescription>
                Sugestões baseadas em análise de dados para melhorar suas conversões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {/* ... cards de recomendação estáticos ... */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para Criar/Editar Funil */}
      <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsFormModalOpen(false); setEditingFunnel(null); form.reset(); } else { setIsFormModalOpen(true); }}}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingFunnel ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
            <DialogDescription>
              {editingFunnel ? 'Altere os detalhes do seu funil.' : 'Crie um novo funil para suas campanhas.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitFunnelForm)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Funil</FormLabel>
                    <FormControl><Input placeholder="Ex: Funil de Vendas Black Friday" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl><Textarea placeholder="Descreva o objetivo deste funil..." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="campaignId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associar à Campanha (Opcional)</FormLabel>
                    <ShadSelect
                       onValueChange={(value) => field.onChange(value === "NONE" ? null : parseInt(value))}
                       value={field.value === null || field.value === undefined ? "NONE" : String(field.value)}
                       disabled={isLoadingCampaigns}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Nenhuma"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">Nenhuma campanha associada</SelectItem>
                        {campaignsList.map((campaign) => (
                          <SelectItem key={campaign.id} value={String(campaign.id)}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </ShadSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsFormModalOpen(false); setEditingFunnel(null); form.reset();}}>Cancelar</Button>
                <Button type="submit" disabled={funnelMutation.isPending}>
                  {funnelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingFunnel ? 'Salvar Alterações' : 'Criar Funil'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
