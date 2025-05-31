import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, TrendingDown, Plus, Loader2, AlertTriangle, Settings, Trash2, Edit3, Target as TargetIcon } from 'lucide-react'; // Renomeado Target para TargetIcon para evitar conflito
import { apiRequest } from '@/lib/api';
import { Funnel as FunnelTypeFromSchema, FunnelStage as FunnelStageTypeFromSchema } from '@shared/schema';

// Interface para os dados de cada etapa do funil, como esperado pelo frontend
interface FunnelStageUIData extends FunnelStageTypeFromSchema {
  // Métricas de UI que precisam ser calculadas/buscadas separadamente ou vir da API
  visitors: number; 
  conversions: number; 
  conversionRate: number; 
  revenue: number; 
  trend: 'up' | 'down' | 'stable'; 
}

// Interface para o Funil, como esperado pelo frontend
// Omitimos campos que vêm do backend mas não são diretamente usados ou são redefinidos
interface FunnelUIData extends Omit<FunnelTypeFromSchema, 'createdAt' | 'updatedAt' | 'userId' | 'campaignId'> {
  id: number; // Garantir que id seja number
  name: string;
  description?: string | null;
  campaignId?: number | null; // Manter opcional
  stages: FunnelStageUIData[];
  totalVisitors: number;
  totalConversions: number;
  totalRevenue: number;
  overallConversionRate: number;
  createdAt?: string; 
  updatedAt?: string;
  userId?: number;
  campaign?: { avgTicket?: string | null }; // Para acessar avgTicket da campanha, se incluído pelo backend
}

// Interface para o que esperamos da API para cada funil (com stages e talvez campaign)
interface FunnelAPIResponse extends FunnelTypeFromSchema {
  stages: FunnelStageTypeFromSchema[];
  campaign?: { avgTicket?: string | null }; // Supondo que o backend possa popular isso
}


export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: funnelsFromApi = [], isLoading: isLoadingFunnels, error: funnelsError, refetch: refetchFunnels } = useQuery<FunnelUIData[]>({
    queryKey: ['/api/funnels'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/funnels');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao buscar funis' }));
        throw new Error(errorData.error || errorData.message || 'Erro desconhecido ao buscar funis');
      }
      const fetchedFunnels: FunnelAPIResponse[] = await response.json();
      
      return fetchedFunnels.map(funnelApi => {
        const uiStages: FunnelStageUIData[] = (funnelApi.stages || []).map((stageApi, index) => {
          // SIMULAÇÃO TEMPORÁRIA DE MÉTRICAS DE ETAPA - SUBSTITUIR POR DADOS REAIS DA API OU CÁLCULO BASEADO EM MÉTRICAS
          const prevStageConversions = index > 0 && uiStages[index-1] ? uiStages[index-1].conversions : (funnelApi.stages && funnelApi.stages.length > 0 ? (Math.floor(Math.random() * 2000) + 5000) : 0); // Visitantes da primeira etapa ou conversões da anterior
          const currentStageVisitors = index === 0 ? (Math.floor(Math.random() * 2000) + 8000) : prevStageConversions; // Visitantes para a primeira etapa são aleatórios, para as seguintes são as conversões da anterior
          const currentStageConversions = Math.floor(currentStageVisitors * (Math.random() * (0.7 - 0.3) + 0.3)); // Taxa de conversão entre 30-70%

          return {
            ...stageApi, // Mantém dados originais da API (id, name, description, order, config)
            visitors: currentStageVisitors,
            conversions: currentStageConversions,
            conversionRate: currentStageVisitors > 0 ? parseFloat(((currentStageConversions / currentStageVisitors) * 100).toFixed(1)) : 0,
            revenue: currentStageConversions * (parseFloat(String(funnelApi.campaign?.avgTicket ?? '50')) || 50),
            trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
          };
        });

        const totalVisitors = uiStages.length > 0 ? uiStages[0].visitors : 0;
        const totalConversions = uiStages.length > 0 ? uiStages[uiStages.length - 1].conversions : 0;
        const totalRevenue = uiStages.reduce((sum, stage) => sum + stage.revenue, 0);
        const overallConversionRate = totalVisitors > 0 ? parseFloat(((totalConversions / totalVisitors) * 100).toFixed(2)) : 0;

        return {
          id: funnelApi.id,
          name: funnelApi.name,
          description: funnelApi.description,
          campaignId: funnelApi.campaignId,
          stages: uiStages,
          totalVisitors,
          totalConversions,
          totalRevenue,
          overallConversionRate,
          createdAt: funnelApi.createdAt,
          updatedAt: funnelApi.updatedAt,
          userId: funnelApi.userId,
          campaign: funnelApi.campaign,
        };
      });
    },
  });
  
  useEffect(() => {
    if (funnelsFromApi.length > 0 && selectedFunnelId === null) {
      setSelectedFunnelId(funnelsFromApi[0].id);
    } else if (funnelsFromApi.length > 0 && selectedFunnelId !== null) {
      if (!funnelsFromApi.find(f => f.id === selectedFunnelId)) {
        setSelectedFunnelId(funnelsFromApi[0].id);
      }
    } else if (funnelsFromApi.length === 0) {
      setSelectedFunnelId(null);
    }
  }, [funnelsFromApi, selectedFunnelId]);

  const selectedFunnelData = useMemo(() => {
    if (!selectedFunnelId || funnelsFromApi.length === 0) return null;
    return funnelsFromApi.find(f => f.id === selectedFunnelId) || null;
  }, [funnelsFromApi, selectedFunnelId]);

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <TrendingUp className="w-4 h-4 text-transparent" />; // Ícone transparente para manter espaço
  };

  const getStageIcon = (index: number) => {
    const icons = [Users, MousePointer, ShoppingCart, CreditCard, TargetIcon]; // Usando TargetIcon importado
    const Icon = icons[index] || TargetIcon; 
    return <Icon className="w-5 h-5" />;
  };
  
  if (isLoadingFunnels) {
    return (
      <div className="p-8 space-y-6 flex flex-col items-center justify-center h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando funis...</p>
      </div>
    );
  }

  if (funnelsError) {
    return (
      <div className="p-8 space-y-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-destructive">Erro ao carregar funis</h2>
        <p className="text-muted-foreground">{funnelsError.message}</p>
        <Button onClick={() => refetchFunnels()} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Funil</h1>
          <p className="text-muted-foreground">
            Monitore a jornada do cliente e otimize conversões
          </p>
        </div>
        <Button onClick={() => alert("Lógica para Novo Funil aqui")}>
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
              {funnelsFromApi.length === 0 ? (
                <p className="text-muted-foreground">Nenhum funil encontrado. Crie um novo para começar.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funnelsFromApi.map((funnel) => (
                    <div
                      key={funnel.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFunnelData?.id === funnel.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedFunnelId(funnel.id)}
                    >
                      <h3 className="font-semibold">{funnel.name}</h3>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-muted-foreground">
                          {(funnel.totalVisitors || 0).toLocaleString()} visitantes
                        </div>
                        <Badge variant="outline">
                          {(funnel.overallConversionRate || 0).toFixed(2)}% conversão
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedFunnelData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Visitantes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(selectedFunnelData.totalVisitors || 0).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Entrada do funil
                    </p>
                  </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversões Finais</CardTitle>
                        <TargetIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(selectedFunnelData.totalConversions || 0).toLocaleString()}</div>
                         <p className="text-xs text-muted-foreground">
                            Do funil selecionado
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa Conversão Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(selectedFunnelData.overallConversionRate || 0).toFixed(2)}%</div>
                         <p className="text-xs text-muted-foreground">
                            (Conversões / Visitantes)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {(selectedFunnelData.totalRevenue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <p className="text-xs text-muted-foreground">
                            Baseada nas etapas
                        </p>
                    </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visualização do Funil: {selectedFunnelData.name}</CardTitle>
                  <CardDescription>
                    {selectedFunnelData.description || "Acompanhe o fluxo de usuários através de cada etapa."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
                      selectedFunnelData.stages.map((stage, index) => (
                        <React.Fragment key={stage.id}>
                          <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-md hover:bg-muted/40 transition-colors">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${index === 0 ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'} flex items-center justify-center`}>
                              {getStageIcon(index)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium truncate" title={stage.name}>{stage.name}</h4>
                                <div className="flex items-center space-x-1.5 text-xs">
                                  {getTrendIcon(stage.trend)}
                                  <Badge variant="outline" className="px-1.5 py-0.5 text-[0.65rem]">
                                    {stage.conversionRate.toFixed(1)}%
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-1.5">
                                <Progress value={stage.conversionRate} className="h-1.5" />
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{stage.conversions.toLocaleString()} convertidos</span>
                                  <span>{stage.visitors.toLocaleString()} entrada</span>
                                </div>
                              </div>
                              {stage.revenue > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                  Receita na etapa: R$ {stage.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </p>
                              )}
                            </div>
                          </div>
                          {index < (selectedFunnelData.stages?.length || 0) - 1 && (
                            <div className="flex justify-center h-3 my-0.5">
                              <div className="w-px bg-border relative">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-border rounded-full"></div>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhuma etapa configurada para este funil.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
           {!selectedFunnelData && funnelsFromApi.length > 0 && (
             <p className="text-muted-foreground text-center py-8">Selecione um funil para ver os detalhes.</p>
           )}
        </TabsContent>
        
        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Análise Detalhada por Etapa</CardTitle></CardHeader>
            <CardContent>
                {selectedFunnelData && selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
                    <div className="space-y-6">
                    {selectedFunnelData.stages.map((stage, index) => (
                        <div key={stage.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{stage.name}</h3>
                            <Badge variant={stage.trend === 'up' ? 'default' : stage.trend === 'down' ? 'destructive' : 'secondary'}>
                            {stage.trend === 'up' ? 'Melhorando' : stage.trend === 'down' ? 'Piorando' : 'Estável'}
                            </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                            <p className="text-sm text-muted-foreground">Visitantes</p>
                            <p className="text-2xl font-bold">{stage.visitors.toLocaleString()}</p>
                            </div>
                            <div>
                            <p className="text-sm text-muted-foreground">Conversões</p>
                            <p className="text-2xl font-bold">{stage.conversions.toLocaleString()}</p>
                            </div>
                            <div>
                            <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                            <p className="text-2xl font-bold">{stage.conversionRate.toFixed(1)}%</p>
                            </div>
                            <div>
                            <p className="text-sm text-muted-foreground">Drop-off</p>
                            <p className="text-2xl font-bold text-red-500">
                                {(selectedFunnelData.stages && index < selectedFunnelData.stages.length - 1 && stage.visitors > 0)
                                ? `${Math.max(0, ((stage.visitors - stage.conversions) / stage.visitors * 100)).toFixed(1)}%` // Garante que não seja negativo
                                : '0%'
                                }
                            </p>
                            </div>
                        </div>
                        
                        {stage.trend === 'down' && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">
                                <strong>Alerta:</strong> Esta etapa está apresentando queda na conversão. 
                                Considere otimizar a experiência do usuário neste ponto.
                            </p>
                            </div>
                        )}
                        </div>
                    ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-4">Selecione um funil com etapas para visualizar detalhes.</p>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
            <Card>
            <CardHeader><CardTitle>Otimização e Sugestões</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Implementação das sugestões de otimização pendente. Poderia usar IA ou regras heurísticas.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
