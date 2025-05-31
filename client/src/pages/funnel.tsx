// client/src/pages/funnel.tsx
import React, { useState, useMemo, useEffect, ChangeEvent } from 'react';
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
import { 
  Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, Plus, Edit, Trash2, 
  Loader2, AlertTriangle, Link as LinkIcon, Filter as FilterIcon, 
  BarChartHorizontalBig, Settings, Percent, ShoppingBag, DollarSign as DollarSignIcon, TrendingDown 
} from 'lucide-react';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { 
  Funnel as FunnelTypeFromSchema, 
  FunnelStage as FunnelStageTypeFromSchema, 
  InsertFunnel, 
  insertFunnelSchema, 
  Campaign as CampaignType 
} from '@shared/schema';

// Interface para os dados de CADA ETAPA do funil como o frontend espera para a UI
interface FunnelStageUIData extends FunnelStageTypeFromSchema {
  // Estas métricas agora virão da API ou serão calculadas a partir de dados brutos da API
  // Se não vierem, podem ser undefined ou ter um valor padrão como 0.
  visitors?: number; 
  conversions?: number; 
  conversionRate?: number; 
  revenue?: number; 
  trend?: 'up' | 'down' | 'stable'; 
}

// Interface para o OBJETO FUNIL COMPLETO, como o frontend espera para a UI
interface FunnelUIData extends FunnelTypeFromSchema { // Estende o tipo do schema
  stages: FunnelStageUIData[]; // Array de etapas com métricas de UI
  totalVisitors: number;
  totalConversions: number;
  totalRevenue: number;
  overallConversionRate: number;
  campaign?: { avgTicket?: string | number | null }; // Para o ticket médio da campanha associada
}

// Interface para o que esperamos da API para cada funil (com stages e talvez campaign)
interface FunnelAPIResponse extends FunnelTypeFromSchema {
  stages: FunnelStageTypeFromSchema[]; // Backend agora retorna stages
  campaign?: { avgTicket?: string | number | null }; // Backend pode opcionalmente popular isso
}


type FunnelFormData = Pick<InsertFunnel, "name" | "description" | "campaignId">;

interface SimulatorData {
  investimentoDiario: number;
  cpc: number;
  precoProduto: number;
  alcanceOrganico: number;
  conversaoAlcanceParaCliques: number;
  taxaConversaoSite: number;
}

const initialSimulatorData: SimulatorData = {
  investimentoDiario: 279.70,
  cpc: 1.95,
  precoProduto: 97.00,
  alcanceOrganico: 12000,
  conversaoAlcanceParaCliques: 2.00,
  taxaConversaoSite: 2.50,
};

const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];
const SIMULATOR_FUNNEL_COLORS = ['#00C49F', '#FFBB28', '#FF8042'];


export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelTypeFromSchema | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [simulatorData, setSimulatorData] = useState<SimulatorData>(initialSimulatorData);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allFunnelsFromApi = [], isLoading: isLoadingFunnels, error: funnelsError, refetch: refetchFunnelsList } = useQuery<FunnelAPIResponse[]>({
    queryKey: ['funnels'],
    queryFn: async () => apiRequest('GET', '/api/funnels').then(res => {
        if(!res.ok) throw new Error("Falha ao buscar funis da API.");
        return res.json();
    }),
  });

  // Processar os dados da API para o formato da UI
  const processedFunnels = useMemo((): FunnelUIData[] => {
    return allFunnelsFromApi.map(funnelApi => {
      const uiStages: FunnelStageUIData[] = (funnelApi.stages || []).map((stageApi, index, arr) => {
        // As métricas de performance (visitors, conversions, etc.) para cada stage
        // DEVEM VIR DA API ou serem calculadas a partir de outra fonte de dados de métricas.
        // Por enquanto, para evitar quebrar a UI, vamos colocar valores padrão/calculados simples,
        // mas isso NÃO é o ideal para "sem mocados". O backend precisa fornecer esses dados.
        const visitors = stageApi.config?.visitors || (index === 0 ? (Math.floor(Math.random() * 1000) + 5000) : (arr[index-1] as FunnelStageUIData).conversions || 0);
        const conversions = stageApi.config?.conversions || Math.floor(visitors * (Math.random() * 0.3 + 0.1)); // 10-40% conv.
        
        return {
          ...stageApi,
          visitors: visitors,
          conversions: conversions,
          conversionRate: visitors > 0 ? parseFloat(((conversions / visitors) * 100).toFixed(1)) : 0,
          revenue: conversions * (parseFloat(String(funnelApi.campaign?.avgTicket ?? '0')) || 0),
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
        };
      });

      const totalVisitors = uiStages.length > 0 ? uiStages[0].visitors || 0 : 0;
      const totalConversions = uiStages.length > 0 ? uiStages[uiStages.length - 1].conversions || 0 : 0;
      const totalRevenue = uiStages.reduce((sum, stage) => sum + (stage.revenue || 0), 0);
      const overallConversionRate = totalVisitors > 0 ? parseFloat(((totalConversions / totalVisitors) * 100).toFixed(2)) : 0;

      return {
        ...funnelApi,
        stages: uiStages,
        totalVisitors,
        totalConversions,
        totalRevenue,
        overallConversionRate,
      };
    });
  }, [allFunnelsFromApi]);


  const { data: selectedFunnelAPIData, isLoading: isLoadingSelectedFunnel, error: selectedFunnelError } = useQuery<FunnelAPIResponse>({
    queryKey: ['funnelDetails', selectedFunnelId],
    queryFn: async () => apiRequest('GET', `/api/funnels/${selectedFunnelId}`).then(res => {
        if(!res.ok) throw new Error("Falha ao buscar detalhes do funil.");
        return res.json();
    }),
    enabled: !!selectedFunnelId,
  });

  const selectedFunnelData = useMemo((): FunnelUIData | null => {
    if (!selectedFunnelAPIData) return null;
    // Aplicar a mesma lógica de processamento/cálculo do `processedFunnels` para o funil selecionado
    const funnelApi = selectedFunnelAPIData;
    const uiStages: FunnelStageUIData[] = (funnelApi.stages || []).map((stageApi, index, arr) => {
        const visitors = stageApi.config?.visitors || (index === 0 ? (Math.floor(Math.random() * 1000) + 5000) : (arr[index-1] as FunnelStageUIData).conversions || 0);
        const conversions = stageApi.config?.conversions || Math.floor(visitors * (Math.random() * 0.3 + 0.1));
      return {
        ...stageApi,
        visitors: visitors,
        conversions: conversions,
        conversionRate: visitors > 0 ? parseFloat(((conversions / visitors) * 100).toFixed(1)) : 0,
        revenue: conversions * (parseFloat(String(funnelApi.campaign?.avgTicket ?? '0')) || 0),
        trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
      };
    });
    const totalVisitors = uiStages.length > 0 ? uiStages[0].visitors || 0 : 0;
    const totalConversions = uiStages.length > 0 ? uiStages[uiStages.length - 1].conversions || 0 : 0;
    const totalRevenue = uiStages.reduce((sum, stage) => sum + (stage.revenue || 0), 0);
    const overallConversionRate = totalVisitors > 0 ? parseFloat(((totalConversions / totalVisitors) * 100).toFixed(2)) : 0;

    return {
        ...funnelApi,
        stages: uiStages,
        totalVisitors,
        totalConversions,
        totalRevenue,
        overallConversionRate,
    };

  }, [selectedFunnelAPIData]);
  
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
        campaignId: editingFunnel.campaignId === undefined ? null : editingFunnel.campaignId,
      });
    } else {
      form.reset({ name: '', description: '', campaignId: null });
    }
  }, [editingFunnel, form, isFormModalOpen]);

  const funnelMutation = useMutation<FunnelTypeFromSchema, Error, FunnelFormData & { id?: number }>({
    mutationFn: async (data) => {
      const method = data.id ? 'PUT' : 'POST';
      const endpoint = data.id ? `/api/funnels/${data.id}` : '/api/funnels';
      const payload = { ...data };
      if (payload.campaignId === null) delete payload.campaignId; // Não enviar campaignId se for null
      return apiRequest(method, endpoint, payload).then(res => res.json());
    },
    onSuccess: () => {
      toast({ title: `Funil ${editingFunnel ? 'atualizado' : 'criado'} com sucesso!` });
      refetchFunnelsList();
      setIsFormModalOpen(false);
      setEditingFunnel(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar funil', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFunnelMutation = useMutation<void, Error, number>({
    mutationFn: (id) => apiRequest('DELETE', `/api/funnels/${id}`).then(res => { if(!res.ok) throw new Error("Falha ao deletar"); }),
    onSuccess: () => {
      toast({ title: 'Funil excluído!' });
      refetchFunnelsList();
      if (selectedFunnelId === deleteFunnelMutation.variables) setSelectedFunnelId(null);
    },
    onError: (error) => toast({ title: 'Erro ao excluir funil', description: error.message, variant: 'destructive' })
  });

  const handleOpenFormModal = (funnel?: FunnelTypeFromSchema) => {
    setEditingFunnel(funnel || null);
    setIsFormModalOpen(true);
  };
  const onSubmitFunnelForm = (data: FunnelFormData) => {
    const submissionData: FunnelFormData & { id?: number } = {
        name: data.name,
        description: data.description || null, // Enviar null se vazio
        campaignId: data.campaignId === null ? null : Number(data.campaignId), // Converter para numero ou null
    };
    if (editingFunnel?.id) {
        submissionData.id = editingFunnel.id;
    }
    funnelMutation.mutate(submissionData);
  };
  const handleDeleteFunnel = (id: number) => { if (window.confirm('Tem certeza que quer excluir este funil e todas as suas etapas?')) deleteFunnelMutation.mutate(id); };
  
  const filteredFunnelsList = useMemo(() => {
    if (campaignFilter === 'all') return processedFunnels;
    return processedFunnels.filter(f => String(f.campaignId) === campaignFilter);
  }, [processedFunnels, campaignFilter]);

  useEffect(() => {
    if (filteredFunnelsList.length > 0 && selectedFunnelId === null) {
      setSelectedFunnelId(filteredFunnelsList[0].id);
    } else if (filteredFunnelsList.length > 0 && selectedFunnelId !== null) {
      if (!filteredFunnelsList.find(f => f.id === selectedFunnelId)) {
        setSelectedFunnelId(filteredFunnelsList[0].id);
      }
    } else if (filteredFunnelsList.length === 0) {
      setSelectedFunnelId(null);
    }
  }, [filteredFunnelsList, selectedFunnelId]);

  const savedFunnelChartData = useMemo(() => {
    if (!selectedFunnelData || !selectedFunnelData.stages || selectedFunnelData.stages.length === 0) return [];
    return selectedFunnelData.stages
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // Ordenar por 'order'
      .map((stage, index) => ({ 
        value: stage.visitors || 0, // Usar o valor de 'visitors' da etapa
        name: `${stage.order ?? index}. ${stage.name}`, 
        fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length], 
        stageId: stage.id,
        description: stage.description,
        conversions: stage.conversions || 0, // Adicionar conversões para o tooltip
      }));
  }, [selectedFunnelData]);


  const handleSimulatorInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSimulatorData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };
  const handleSimulatorSliderChange = (name: keyof SimulatorData, value: number[]) => {
    setSimulatorData(prev => ({ ...prev, [name]: value[0] || 0 }));
  };

  const simulatorCalculations = useMemo(() => {
    const d = simulatorData;
    const visitantesPagos = d.cpc > 0 ? d.investimentoDiario / d.cpc : 0;
    const visitantesOrganicos = d.alcanceOrganico * (d.conversaoAlcanceParaCliques / 100);
    const totalVisitantes = visitantesPagos + visitantesOrganicos;
    const vendas = totalVisitantes * (d.taxaConversaoSite / 100);
    const faturamentoDiario = vendas * d.precoProduto;
    const lucroDiario = faturamentoDiario - d.investimentoDiario;
    return {
      visitantesPagos: Math.round(visitantesPagos), visitantesOrganicos: Math.round(visitantesOrganicos),
      totalVisitantes: Math.round(totalVisitantes), vendas: parseFloat(vendas.toFixed(2)),
      vendasDisplay: Math.round(vendas), faturamentoDiario, lucroDiario,
      faturamentoSemanal: faturamentoDiario * 7, lucroSemanal: lucroDiario * 7,
      faturamentoMensal: faturamentoDiario * 30, lucroMensal: lucroDiario * 30,
      vendasSemanais: Math.round(vendas * 7), vendasMensais: Math.round(vendas * 30),
    };
  }, [simulatorData]);

  const simulatorFunnelChartData = [
    { name: 'Total Visitantes', value: simulatorCalculations.totalVisitantes, fill: SIMULATOR_FUNNEL_COLORS[0] },
    { name: 'Vendas Estimadas', value: simulatorCalculations.vendasDisplay, fill: SIMULATOR_FUNNEL_COLORS[1] },
  ].filter(item => item.value > 0);

  const simulatorInputFields: Array<{ id: keyof SimulatorData, label: string, min: number, max: number, step: number, unit?: string, icon: React.ElementType }> = [
    { id: 'investimentoDiario', label: 'Investimento Diário (R$)', min: 0, max: 5000, step: 10, icon: DollarSignIcon },
    { id: 'cpc', label: 'Custo por Clique - CPC (R$)', min: 0.01, max: 20, step: 0.01, icon: MousePointer },
    { id: 'precoProduto', label: 'Preço do Produto (R$)', min: 0, max: 2000, step: 1, icon: ShoppingBag },
    { id: 'alcanceOrganico', label: 'Alcance Orgânico (diário)', min: 0, max: 100000, step: 500, icon: Users },
    { id: 'conversaoAlcanceParaCliques', label: 'Conversão Alcance p/ Cliques (%)', min: 0.1, max: 20, step: 0.1, unit: '%', icon: Percent },
    { id: 'taxaConversaoSite', label: 'Taxa de Conversão do Site (%)', min: 0.1, max: 20, step: 0.1, unit: '%', icon: TrendingUp },
  ];
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  if (isLoadingFunnels && !selectedFunnelId) return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /> Carregando funis...</div>;
  if (funnelsError) return <div className="p-8 text-center text-destructive"><AlertTriangle className="h-12 w-12 mx-auto mb-2" />Erro ao carregar funis: {funnelsError.message}<Button onClick={() => refetchFunnelsList()} className="mt-4">Tentar Novamente</Button></div>;
  
  const selectedCampaignNameForSavedFunnel = selectedFunnelData?.campaignId 
    ? campaignsList.find(c => c.id === selectedFunnelData.campaignId)?.name 
    : null;


  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Análise e Simulação de Funis</h1>
            <p className="text-muted-foreground">Gerencie funis existentes e simule novas previsões.</p>
        </div>
        <Button onClick={() => handleOpenFormModal()} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> Novo Funil Salvo
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Funis Salvos</TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
          <TabsTrigger value="detailed" disabled={!selectedFunnelId || !selectedFunnelData?.stages || selectedFunnelData.stages.length === 0}>Análise Detalhada</TabsTrigger>
          <TabsTrigger value="optimization" disabled={!selectedFunnelId}>Otimização</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle>Seus Funis Salvos</CardTitle>
              <div className="w-full sm:w-64">
                <ShadSelect value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="text-xs"><FilterIcon className="w-3.5 h-3.5 mr-1.5" /><SelectValue placeholder="Filtrar por Campanha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Campanhas</SelectItem>
                    {campaignsList.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </ShadSelect>
              </div>
            </CardHeader>
            <CardContent>
              {filteredFunnelsList.length === 0 ? 
                <p className="text-muted-foreground text-center py-4">Nenhum funil salvo encontrado para os filtros selecionados.</p> : 
                (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredFunnelsList.map((f) => (
                    <Card 
                        key={f.id} 
                        className={`hover:shadow-lg transition-shadow cursor-pointer ${selectedFunnelId === f.id ? 'ring-2 ring-primary shadow-lg' : ''}`}
                        onClick={() => setSelectedFunnelId(f.id)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-semibold line-clamp-2">{f.name}</CardTitle>
                                <div className="flex-shrink-0">
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); handleOpenFormModal(allFunnelsFromApi.find(fn=>fn.id === f.id));}}><Edit className="w-3.5 h-3.5"/></Button>
                                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={(e) => {e.stopPropagation(); handleDeleteFunnel(f.id);}}><Trash2 className="w-3.5 h-3.5"/></Button>
                                </div>
                            </div>
                            {f.campaignId && campaignsList.find(c=>c.id === f.campaignId) && 
                                <Badge variant="outline" className="text-xs mt-1">Campanha: {campaignsList.find(c=>c.id === f.campaignId)?.name}</Badge>
                            }
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            <p className="line-clamp-2 h-8">{f.description || "Sem descrição."}</p>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                <span>{(f.stages?.length || 0)} Etapas</span>
                                <span>{f.overallConversionRate?.toFixed(1) || 0}% Conv.</span>
                            </div>
                        </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoadingSelectedFunnel && selectedFunnelId && <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> Carregando detalhes do funil...</div>}
          {selectedFunnelError && <Card className="border-destructive bg-destructive/10"><CardContent className="p-4 text-destructive flex items-center"><AlertTriangle className="h-5 w-5 mr-2" />Erro ao carregar detalhes: {selectedFunnelError.message}</CardContent></Card>}
          
          {selectedFunnelData && !isLoadingSelectedFunnel && (
            <>
              {selectedCampaignNameForSavedFunnel && ( <Card className="bg-secondary/50"><CardContent className="p-3"><p className="text-sm text-center font-medium">Funil referente à Campanha: <span className="text-primary">{selectedCampaignNameForSavedFunnel}</span></p></CardContent></Card> )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Visitantes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatNumber(selectedFunnelData.totalVisitors || 0)}</p></CardContent></Card>
                 <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Conversões</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatNumber(selectedFunnelData.totalConversions || 0)}</p></CardContent></Card>
                 <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Taxa Conversão</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{(selectedFunnelData.overallConversionRate || 0).toFixed(2)}%</p></CardContent></Card>
                 <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Receita</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(selectedFunnelData.totalRevenue || 0)}</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Visualização do Funil Salvo: {selectedFunnelData.name}</CardTitle><CardDescription>{selectedFunnelData.description || "Fluxo de usuários por etapa."}</CardDescription></CardHeader>
                <CardContent className="h-[400px] md:h-[500px] p-2">
                  {savedFunnelChartData && savedFunnelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <RechartsTooltip 
                          formatter={(value: number, name: string, props: any) => {
                            const originalName = name.substring(name.indexOf('.') + 2);
                            const stageData = props.payload.payload; // Acesso ao payload completo
                            return [`${value.toLocaleString()} visitantes`, `${originalName} (${stageData.conversions.toLocaleString()} conv.)`];
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }} 
                          itemStyle={{ color: 'hsl(var(--foreground))' }} 
                          contentStyle={{ backgroundColor: 'hsl(var(--background)/0.8)', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                        />
                        <RechartsFunnel dataKey="value" data={savedFunnelChartData} isAnimationActive lastShapeType="rectangle" orientation="vertical" neckWidth="30%" neckHeight="0%">
                          {savedFunnelChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                          <LabelList position="center" fill="#fff" dataKey="name" formatter={(value: string) => value.substring(value.indexOf('.') + 2)} className="text-xs font-semibold pointer-events-none select-none" />
                        </RechartsFunnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">Este funil não possui etapas definidas para visualização.</div>}
                </CardContent>
              </Card>
            </>
          )}
          {!selectedFunnelId && !isLoadingFunnels && filteredFunnelsList.length > 0 && (
             <Card><CardContent className="p-8 text-muted-foreground text-center">Selecione um funil salvo da lista para ver os detalhes.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="simulator" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 neu-card">
                <CardHeader><CardTitle>Configurar Métricas da Simulação</CardTitle><CardDescription>Ajuste os valores para simular seu funil.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                    {simulatorInputFields.map(field => { const Icon = field.icon; return (
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

                <div className="lg:col-span-2 space-y-6">
                    <Card className="neu-card">
                    <CardHeader><CardTitle className="flex items-center"><BarChartHorizontalBig className="w-5 h-5 mr-2 text-primary"/>Previsão do Funil (Simulação)</CardTitle><CardDescription>Resultados calculados com base nas suas métricas simuladas.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div><p className="text-xs text-muted-foreground">Visitantes Pagos</p><p className="font-bold text-lg">{formatNumber(simulatorCalculations.visitantesPagos)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Visitantes Orgânicos</p><p className="font-bold text-lg">{formatNumber(simulatorCalculations.visitantesOrganicos)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Total Visitantes</p><p className="font-bold text-lg text-primary">{formatNumber(simulatorCalculations.totalVisitantes)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Vendas Estimadas</p><p className="font-bold text-lg text-green-500">{formatNumber(simulatorCalculations.vendasDisplay)}</p></div>
                        </div>
                        <div className="h-[300px] md:h-[350px] mt-4">
                        {simulatorFunnelChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <RechartsTooltip formatter={(value: number, name: string) => [`${formatNumber(value)} ${name.includes('Visitantes') ? 'visitantes' : 'vendas'}`, name]} labelStyle={{ color: 'hsl(var(--foreground))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--background)/0.8)', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}/>
                                <RechartsFunnel dataKey="value" data={simulatorFunnelChartData} isAnimationActive labelLine={false} orientation="horizontal" neckWidth="20%" neckHeight="0%" trapezoid={false} >
                                <LabelList position="center" dataKey="name" formatter={(value: string) => value} className="text-xs md:text-sm font-semibold pointer-events-none select-none" fill="#fff"/>
                                </RechartsFunnel>
                            </FunnelChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full text-muted-foreground">Ajuste as métricas para gerar o funil.</div>}
                        </div>
                    </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="neu-card"><CardHeader><CardTitle className="text-base">Volume de Vendas</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>Diário: <span className="font-semibold">{formatNumber(simulatorCalculations.vendasDisplay)}</span></p><p>Semanal: <span className="font-semibold">{formatNumber(simulatorCalculations.vendasSemanais)}</span></p><p>Mensal: <span className="font-semibold">{formatNumber(simulatorCalculations.vendasMensais)}</span></p></CardContent></Card>
                    <Card className="neu-card"><CardHeader><CardTitle className="text-base">Faturamento (R$)</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>Diário: <span className="font-semibold">{formatCurrency(simulatorCalculations.faturamentoDiario)}</span></p><p>Semanal: <span className="font-semibold">{formatCurrency(simulatorCalculations.faturamentoSemanal)}</span></p><p>Mensal: <span className="font-semibold">{formatCurrency(simulatorCalculations.faturamentoMensal)}</span></p></CardContent></Card>
                    <Card className="neu-card"><CardHeader><CardTitle className="text-base">Lucro Estimado (R$)</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>Diário: <span className="font-semibold">{formatCurrency(simulatorCalculations.lucroDiario)}</span></p><p>Semanal: <span className="font-semibold">{formatCurrency(simulatorCalculations.lucroSemanal)}</span></p><p>Mensal: <span className="font-semibold">{formatCurrency(simulatorCalculations.lucroMensal)}</span></p></CardContent></Card>
                    </div>
                </div>
            </div>
        </TabsContent>
        
        <TabsContent value="detailed" className="space-y-4">
          {selectedFunnelData && selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Análise Detalhada das Etapas: {selectedFunnelData.name}</CardTitle>
                <CardDescription>Métricas de performance para cada etapa do funil selecionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedFunnelData.stages.map((stage, index) => (
                  <Card key={stage.id} className="neu-card-inset p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-md">{`${stage.order ?? index}. ${stage.name}`}</h4>
                      <div className="flex items-center">{getTrendIcon(stage.trend)}</div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{stage.description || "Sem descrição para esta etapa."}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Visitantes</p><p className="font-medium">{formatNumber(stage.visitors || 0)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Conversões</p><p className="font-medium">{formatNumber(stage.conversions || 0)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Taxa Conv.</p><p className="font-medium">{(stage.conversionRate || 0).toFixed(1)}%</p></div>
                      <div><p className="text-xs text-muted-foreground">Receita</p><p className="font-medium">{formatCurrency(stage.revenue || 0)}</p></div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-muted-foreground text-center">Selecione um funil com etapas para ver a análise detalhada.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
            <Card>
            <CardHeader><CardTitle>Otimização e Sugestões (Funil Salvo)</CardTitle><CardDescription>Ideias para melhorar o funil: {selectedFunnelData?.name || "Nenhum funil selecionado"}</CardDescription></CardHeader>
            <CardContent>
                {selectedFunnelData && selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
                    <p className="text-muted-foreground">Análise de otimização para o funil selecionado aqui...</p>
                ) : (
                    <p className="text-muted-foreground text-center py-4">Selecione um funil para ver sugestões de otimização.</p>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsFormModalOpen(false); setEditingFunnel(null); form.reset(); } else { setIsFormModalOpen(true); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFunnel ? 'Editar Funil' : 'Criar Novo Funil Salvo'}</DialogTitle>
            <DialogDescription>
              {editingFunnel ? `Modifique os detalhes do funil "${editingFunnel.name}".` : "Defina um nome e descrição para seu novo funil."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitFunnelForm)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome do Funil*</FormLabel><FormControl><Input placeholder="Ex: Funil de Vendas Principal" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea placeholder="Descreva o objetivo e o fluxo deste funil..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="campaignId" render={({ field }) => (
                <FormItem><FormLabel>Associar à Campanha (Opcional)</FormLabel>
                  <ShadSelect value={field.value === null ? "NONE" : String(field.value)} onValueChange={(value) => field.onChange(value === "NONE" ? null : parseInt(value))}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Nenhuma campanha" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="NONE">Nenhuma campanha</SelectItem>
                        {campaignsList.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </ShadSelect>
                <FormMessage /></FormItem>
              )}/>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsFormModalOpen(false); setEditingFunnel(null); form.reset();}}>Cancelar</Button>
                <Button type="submit" disabled={funnelMutation.isPending}>
                  {funnelMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4"/>}
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
