import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, TrendingDown, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api'; // Certifique-se que apiRequest está configurado para lidar com GET

interface FunnelStage {
  id: number;
  name: string;
  visitors: number; // Este dado viria de métricas agregadas, não diretamente da tabela funnel_stages
  conversions: number; // Idem
  conversionRate: number; // Calculado
  revenue: number; // Idem
  trend: 'up' | 'down' | 'stable'; // Mockado ou de análise de tendências
  // Campos da tabela funnel_stages (se necessário para exibição/edição)
  description?: string | null;
  order?: number;
  config?: Record<string, any> | null;
}

interface Funnel {
  id: number;
  name: string;
  campaignId: number | null;
  description?: string | null;
  // As 'stages' e métricas agregadas viriam idealmente de um endpoint mais elaborado
  // ou seriam calculadas/buscadas separadamente.
  // Para manter a estrutura do seu mock, vamos assumir que a API pode retornar isso.
  stages?: FunnelStage[]; // Tornando opcional, pois /api/funnels não retorna isso por padrão
  totalVisitors?: number;
  totalConversions?: number;
  totalRevenue?: number;
  overallConversionRate?: number;
  createdAt: string; 
  updatedAt: string;
}

export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);

  const { data: funnels = [], isLoading: isLoadingFunnels, error: funnelsError } = useQuery<Funnel[]>({
    queryKey: ['/api/funnels'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/funnels');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao buscar funis' }));
        throw new Error(errorData.error || errorData.message || 'Erro desconhecido ao buscar funis');
      }
      // TODO: A API /api/funnels atualmente não retorna 'stages' nem as métricas agregadas.
      // Esses dados precisariam ser adicionados no backend ou buscados separadamente.
      // Por enquanto, vamos simular que alguns funis podem vir sem stages para testar a robustez.
      const fetchedFunnels = await response.json();
      return fetchedFunnels.map((f: Funnel) => ({
        ...f,
        // Simulando que a API pode não trazer stages, ou que alguns funis podem não ter stages ainda
        stages: f.stages || (f.id === 1 ? mockStagesEcommerce : (f.id === 2 ? mockStagesLeadGen : [])), // Fallback para mock stages por enquanto
        totalVisitors: f.totalVisitors || (f.stages ? f.stages.reduce((sum, s) => sum + s.visitors, 0) : Math.floor(Math.random() * 10000) + 1000),
        totalConversions: f.totalConversions || (f.stages && f.stages.length > 0 ? f.stages[f.stages.length-1].conversions : Math.floor(Math.random() * 500)),
        totalRevenue: f.totalRevenue || (f.stages ? f.stages.reduce((sum, s) => sum + s.revenue, 0) : Math.floor(Math.random() * 20000)),
        overallConversionRate: f.overallConversionRate || ((f.stages && f.stages.length > 0 && f.stages[0].visitors > 0) ? (f.stages[f.stages.length-1].conversions / f.stages[0].visitors * 100) : Math.random() * 10),
      }));
    },
  });
  
  // Mock stages (usado como fallback se a API não os retornar)
  const mockStagesEcommerce: FunnelStage[] = [
    { id: 1, name: 'Visitantes', visitors: 10000, conversions: 3000, conversionRate: 30, revenue: 0, trend: 'up' },
    { id: 2, name: 'Visualizaram Produto', visitors: 3000, conversions: 1500, conversionRate: 50, revenue: 0, trend: 'stable' },
    { id: 3, name: 'Adicionaram ao Carrinho', visitors: 1500, conversions: 450, conversionRate: 30, revenue: 0, trend: 'down' },
    { id: 4, name: 'Iniciaram Checkout', visitors: 450, conversions: 315, conversionRate: 70, revenue: 0, trend: 'up' },
    { id: 5, name: 'Completaram Compra', visitors: 315, conversions: 252, conversionRate: 80, revenue: 12600, trend: 'up' }
  ];
  const mockStagesLeadGen: FunnelStage[] = [
    { id: 1, name: 'Visitantes', visitors: 8500, conversions: 2550, conversionRate: 30, revenue: 0, trend: 'up' },
    { id: 2, name: 'Leram Landing Page', visitors: 2550, conversions: 1275, conversionRate: 50, revenue: 0, trend: 'stable' },
    { id: 3, name: 'Preencheram Formulário', visitors: 1275, conversions: 382, conversionRate: 30, revenue: 0, trend: 'up' },
  ];


  const selectedFunnelData = useMemo(() => {
    if (funnels.length === 0) return null;
    if (selectedFunnelId === null && funnels.length > 0) {
      return funnels[0];
    }
    return funnels.find(f => f.id === selectedFunnelId) || funnels[0] || null;
  }, [funnels, selectedFunnelId]);


  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return null;
  };

  const getStageIcon = (index: number) => {
    const icons = [Users, MousePointer, ShoppingCart, CreditCard, CreditCard];
    const Icon = icons[index] || Users;
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
        <Button onClick={() => queryClient.refetchQueries({queryKey: ['/api/funnels']})} className="mt-4">
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
        <Button>
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
              {funnels.length === 0 ? (
                <p className="text-muted-foreground">Nenhum funil encontrado. Crie um novo para começar.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funnels.map((funnel) => (
                    <div
                      key={funnel.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFunnelData?.id === funnel.id
                          ? 'border-primary bg-primary/5'
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Visitantes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(selectedFunnelData.totalVisitors || 0).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      +12% desde o mês passado (simulado)
                    </p>
                  </CardContent>
                </Card>
                {/* Outros cards de métricas principais */}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversões</CardTitle>
                        <MousePointer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(selectedFunnelData.totalConversions || 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                        +8% desde o mês passado (simulado)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(selectedFunnelData.overallConversionRate || 0).toFixed(2)}%</div>
                        <p className="text-xs text-muted-foreground">
                        -0.3% desde o mês passado (simulado)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {(selectedFunnelData.totalRevenue || 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                        +15% desde o mês passado (simulado)
                        </p>
                    </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visualização do Funil: {selectedFunnelData.name}</CardTitle>
                  <CardDescription>
                    Acompanhe o fluxo de usuários através de cada etapa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedFunnelData.stages && selectedFunnelData.stages.length > 0 ? (
                      selectedFunnelData.stages.map((stage, index) => (
                        <div key={stage.id} className="relative">
                          <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                            <div className="flex-shrink-0">
                              {getStageIcon(index)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">{stage.name}</h4>
                                <div className="flex items-center space-x-2">
                                  {getTrendIcon(stage.trend)}
                                  <Badge variant="outline">
                                    {stage.conversionRate.toFixed(1)}%
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                                  <span>{stage.conversions.toLocaleString()} usuários</span>
                                  <span>{stage.visitors.toLocaleString()} visitantes</span>
                                </div>
                                <Progress value={stage.conversionRate} className="h-2" />
                              </div>
                              {stage.revenue > 0 && (
                                <p className="text-sm text-green-600 mt-1">
                                  Receita: R$ {stage.revenue.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {index < (selectedFunnelData.stages?.length || 0) - 1 && (
                            <div className="flex justify-center">
                              <div className="w-px h-4 bg-border"></div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhuma etapa definida para este funil.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Conteúdo das outras abas (Detailed, Optimization) permanece o mesmo do seu mock por enquanto */}
        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada por Etapa</CardTitle>
              <CardDescription>
                Identifique gargalos e oportunidades de melhoria
              </CardDescription>
            </CardHeader>
            <CardContent>
            {selectedFunnelData?.stages && selectedFunnelData.stages.length > 0 ? (
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
                          {/* Corrigido: Garantir que selectedFunnelData.stages exista antes de acessar length */}
                          {(selectedFunnelData.stages && index < selectedFunnelData.stages.length - 1 && stage.visitors > 0)
                            ? `${((stage.visitors - stage.conversions) / stage.visitors * 100).toFixed(1)}%`
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
                 <p className="text-muted-foreground text-center py-4">Selecione um funil ou defina etapas para visualizar detalhes.</p>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recomendações de Otimização</CardTitle>
              <CardDescription>
                Sugestões baseadas em análise de dados para melhorar suas conversões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-semibold text-blue-900">🎯 Otimizar Carrinho de Compras</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    30% dos usuários abandonam o carrinho. Considere implementar recuperação de carrinho abandonado e simplificar o processo.
                  </p>
                  <Button size="sm" className="mt-2">Implementar</Button>
                </div>
                {/* Mais recomendações mockadas */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
