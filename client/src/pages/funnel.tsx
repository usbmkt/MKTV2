// client/src/pages/funnel.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, TrendingDown, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api'; // Importar apiRequest

// Interface alinhada com shared/schema.ts e com dados de performance que o frontend espera
export interface FunnelStageData {
  id: number;
  funnelId: number;
  name: string;
  description?: string | null;
  order: number;
  config?: any; // JSONB
  // Dados de performance que podem vir do backend ou serem calculados no frontend
  visitors?: number;
  conversions?: number;
  conversionRate?: number;
  revenue?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface FunnelData {
  id: number;
  userId: number;
  campaignId?: number | null;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  stages: FunnelStageData[];
  // Campos calculados (podem ser calculados no frontend se não vierem da API)
  totalVisitors?: number;
  totalConversions?: number;
  totalRevenue?: number;
  overallConversionRate?: number;
}

// Função para simular/calcular dados de performance se não vierem da API
// (Adaptar conforme a resposta real da sua API)
const processFunnelData = (funnel: FunnelData): FunnelData => {
  let totalVisitors = 0;
  let lastStageConversions = 0;

  if (funnel.stages && funnel.stages.length > 0) {
    totalVisitors = funnel.stages[0].visitors || 0; // Assume que o primeiro estágio tem os visitantes iniciais
    lastStageConversions = funnel.stages[funnel.stages.length - 1].conversions || 0;

    funnel.stages = funnel.stages.map((stage, index, arr) => {
      const prevStageVisitors = index === 0 ? totalVisitors : arr[index-1].conversions || 0;
      return {
        ...stage,
        visitors: stage.visitors === undefined ? prevStageVisitors : stage.visitors,
        conversions: stage.conversions === undefined && index < arr.length -1 ? Math.floor(prevStageVisitors * (0.3 + Math.random() * 0.4)) : stage.conversions || 0, // Simula conversões
        conversionRate: stage.visitors && stage.visitors > 0 && stage.conversions ? parseFloat(((stage.conversions / stage.visitors) * 100).toFixed(2)) : 0,
        revenue: stage.revenue === undefined && index === arr.length -1 ? (stage.conversions || 0) * 100 : stage.revenue || 0, // Simula receita
        trend: stage.trend || (Math.random() > 0.5 ? 'up' : (Math.random() > 0.5 ? 'stable' : 'down')),
      };
    });
    lastStageConversions = funnel.stages[funnel.stages.length - 1].conversions || 0;
  }
  
  return {
    ...funnel,
    totalVisitors,
    totalConversions: lastStageConversions,
    overallConversionRate: totalVisitors > 0 ? parseFloat(((lastStageConversions / totalVisitors) * 100).toFixed(2)) : 0,
    totalRevenue: funnel.stages.reduce((acc, stage) => acc + (stage.revenue || 0), 0),
  };
};


export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);

  const { data: rawFunnelsData = [], isLoading, error, refetch } = useQuery<FunnelData[]>({
    queryKey: ['/api/funnels'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/funnels');
      // Não precisamos mais do .json() aqui se apiRequest já trata
      // e lança erro em caso de !response.ok
      return response.json(); 
    },
  });

  const funnels = rawFunnelsData.map(processFunnelData);

  const selectedFunnelData = selectedFunnelId 
    ? funnels.find(f => f.id === selectedFunnelId) 
    : funnels.length > 0 ? funnels[0] : null;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Carregando funis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Erro ao carregar funis</h2>
        <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
        <Button onClick={() => refetch()}>Tentar Novamente</Button>
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
                 <p className="text-muted-foreground text-center py-4">Nenhum funil encontrado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funnels.map((funnel) => (
                    <div
                      key={funnel.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        (selectedFunnelId === funnel.id || (!selectedFunnelId && funnel.id === funnels[0]?.id))
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
                      +12% desde o mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversões Finais</CardTitle>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(selectedFunnelData.totalConversions || 0).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      +8% desde o mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Conversão Total</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(selectedFunnelData.overallConversionRate || 0).toFixed(2)}%</div>
                    <p className="text-xs text-muted-foreground">
                      -0.3% desde o mês passado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">R$ {(selectedFunnelData.totalRevenue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                    <p className="text-xs text-muted-foreground">
                      +15% desde o mês passado
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visualização do Funil</CardTitle>
                  <CardDescription>
                    Acompanhe o fluxo de usuários através de cada etapa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedFunnelData.stages?.map((stage, index) => (
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
                                  {(stage.conversionRate || 0)}%
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                                <span>{(stage.conversions || 0).toLocaleString()} usuários</span>
                                <span>{(stage.visitors || 0).toLocaleString()} visitantes</span>
                              </div>
                              <Progress value={stage.conversionRate || 0} className="h-2" />
                            </div>
                            {(stage.revenue || 0) > 0 && (
                              <p className="text-sm text-green-600 mt-1">
                                Receita: R$ {(stage.revenue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
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
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          {selectedFunnelData ? (
            <Card>
              <CardHeader>
                <CardTitle>Análise Detalhada por Etapa: {selectedFunnelData.name}</CardTitle>
                <CardDescription>
                  Identifique gargalos e oportunidades de melhoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {selectedFunnelData.stages?.map((stage, index) => (
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
                          <p className="text-2xl font-bold">{(stage.visitors || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Conversões</p>
                          <p className="text-2xl font-bold">{(stage.conversions || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                          <p className="text-2xl font-bold">{(stage.conversionRate || 0)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Drop-off</p>
                          <p className="text-2xl font-bold text-red-500">
                            {index < (selectedFunnelData.stages?.length || 0) - 1 && stage.visitors && stage.visitors > 0
                              ? `${(((stage.visitors - (stage.conversions || 0)) / stage.visitors) * 100).toFixed(1)}%`
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
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-center py-8">Selecione um funil para ver a análise detalhada.</p>
          )}
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
              {/* Conteúdo de otimização (pode ser dinâmico baseado no funil selecionado) */}
              <div className="space-y-4">
                 <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-semibold text-blue-900">🎯 Otimizar Carrinho de Compras</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Analise a taxa de abandono de carrinho. Considere implementar recuperação de carrinho e simplificar o processo.
                  </p>
                  <Button size="sm" className="mt-2">Implementar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
