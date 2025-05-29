import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, TrendingDown, Plus } from 'lucide-react';

interface FunnelStage {
  id: number;
  name: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  trend: 'up' | 'down' | 'stable';
}

interface Funnel {
  id: number;
  name: string;
  campaignId: number;
  stages: FunnelStage[];
  totalVisitors: number;
  totalConversions: number;
  totalRevenue: number;
  overallConversionRate: number;
}

export default function FunnelPage() {
  const [selectedFunnel, setSelectedFunnel] = useState<number | null>(null);

  // Mock data - em produção, viria da API
  const funnels: Funnel[] = [
    {
      id: 1,
      name: 'Funil E-commerce Principal',
      campaignId: 1,
      stages: [
        { id: 1, name: 'Visitantes', visitors: 10000, conversions: 3000, conversionRate: 30, revenue: 0, trend: 'up' },
        { id: 2, name: 'Visualizaram Produto', visitors: 3000, conversions: 1500, conversionRate: 50, revenue: 0, trend: 'stable' },
        { id: 3, name: 'Adicionaram ao Carrinho', visitors: 1500, conversions: 450, conversionRate: 30, revenue: 0, trend: 'down' },
        { id: 4, name: 'Iniciaram Checkout', visitors: 450, conversions: 315, conversionRate: 70, revenue: 0, trend: 'up' },
        { id: 5, name: 'Completaram Compra', visitors: 315, conversions: 252, conversionRate: 80, revenue: 12600, trend: 'up' }
      ],
      totalVisitors: 10000,
      totalConversions: 252,
      totalRevenue: 12600,
      overallConversionRate: 2.52
    },
    {
      id: 2,
      name: 'Funil Lead Generation',
      campaignId: 2,
      stages: [
        { id: 1, name: 'Visitantes', visitors: 8500, conversions: 2550, conversionRate: 30, revenue: 0, trend: 'up' },
        { id: 2, name: 'Leram Landing Page', visitors: 2550, conversions: 1275, conversionRate: 50, revenue: 0, trend: 'stable' },
        { id: 3, name: 'Preencheram Formulário', visitors: 1275, conversions: 382, conversionRate: 30, revenue: 0, trend: 'up' },
        { id: 4, name: 'Confirmaram Email', visitors: 382, conversions: 306, conversionRate: 80, revenue: 0, trend: 'stable' },
        { id: 5, name: 'Tornaram-se Clientes', visitors: 306, conversions: 92, conversionRate: 30, revenue: 9200, trend: 'up' }
      ],
      totalVisitors: 8500,
      totalConversions: 92,
      totalRevenue: 9200,
      overallConversionRate: 1.08
    }
  ];

  const selectedFunnelData = selectedFunnel ? funnels.find(f => f.id === selectedFunnel) : funnels[0];

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return null;
  };

  const getStageIcon = (index: number) => {
    const icons = [Users, MousePointer, ShoppingCart, CreditCard, CreditCard];
    const Icon = icons[index] || Users;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
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
          {/* Seletor de Funil */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Funil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {funnels.map((funnel) => (
                  <div
                    key={funnel.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedFunnel === funnel.id || (!selectedFunnel && funnel.id === 1)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedFunnel(funnel.id)}
                  >
                    <h3 className="font-semibold">{funnel.name}</h3>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-sm text-muted-foreground">
                        {funnel.totalVisitors.toLocaleString()} visitantes
                      </div>
                      <Badge variant="outline">
                        {funnel.overallConversionRate.toFixed(2)}% conversão
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Visitantes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedFunnelData?.totalVisitors.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +12% desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversões</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedFunnelData?.totalConversions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +8% desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedFunnelData?.overallConversionRate.toFixed(2)}%</div>
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
                <div className="text-2xl font-bold">R$ {selectedFunnelData?.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +15% desde o mês passado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Visualização do Funil */}
          <Card>
            <CardHeader>
              <CardTitle>Visualização do Funil</CardTitle>
              <CardDescription>
                Acompanhe o fluxo de usuários através de cada etapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedFunnelData?.stages.map((stage, index) => (
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
                              {stage.conversionRate}%
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
                    {index < selectedFunnelData.stages.length - 1 && (
                      <div className="flex justify-center">
                        <div className="w-px h-4 bg-border"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada por Etapa</CardTitle>
              <CardDescription>
                Identifique gargalos e oportunidades de melhoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {selectedFunnelData?.stages.map((stage, index) => (
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
                        <p className="text-2xl font-bold">{stage.conversionRate}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Drop-off</p>
                        <p className="text-2xl font-bold text-red-500">
                          {index < selectedFunnelData.stages.length - 1 
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

                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <h4 className="font-semibold text-green-900">✅ Checkout Otimizado</h4>
                  <p className="text-sm text-green-800 mt-1">
                    Boa conversão de 80% no checkout. Mantenha o design atual e considere testes A/B para pequenas melhorias.
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <h4 className="font-semibold text-yellow-900">⚠️ Landing Page</h4>
                  <p className="text-sm text-yellow-800 mt-1">
                    Taxa de visualização de produto pode ser melhorada. Teste diferentes posicionamentos de CTA e elementos visuais.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">Agendar Teste A/B</Button>
                </div>

                <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
                  <h4 className="font-semibold text-purple-900">🚀 Upsell e Cross-sell</h4>
                  <p className="text-sm text-purple-800 mt-1">
                    Oportunidade de aumentar receita média por cliente. Implemente sugestões de produtos relacionados.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2">Configurar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}