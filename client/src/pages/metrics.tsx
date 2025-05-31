// client/src/pages/metrics.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, BarChart, PieChart } from '@/components/charts'; // Seus componentes de gráfico
import {
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  CreditCard,
  Users, // Não usado nos exemplos, mas pode ser para dados de audiência
  DollarSign, // Para ROI e Custo
  Activity, // Para CTR
  Download,
  Filter
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Supondo que você tenha um AuthContext
import { toast } from 'sonner'; // Para notificações de erro

// --- Definição de Tipos para os Dados do Backend ---
interface KpiMetrics {
  activeCampaigns: number;
  totalSpent: number;
  totalCostPeriod: number; // Custo dentro do período selecionado
  conversions: number;
  avgROI: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

interface CampaignData { // Para a lista de seleção de campanhas
  id: number;
  name: string;
}

interface CampaignPerformanceData { // Para a tabela de performance por campanha
  id: number;
  name: string;
  // platform: string; // Se for uma string única. Se for array, ajuste.
  platforms: string[]; // Supondo que plataformas seja um array de strings
  status: string;
  impressions?: number; // Métricas podem não estar disponíveis para todas as campanhas
  clicks?: number;
  ctr?: number;
  conversions?: number;
  conversionRate?: number; // Calcule no backend ou frontend
  cost?: number; // Custo específico da campanha no período
  revenue?: number; // Receita específica da campanha no período
  roi?: number; // ROI específico da campanha no período
  budget?: number; // Orçamento total da campanha
  spent?: number; // Gasto total da campanha (pode ser diferente do cost no período)
  // trend?: 'up' | 'down' | 'stable'; // O backend precisará calcular isso
}

interface ChartDataset {
  label?: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  tension?: number;
  fill?: boolean;
  borderWidth?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface DashboardData {
  metrics: KpiMetrics;
  recentCampaigns: CampaignPerformanceData[]; // Para a aba "Por Campanha" se quiser usar dados do dashboard
  alertCount: number;
  trends: { // Variações percentuais
    campaignsChange?: number; // Opcional se não conseguir calcular
    spentChange?: number;
    conversionsChange?: number;
    roiChange?: number;
    impressionsChange?: number;
    clicksChange?: number;
  };
  // Dados para os gráficos
  timeSeriesData: ChartData; // Impressões e Cliques ao longo do tempo
  channelPerformanceData: ChartData; // Distribuição (ex: conversões por plataforma)
  conversionData: ChartData; // Conversões ao longo do tempo
  roiData: ChartData; // ROI por categoria (ex: por mês ou campanha)
  // Você pode adicionar mais como audienceDemographicsData, audienceGeoData etc.
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function MetricsPage() {
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all'); // 'all' ou ID da campanha

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [campaignsList, setCampaignsList] = useState<CampaignData[]>([]); // Para o seletor de campanhas
  const [campaignPerformanceList, setCampaignPerformanceList] = useState<CampaignPerformanceData[]>([]); // Para a aba de campanhas
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca a lista de campanhas para o seletor
  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${API_BASE_URL}/campaigns`, { // Supondo que /api/campaigns retorne {id, name}
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Falha ao buscar campanhas: ${res.statusText}`);
        return res.json();
      })
      .then((data: CampaignData[]) => {
        setCampaignsList(data || []);
      })
      .catch(err => {
        console.error("Erro ao buscar lista de campanhas:", err);
        setError("Não foi possível carregar a lista de campanhas.");
        toast.error("Erro ao carregar lista de campanhas.");
      })
      .finally(() => setIsLoading(false)); // Set loading false aqui ou no fetch principal
  }, [token]);

  // Busca os dados principais do dashboard e/ou dados de performance de campanha
  useEffect(() => {
    if (!token) return;

    // Determina qual endpoint chamar ou como modificar a query
    // Para este exemplo, vamos focar em um endpoint de dashboard que pode ser filtrado.
    // O backend /api/dashboard precisaria aceitar 'campaignId' como query param.
    const fetchUrl = `${API_BASE_URL}/dashboard?timeRange=${selectedPeriod}${selectedCampaignId !== 'all' ? `&campaignId=${selectedCampaignId}` : ''}`;

    setIsLoading(true);
    setError(null);

    fetch(fetchUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Falha ao buscar dados do dashboard: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: DashboardData) => {
        setDashboardData(data);
        // Se o endpoint /api/dashboard também retornar a lista detalhada de campanhas para a aba "Por Campanha"
        // você pode setar aqui. Caso contrário, você precisaria de outro fetch.
        // Por simplicidade, vamos assumir que `data.recentCampaigns` é o que queremos para a lista.
        setCampaignPerformanceList(data.recentCampaigns || []);
      })
      .catch(err => {
        console.error("Erro ao buscar dados do dashboard:", err);
        setError("Não foi possível carregar os dados de métricas.");
        toast.error("Erro ao carregar dados de métricas.");
        setDashboardData(null); // Limpar dados antigos em caso de erro
      })
      .finally(() => setIsLoading(false));

  }, [token, selectedPeriod, selectedCampaignId]);


  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString('pt-BR');
  };

  const getTrendComponent = (value?: number) => {
    if (value === undefined || value === null) return null;
    if (value > 0) return <TrendingUp className="w-3 h-3 mr-1 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-3 h-3 mr-1 text-red-500" />;
    return <span className="w-3 h-3 mr-1 text-muted-foreground">-</span>; // Para estável
  };
  
  // Memoize os dados dos gráficos para evitar recálculos desnecessários
  // Os dados para os gráficos (timeSeriesData, channelPerformanceData, etc.)
  // devem vir do dashboardData e já estar no formato que os componentes de gráfico esperam.
  const memoizedTimeSeriesData = useMemo(() => dashboardData?.timeSeriesData || { labels: [], datasets: [] }, [dashboardData]);
  const memoizedChannelData = useMemo(() => dashboardData?.channelPerformanceData || { labels: [], datasets: [] }, [dashboardData]);
  const memoizedRoiData = useMemo(() => dashboardData?.roiData || { labels: [], datasets: [] }, [dashboardData]);
  // const memoizedConversionData = useMemo(() => dashboardData?.conversionData || { labels: [], datasets: [] }, [dashboardData]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Carregando métricas...</div>;
  }

  if (error && !dashboardData) { // Mostrar erro apenas se não houver dados antigos para exibir
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  // Se não houver dados após o carregamento (e sem erro que impediu o fetch inicial)
  if (!dashboardData) {
    return <div className="text-center p-4">Nenhuma métrica disponível.</div>;
  }

  const kpis = dashboardData.metrics;
  const trends = dashboardData.trends;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Métricas e Analytics</h1>
          <p className="text-muted-foreground">
            Análise detalhada de performance das suas campanhas e marketing.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtros (Em breve)
          </Button>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Exportar (Em breve)
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            {/* <SelectItem value="365d">Último ano</SelectItem> */}
          </SelectContent>
        </Select>

        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-full sm:w-60">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaignsList.map(campaign => (
              <SelectItem key={campaign.id} value={String(campaign.id)}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}


      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Por Campanha</TabsTrigger>
          <TabsTrigger value="platforms">Por Plataforma</TabsTrigger>
          {/* <TabsTrigger value="audience">Audiência</TabsTrigger> */}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressões</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(kpis.impressions)}</div>
                {trends.impressionsChange !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    {getTrendComponent(trends.impressionsChange)}
                    {trends.impressionsChange > 0 ? '+' : ''}{formatPercentage(trends.impressionsChange)} vs. período anterior
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cliques</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(kpis.clicks)}</div>
                 {trends.clicksChange !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    {getTrendComponent(trends.clicksChange)}
                    {trends.clicksChange > 0 ? '+' : ''}{formatPercentage(trends.clicksChange)} vs. período anterior
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversões</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(kpis.conversions)}</div>
                {trends.conversionsChange !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    {getTrendComponent(trends.conversionsChange)}
                     {trends.conversionsChange > 0 ? '+' : ''}{formatPercentage(trends.conversionsChange)} vs. período anterior
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI Médio</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(kpis.avgROI)}</div>
                {trends.roiChange !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center">
                     {getTrendComponent(trends.roiChange)}
                     {trends.roiChange > 0 ? '+' : ''}{formatPercentage(trends.roiChange)} vs. período anterior
                  </p>
                )}
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CTR</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(kpis.ctr)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPC Médio</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.cpc)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo (Período)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.totalCostPeriod)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(kpis.activeCampaigns)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance ao Longo do Tempo</CardTitle>
                <CardDescription>Métricas chave do período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart data={memoizedTimeSeriesData} className="h-80" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Canal</CardTitle>
                <CardDescription>Performance agregada por plataforma/canal</CardDescription>
              </CardHeader>
              <CardContent>
                 <PieChart data={memoizedChannelData} className="h-80" />
              </CardContent>
            </Card>
          </div>
           <Card>
            <CardHeader>
              <CardTitle>ROI por Campanha (Top 5)</CardTitle> {/* Ou por Mês, ajuste no backend */}
              <CardDescription>Retorno sobre investimento das principais campanhas</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart data={memoizedRoiData} className="h-80" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Detalhada por Campanha</CardTitle>
              <CardDescription>
                Métricas detalhadas de cada campanha no período selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignPerformanceList.length > 0 ? campaignPerformanceList.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                      <div>
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {campaign.platforms?.map(p => <Badge key={p} variant="secondary">{p}</Badge>)}
                            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>{campaign.status}</Badge>
                        </div>
                      </div>
                      <Badge 
                        variant={ (campaign.roi || 0) > 100 ? 'success' : (campaign.roi || 0) > 0 ? 'default' : 'destructive'} 
                        className="text-sm"
                      >
                        ROI: {formatPercentage(campaign.roi)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Impressões</p><p className="font-semibold">{formatNumber(campaign.impressions)}</p></div>
                      <div><p className="text-muted-foreground">Cliques</p><p className="font-semibold">{formatNumber(campaign.clicks)}</p></div>
                      <div><p className="text-muted-foreground">CTR</p><p className="font-semibold">{formatPercentage(campaign.ctr)}</p></div>
                      <div><p className="text-muted-foreground">Conversões</p><p className="font-semibold">{formatNumber(campaign.conversions)}</p></div>
                      <div><p className="text-muted-foreground">Custo</p><p className="font-semibold">{formatCurrency(campaign.cost)}</p></div>
                      <div><p className="text-muted-foreground">Receita</p><p className="font-semibold text-green-600">{formatCurrency(campaign.revenue)}</p></div>
                       <div><p className="text-muted-foreground">Orçamento Total</p><p className="font-semibold">{formatCurrency(campaign.budget)}</p></div>
                    </div>
                  </div>
                )) : <p>Nenhuma campanha para exibir com os filtros selecionados.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
            {/* Aqui você precisaria de dados específicos por plataforma */}
            {/* Similar à aba "Visão Geral" (channelPerformanceData), mas talvez mais detalhado */}
            <Card>
                <CardHeader><CardTitle>Performance por Plataforma (Detalhado)</CardTitle></CardHeader>
                <CardContent>
                    <p>Dados detalhados por plataforma virão aqui.</p>
                    <PieChart data={memoizedChannelData} className="h-80" />
                </CardContent>
            </Card>
        </TabsContent>

        {/* <TabsContent value="audience" className="space-y-4"> ... (Seu código mockado para audiência) ... </TabsContent> */}
      </Tabs>
    </div>
  );
}
