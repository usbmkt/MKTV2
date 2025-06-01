// client/src/pages/metrics.tsx
import { useState } from 'react';
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
  Users,
  Calendar,
  Download,
  Filter
} from 'lucide-react';

export default function Metrics() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedCampaign, setSelectedCampaign] = useState('all');

  // Dados de performance das campanhas
  const campaignMetrics = [
    {
      id: 1,
      name: 'Campanha E-commerce Q1',
      platform: 'Facebook',
      impressions: 125000,
      clicks: 3750,
      ctr: 3.0,
      conversions: 189,
      conversionRate: 5.04,
      cost: 2350,
      revenue: 9450,
      roi: 302,
      trend: 'up'
    },
    {
      id: 2,
      name: 'Google Ads - Produtos',
      platform: 'Google',
      impressions: 89000,
      clicks: 2670,
      ctr: 3.0,
      conversions: 160,
      conversionRate: 5.99,
      cost: 1890,
      revenue: 8000,
      roi: 323,
      trend: 'up'
    },
    {
      id: 3,
      name: 'Instagram Stories',
      platform: 'Instagram',
      impressions: 67000,
      clicks: 2010,
      ctr: 3.0,
      conversions: 95,
      conversionRate: 4.73,
      cost: 1200,
      revenue: 4750,
      roi: 296,
      trend: 'stable'
    }
  ];

  // Dados do gráfico de performance temporal
  const performanceData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [
      {
        label: 'Impressões',
        data: [45000, 52000, 48000, 61000, 55000, 67000, 73000, 69000, 78000, 85000, 82000, 95000],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Cliques',
        data: [1350, 1560, 1440, 1830, 1650, 2010, 2190, 2070, 2340, 2550, 2460, 2850],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      }
    ]
  };

  // Dados do gráfico de conversões por plataforma
  const platformData = {
    labels: ['Facebook', 'Google Ads', 'Instagram', 'LinkedIn', 'TikTok'],
    datasets: [{
      data: [35, 28, 18, 12, 7],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 101, 101, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(139, 92, 246, 0.8)'
      ]
    }]
  };

  // Dados do gráfico de ROI por mês
  const roiData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    datasets: [{
      label: 'ROI (%)',
      data: [280, 310, 295, 320, 315, 340],
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgb(16, 185, 129)',
      borderWidth: 2
    }]
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Métricas e Analytics</h1>
          <p className="text-muted-foreground">
            Análise detalhada de performance das suas campanhas
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex space-x-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="365d">Último ano</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            <SelectItem value="1">Campanha E-commerce Q1</SelectItem>
            <SelectItem value="2">Google Ads - Produtos</SelectItem>
            <SelectItem value="3">Instagram Stories</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Por Campanha</TabsTrigger>
          <TabsTrigger value="platforms">Por Plataforma</TabsTrigger>
          <TabsTrigger value="audience">Audiência</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressões Totais</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">281K</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  +15% desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cliques Totais</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.4K</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  +12% desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversões</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">444</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  +8% desde o mês passado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">312%</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  +18% desde o mês passado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance ao Longo do Tempo</CardTitle>
                <CardDescription>Impressões e cliques dos últimos 12 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart 
                  data={performanceData} 
                  className="h-80"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Plataforma</CardTitle>
                <CardDescription>Conversões por canal de marketing</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart 
                  data={platformData} 
                  className="h-80"
                />
              </CardContent>
            </Card>
          </div>

          {/* ROI por Mês */}
          <Card>
            <CardHeader>
              <CardTitle>ROI por Mês</CardTitle>
              <CardDescription>Retorno sobre investimento mensal</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart 
                data={roiData} 
                className="h-80"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Campanha</CardTitle>
              <CardDescription>
                Métricas detalhadas de cada campanha ativa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignMetrics.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <Badge variant="outline">{campaign.platform}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(campaign.trend)}
                        <Badge variant={campaign.roi > 300 ? 'default' : 'secondary'}>
                          ROI: {campaign.roi}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Impressões</p>
                        <p className="font-semibold">{campaign.impressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliques</p>
                        <p className="font-semibold">{campaign.clicks.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-semibold">{campaign.ctr.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversões</p>
                        <p className="font-semibold">{campaign.conversions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taxa Conv.</p>
                        <p className="font-semibold">{campaign.conversionRate.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Investimento</p>
                        <p className="font-semibold">{formatCurrency(campaign.cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Receita</p>
                        <p className="font-semibold text-green-600">{formatCurrency(campaign.revenue)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  Facebook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Impressões</span>
                    <span className="font-semibold">125K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversões</span>
                    <span className="font-semibold">189</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ROI</span>
                    <span className="font-semibold text-green-600">302%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Google Ads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Impressões</span>
                    <span className="font-semibold">89K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversões</span>
                    <span className="font-semibold">160</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ROI</span>
                    <span className="font-semibold text-green-600">323%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="w-3 h-3 bg-pink-500 rounded-full mr-2"></div>
                  Instagram
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Impressões</span>
                    <span className="font-semibold">67K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversões</span>
                    <span className="font-semibold">95</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ROI</span>
                    <span className="font-semibold text-green-600">296%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Demografia da Audiência</CardTitle>
                <CardDescription>Distribuição por idade e gênero</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">18-24 anos</span>
                      <span className="text-sm">15%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '15%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">25-34 anos</span>
                      <span className="text-sm">35%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '35%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">35-44 anos</span>
                      <span className="text-sm">28%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '28%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">45+ anos</span>
                      <span className="text-sm">22%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '22%'}}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Localização Geográfica</CardTitle>
                <CardDescription>Top 5 cidades com mais conversões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">São Paulo, SP</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '45%'}}></div>
                      </div>
                      <span className="text-sm font-semibold">45%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Rio de Janeiro, RJ</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '23%'}}></div>
                      </div>
                      <span className="text-sm font-semibold">23%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Belo Horizonte, MG</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '12%'}}></div>
                      </div>
                      <span className="text-sm font-semibold">12%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Brasília, DF</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '10%'}}></div>
                      </div>
                      <span className="text-sm font-semibold">10%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Curitiba, PR</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: '10%'}}></div>
                      </div>
                      <span className="text-sm font-semibold">10%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
