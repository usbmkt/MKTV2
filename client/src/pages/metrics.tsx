// client/src/pages/metrics.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, BarChart, PieChart } from '@/components/charts';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  CreditCard,
  DollarSign,
  Activity,
  Download,
  Filter,
  AlertCircle // Para erros
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner'; // Assumindo que foi instalado: npm install sonner

// --- Definição de Tipos para os Dados do Backend ---
// Estes tipos devem corresponder EXATAMENTE ao que seu endpoint /api/dashboard retorna
interface KpiMetrics {
  activeCampaigns: number;
  totalSpent: number;        // Gasto total histórico ou do período? Backend decide.
  totalCostPeriod: number;   // Custo real dentro do timeRange selecionado.
  conversions: number;
  avgROI: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

interface CampaignData {
  id: number;
  name: string;
}

interface CampaignPerformanceData {
  id: number;
  name: string;
  platforms: string[];
  status: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  conversions?: number;
  conversionRate?: number; // Backend calcula: (conversions / clicks) * 100
  cost?: number;          // Custo da campanha NO PERÍODO SELECIONADO
  revenue?: number;       // Receita da campanha NO PERÍODO SELECIONADO
  roi?: number;           // ROI da campanha NO PERÍODO SELECIONADO
  budget?: number;        // Orçamento total definido para a campanha
  // trend?: 'up' | 'down' | 'stable'; // Backend precisa calcular
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
  // Para a aba "Por Campanha", idealmente viria de um fetch separado com paginação/filtros
  // mas pode vir do dashboard se for uma lista curta "recentes" ou "top".
  // O backend precisa fornecer os dados de performance por campanha DENTRO DO timeRange.
  campaignPerformanceDetails: CampaignPerformanceData[];
  alertCount: number;
  trends: {
    // Backend precisa calcular estas variações percentuais comparando com o período anterior
    impressionsChange?: number;
    clicksChange?: number;
    conversionsChange?: number;
    roiChange?: number;
    // Adicione outros trends se necessário (ex: spentChange)
  };
  // Backend precisa preencher estes com dados reais agregados
  timeSeriesData: ChartData;        // Ex: Impressões e Cliques por dia/semana/mês
  channelPerformanceData: ChartData;  // Ex: Conversões (ou Custo, ou Receita) por Plataforma
  // conversionData: ChartData;     // Se for um gráfico diferente de timeSeriesData para conversões
  roiData: ChartData;               // Ex: ROI por Campanha ou por Mês
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function MetricsPage() {
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [campaignsList, setCampaignsList] = useState<CampaignData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca a lista de todas as campanhas para o seletor
  useEffect(() => {
    if (!token) return;
    // Não precisa de setIsLoading(true) aqui se o fetch principal já o faz
    fetch(`${API_BASE_URL}/campaigns`, { // Este endpoint deve retornar apenas {id, name}
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Falha ao buscar lista de campanhas: ${res.status}`);
        return res.json();
      })
      .then((data: CampaignData[]) => setCampaignsList(data || []))
      .catch(err => {
        console.error("Erro ao buscar lista de campanhas:", err);
        toast.error("Erro ao carregar lista de campanhas.", { description: err.message });
      });
  }, [token]);

  // Busca os dados principais do dashboard
  useEffect(() => {
    if (!token) {
      setIsLoading(false); // Garante que loading para se não houver token
      return;
    }

    // O backend /api/dashboard precisa aceitar 'timeRange' e 'campaignId' (opcional)
    // e retornar TODOS os dados necessários, incluindo os agregados para os gráficos.
    const fetchUrl = `${API_BASE_URL}/dashboard?timeRange=${selectedPeriod}${selectedCampaignId !== 'all' ? `&campaignId=${selectedCampaignId}` : ''}`;

    setIsLoading(true);
    setError(null);
    console.log(`[MetricsPage] Fetching dashboard data from: ${fetchUrl}`);

    fetch(fetchUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => { // Tenta pegar corpo do erro se JSON
            throw new Error(`Falha ao buscar dados: ${res.status} - ${errData.error || res.statusText}`);
          }).catch(() => { // Se o corpo não for JSON
            throw new Error(`Falha ao buscar dados: ${res.status} - ${res.statusText}`);
          });
        }
        return res.json();
      })
      .then((data: DashboardData) => {
        console.log('[MetricsPage] Dashboard data received:', data);
        setDashboardData(data);
      })
      .catch(err => {
        console.error("[MetricsPage] Erro ao buscar dados do dashboard:", err);
        const errorMessage = err.message || "Não foi possível carregar os dados de métricas.";
        setError(errorMessage);
        toast.error("Erro ao carregar métricas.", { description: errorMessage });
        setDashboardData(null);
      })
      .finally(() => setIsLoading(false));

  }, [token, selectedPeriod, selectedCampaignId]);

  // Funções de formatação (mantidas)
  const formatCurrency = (value?: number) => { if (value === undefined || value === null || isNaN(value)) return 'N/A'; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); };
  const formatPercentage = (value?: number) => { if (value === undefined || value === null || isNaN(value)) return 'N/A'; return `${value.toFixed(2)}%`; };
  const formatNumber = (value?: number) => { if (value === undefined || value === null || isNaN(value)) return 'N/A'; return value.toLocaleString('pt-BR'); };
  const getTrendComponent = (value?: number) => { if (value === undefined || value === null || isNaN(value)) return null; if (value > 0) return <TrendingUp className="w-3 h-3 mr-1 text-green-500" />; if (value < 0) return <TrendingDown className="w-3 h-3 mr-1 text-red-500" />; return <span className="w-3 h-3 mr-1 text-muted-foreground">-</span>; };

  // Memoização dos dados para gráficos
  const memoizedTimeSeriesData = useMemo(() => dashboardData?.timeSeriesData || { labels: [], datasets: [] }, [dashboardData]);
  const memoizedChannelData = useMemo(() => dashboardData?.channelPerformanceData || { labels: [], datasets: [] }, [dashboardData]);
  const memoizedRoiData = useMemo(() => dashboardData?.roiData || { labels: [], datasets: [] }, [dashboardData]);
  // const memoizedConversionData = useMemo(() => dashboardData?.conversionData || { labels: [], datasets: [] }, [dashboardData]); // Se tiver um gráfico separado para conversões

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Carregando métricas...</p></div>;
  }

  if (error && !dashboardData) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-600 p-4">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Erro ao Carregar Métricas</h2>
        <p className="text-center">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">Tentar Novamente</Button>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-center p-4 pt-10">Nenhuma métrica disponível para os filtros selecionados.</div>;
  }

  const kpis = dashboardData.metrics;
  const trends = dashboardData.trends;
  const campaignPerformanceDetails = dashboardData.campaignPerformanceDetails || []; // Usa o novo campo

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Métricas e Analytics</h1>
          <p className="text-muted-foreground">
            Análise detalhada de performance das suas campanhas e marketing.
          </p>
        </div>
        {/* Botões de Filtros e Exportar podem ser implementados futuramente */}
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
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
      {/* Se houver um erro mas dados antigos são mostrados, pode exibir aqui */}
      {error && dashboardData && <p className="text-sm text-red-500 mt-2">Aviso: {error}</p>}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Por Campanha</TabsTrigger>
          <TabsTrigger value="platforms">Por Plataforma</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPIs */}
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Impressões</CardTitle><Eye className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(kpis.impressions)}</div>{trends.impressionsChange !== undefined && (<p className="text-xs text-muted-foreground flex items-center">{getTrendComponent(trends.impressionsChange)}{trends.impressionsChange > 0 ? '+' : ''}{formatPercentage(trends.impressionsChange)}</p>)}</CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Cliques</CardTitle><MousePointer className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(kpis.clicks)}</div>{trends.clicksChange !== undefined && (<p className="text-xs text-muted-foreground flex items-center">{getTrendComponent(trends.clicksChange)}{trends.clicksChange > 0 ? '+' : ''}{formatPercentage(trends.clicksChange)}</p>)}</CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Conversões</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(kpis.conversions)}</div>{trends.conversionsChange !== undefined && (<p className="text-xs text-muted-foreground flex items-center">{getTrendComponent(trends.conversionsChange)}{trends.conversionsChange > 0 ? '+' : ''}{formatPercentage(trends.conversionsChange)}</p>)}</CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">ROI Médio</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatPercentage(kpis.avgROI)}</div>{trends.roiChange !== undefined && (<p className="text-xs text-muted-foreground flex items-center">{getTrendComponent(trends.roiChange)}{trends.roiChange > 0 ? '+' : ''}{formatPercentage(trends.roiChange)}</p>)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CTR</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatPercentage(kpis.ctr)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CPC Médio</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.cpc)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Custo (Período)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalCostPeriod)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(kpis.activeCampaigns)}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Performance ao Longo do Tempo</CardTitle><CardDescription>Impressões e cliques no período</CardDescription></CardHeader><CardContent><LineChart data={memoizedTimeSeriesData} className="h-80" /></CardContent></Card>
            <Card><CardHeader><CardTitle>Desempenho por Canal</CardTitle><CardDescription>Contribuição por plataforma</CardDescription></CardHeader><CardContent><PieChart data={memoizedChannelData} className="h-80" /></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>ROI Agregado</CardTitle><CardDescription>Retorno sobre investimento (detalhar dimensão no backend)</CardDescription></CardHeader><CardContent><BarChart data={memoizedRoiData} className="h-80" /></CardContent></Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Performance Detalhada por Campanha</CardTitle><CardDescription>Métricas por campanha no período selecionado</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignPerformanceDetails.length > 0 ? campaignPerformanceDetails.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                      <div>
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {campaign.platforms?.map(p => <Badge key={p} variant="secondary">{p}</Badge>)}
                            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>{campaign.status}</Badge>
                        </div>
                      </div>
                      <Badge variant={(campaign.roi || 0) > 100 ? 'success' : (campaign.roi || 0) > 0 ? 'default' : 'destructive'} className="text-sm">ROI: {formatPercentage(campaign.roi)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Impressões</p><p className="font-semibold">{formatNumber(campaign.impressions)}</p></div>
                      <div><p className="text-muted-foreground">Cliques</p><p className="font-semibold">{formatNumber(campaign.clicks)}</p></div>
                      <div><p className="text-muted-foreground">CTR</p><p className="font-semibold">{formatPercentage(campaign.ctr)}</p></div>
                      <div><p className="text-muted-foreground">Conversões</p><p className="font-semibold">{formatNumber(campaign.conversions)}</p></div>
                      <div><p className="text-muted-foreground">Custo (Per.)</p><p className="font-semibold">{formatCurrency(campaign.cost)}</p></div>
                      <div><p className="text-muted-foreground">Receita (Per.)</p><p className="font-semibold text-green-600">{formatCurrency(campaign.revenue)}</p></div>
                      <div><p className="text-muted-foreground">Orçamento</p><p className="font-semibold">{formatCurrency(campaign.budget)}</p></div>
                    </div>
                  </div>
                )) : <p>Nenhuma campanha para exibir com os filtros selecionados ou nenhuma campanha retornada.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
            <Card>
                <CardHeader><CardTitle>Performance Detalhada por Plataforma</CardTitle><CardDescription>O backend precisa fornecer esses dados agregados</CardDescription></CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Gráfico de exemplo, dados reais virão do backend.</p>
                    {memoizedChannelData.datasets.length > 0 && memoizedChannelData.datasets[0].data.length > 0 ? (
                       <PieChart data={memoizedChannelData} className="h-80" />
                    ) : (
                       <p>Dados de performance por plataforma não disponíveis.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
