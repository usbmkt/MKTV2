// client/src/pages/dashboard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, BarChart, DoughnutChart, chartColors } from '@/components/charts';
import { apiRequest } from '@/lib/api'; // <--- AGORA IMPORTA apiRequest
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  DollarSign,
  Target,
  Eye,
  BarChart3,
  PieChart,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

// Interfaces para os dados dos gráficos
interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  fill?: boolean;
  tension?: number;
  borderWidth?: number;
}

interface LineChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface BarChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface DoughnutChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// Interface principal para os dados do Dashboard (vindos do backend)
interface DashboardData {
  metrics: {
    activeCampaigns: number;
    totalSpent: number;
    conversions: number;
    avgROI: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
  };
  recentCampaigns: Array<{
    id: number;
    name: string;
    description: string;
    status: string;
    platforms: string[];
    budget: number;
    spent: number;
    performance: number;
  }>;
  alertCount: number;
  trends: {
    campaignsChange: number;
    spentChange: number;
    conversionsChange: number;
    roiChange: number;
  };
  // Dados dos gráficos
  timeSeriesData: LineChartData;
  channelPerformanceData: DoughnutChartData;
  conversionData: LineChartData;
  roiData: BarChartData;
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('conversions');

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboardData', timeRange],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dashboard?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar dados do dashboard');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'paused': return <Badge variant="secondary">Pausado</Badge>;
      // CORREÇÃO AQUI
      case 'completed': return <Badge variant="outline">Concluído</Badge>;
      default: return <Badge variant="destructive">Rascunho</Badge>;
    }
  };

  const getTrendIcon = (change: number) => {
    return change >= 0 ?
      <TrendingUp className="w-4 h-4 text-green-500" /> :
      <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="neu-card">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-center text-muted-foreground py-10">Nenhum dado disponível.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das suas campanhas e performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Adicionar lógica para o filtro de tempo, se aplicável */}
          {/* <Button variant="outline" size="sm" className="neu-button" onClick={() => setTimeRange('7d')}>7d</Button>
          <Button variant="outline" size="sm" className="neu-button" onClick={() => setTimeRange('30d')}>30d</Button> */}
          <Button variant="outline" size="sm" className="neu-button">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="neu-button">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="neu-button"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="neu-card animate-scale-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Campanhas Ativas
              </CardTitle>
              <Activity className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{dashboardData.metrics.activeCampaigns}</div>
                <div className="flex items-center space-x-1 text-sm">
                  {getTrendIcon(dashboardData.trends.campaignsChange)}
                  <span className={dashboardData.trends.campaignsChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(dashboardData.trends.campaignsChange)}%
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card animate-scale-in" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investido
              </CardTitle>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {formatCurrency(dashboardData.metrics.totalSpent)}
                </div>
                <div className="flex items-center space-x-1 text-sm">
                  {getTrendIcon(dashboardData.trends.spentChange)}
                  <span className={dashboardData.trends.spentChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(dashboardData.trends.spentChange)}%
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card animate-scale-in" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversões
              </CardTitle>
              <Target className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {formatNumber(dashboardData.metrics.conversions)}
                </div>
                <div className="flex items-center space-x-1 text-sm">
                  {getTrendIcon(dashboardData.trends.conversionsChange)}
                  <span className={dashboardData.trends.conversionsChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(dashboardData.trends.conversionsChange)}%
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card animate-scale-in" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ROI Médio
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {dashboardData.metrics.avgROI}x
                </div>
                <div className="flex items-center space-x-1 text-sm">
                  {getTrendIcon(dashboardData.trends.roiChange)}
                  <span className={dashboardData.trends.roiChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(dashboardData.trends.roiChange)}%
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="neu-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Impressões</p>
                <p className="text-2xl font-bold">
                  {formatNumber(dashboardData.metrics.impressions)}
                </p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cliques</p>
                <p className="text-2xl font-bold">
                  {formatNumber(dashboardData.metrics.clicks)}
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CTR</p>
                <p className="text-2xl font-bold">{dashboardData.metrics.ctr}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CPC</p>
                <p className="text-2xl font-bold">R$ {dashboardData.metrics.cpc}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="neu-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Performance ao Longo do Tempo</span>
            </CardTitle>
            <CardDescription>
              Métricas de performance dos últimos {timeRange === '30d' ? '30 dias' : '7 dias'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dashboardData.timeSeriesData && <LineChart data={dashboardData.timeSeriesData} />}
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>Distribuição por Canal</span>
            </CardTitle>
            <CardDescription>
              Performance por tipo de campanha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dashboardData.channelPerformanceData && <DoughnutChart data={dashboardData.channelPerformanceData} />}
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Conversões por Mês</span>
            </CardTitle>
            <CardDescription>
              Evolução das conversões mensais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dashboardData.conversionData && <LineChart data={dashboardData.conversionData} />}
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>ROI por Plataforma</span>
            </CardTitle>
            <CardDescription>
              Retorno sobre investimento por canal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dashboardData.roiData && <BarChart data={dashboardData.roiData} />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campanhas Recentes</CardTitle>
              <CardDescription>
                Últimas campanhas criadas e sua performance atual
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="neu-button">
              Ver Todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData.recentCampaigns.length > 0 ? (
              dashboardData.recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 neu-card hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 neu-card flex items-center justify-center">
                      <Activity className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground">{campaign.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {campaign.platforms.map((platform) => (
                          <Badge key={platform} variant="outline" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Orçamento</p>
                        <p className="font-semibold">{formatCurrency(campaign.budget)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Gasto</p>
                        <p className="font-semibold">{formatCurrency(campaign.spent)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Performance</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${campaign.performance}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{campaign.performance}%</span>
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(campaign.status)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">Nenhuma campanha recente para exibir.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
