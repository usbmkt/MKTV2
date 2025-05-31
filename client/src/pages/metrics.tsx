import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import type { SelectMetric } from '../../shared/schema'; // Corrigido para usar 'type' para importação de tipos
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target, Users, Activity, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';

// Interface para dados de métricas, incluindo nome da campanha opcional
interface MetricWithCampaignName extends SelectMetric {
    campaign?: {
        name?: string | null;
        id?: number | null;
    } | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D', '#FF7F50', '#DC143C'];
const RADIAN = Math.PI / 180;

// Função para renderizar rótulos customizados no gráfico de pizza
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent * 100 < 5) return null; // Não renderiza labels muito pequenas para evitar sobreposição

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${name} (${(percent * 100).toFixed(0)}%)`}
        </text>
    );
};


const MetricsPage = () => {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

    // Busca os dados de métricas da API
    const { data: metricsData, isLoading, error } = useQuery<MetricWithCampaignName[]>({
        queryKey: ['allUserMetrics'], // Chave da query para caching
        queryFn: async () => apiRequest<MetricWithCampaignName[]>('/api/metrics', 'GET'), // Função que busca os dados
    });

    // Memoiza a lista de campanhas para o filtro dropdown
    const campaignsList = useMemo(() => {
        if (!metricsData) return [];
        const campaignsMap = new Map<number, string>();
        metricsData.forEach(metric => {
            if (metric.campaign?.id && metric.campaign?.name) {
                campaignsMap.set(metric.campaign.id, metric.campaign.name);
            }
        });
        return Array.from(campaignsMap.entries()).map(([id, name]) => ({ id, name }));
    }, [metricsData]);

    // Memoiza as métricas filtradas com base na campanha selecionada
    const filteredMetrics = useMemo(() => {
        if (!metricsData) return [];
        if (selectedCampaignId === "all") {
            return metricsData; // Retorna todas as métricas se "Todas as Campanhas" estiver selecionado
        }
        return metricsData.filter(metric => metric.campaign?.id === parseInt(selectedCampaignId));
    }, [metricsData, selectedCampaignId]);


    // Memoiza as métricas agregadas (KPIs)
    const aggregatedMetrics = useMemo(() => {
        if (!filteredMetrics || filteredMetrics.length === 0) {
            return { // Valores padrão se não houver métricas
                totalImpressions: 0, totalClicks: 0, totalConversions: 0,
                totalCost: 0, totalRevenue: 0, totalLeads: 0,
                ctr: 0, cpc: 0, cpa: 0, roi: 0,
            };
        }
        // Calcula os totais
        const totals = filteredMetrics.reduce((acc, metric) => {
            acc.totalImpressions += metric.impressions || 0;
            acc.totalClicks += metric.clicks || 0;
            acc.totalConversions += metric.conversions || 0;
            acc.totalCost += parseFloat(metric.cost?.toString() || '0'); // Garante que é string antes do parseFloat
            acc.totalRevenue += parseFloat(metric.revenue?.toString() || '0');
            acc.totalLeads += metric.leads || 0;
            return acc;
        }, {
            totalImpressions: 0, totalClicks: 0, totalConversions: 0,
            totalCost: 0, totalRevenue: 0, totalLeads: 0,
        });

        // Calcula métricas derivadas (CTR, CPC, CPA, ROI)
        const ctr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
        const cpc = totals.totalClicks > 0 ? totals.totalCost / totals.totalClicks : 0;
        const cpa = totals.totalConversions > 0 ? totals.totalCost / totals.totalConversions : 0;
        const roi = totals.totalCost > 0 ? ((totals.totalRevenue - totals.totalCost) / totals.totalCost) * 100 : (totals.totalRevenue > 0 ? Infinity : 0);

        return { ...totals, ctr, cpc, cpa, roi };
    }, [filteredMetrics]);

    // Memoiza os dados para o gráfico de série temporal
    const timeSeriesData = useMemo(() => {
        if (!filteredMetrics) return [];
        const series: { [date: string]: { date: string, impressions: number, clicks: number, cost: number, conversions: number } } = {};
        filteredMetrics.forEach(m => {
            const dateStr = m.date ? format(parseISO(m.date), 'dd/MM/yy', { locale: ptBR }) : 'N/A';
            if (!series[dateStr]) {
                series[dateStr] = { date: dateStr, impressions: 0, clicks: 0, cost: 0, conversions: 0 };
            }
            series[dateStr].impressions += m.impressions || 0;
            series[dateStr].clicks += m.clicks || 0;
            series[dateStr].cost += parseFloat(m.cost?.toString() || '0');
            series[dateStr].conversions += m.conversions || 0;
        });
        // Ordena os dados por data para o gráfico
        return Object.values(series).sort((a, b) => parseISO(a.date.split('/').reverse().join('-')).getTime() - parseISO(b.date.split('/').reverse().join('-')).getTime());
    }, [filteredMetrics]);

    // Memoiza os dados para os gráficos de pizza e barras (agrupados por campanha)
    const metricsByCampaign = useMemo(() => {
        if (!filteredMetrics) return [];
        const byCampaign: { [campaignName: string]: { name: string, cost: number, revenue: number, conversions: number } } = {};
        filteredMetrics.forEach(m => {
            const campaignName = m.campaign?.name || 'Campanha Desconhecida';
            if (!byCampaign[campaignName]) {
                byCampaign[campaignName] = { name: campaignName, cost: 0, revenue: 0, conversions: 0 };
            }
            byCampaign[campaignName].cost += parseFloat(m.cost?.toString() || '0');
            byCampaign[campaignName].revenue += parseFloat(m.revenue?.toString() || '0');
            byCampaign[campaignName].conversions += m.conversions || 0;
        });
        return Object.values(byCampaign);
    }, [filteredMetrics]);

    // Renderiza Skeletons enquanto os dados estão carregando
    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    // Renderiza mensagem de erro se a busca falhar
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Erro ao carregar métricas</h2>
                <p className="text-muted-foreground">{(error as any)?.message || 'Não foi possível buscar os dados. Tente novamente mais tarde.'}</p>
            </div>
        );
    }

    // Renderiza mensagem se não houver nenhuma métrica para o usuário (quando nenhum filtro é aplicado)
    if (!metricsData || metricsData.length === 0 && selectedCampaignId === "all") {
         return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <Activity className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Nenhuma métrica encontrada</h2>
                <p className="text-muted-foreground">Ainda não há dados de métricas para exibir.</p>
                 <p className="text-muted-foreground mt-1">Experimente criar algumas campanhas e registrar métricas.</p>
            </div>
        );
    }

    // Renderização principal da página de métricas
    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Análise de Métricas</h1>
                <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger className="w-full sm:w-[250px]">
                            <SelectValue placeholder="Filtrar por campanha" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Campanhas</SelectItem>
                            {campaignsList.map(campaign => (
                                <SelectItem key={campaign.id} value={String(campaign.id)}>
                                    {campaign.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {/* Mensagem se nenhuma métrica for encontrada para uma campanha específica filtrada */}
             {filteredMetrics.length === 0 && selectedCampaignId !== "all" ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Nenhuma Métrica para "{campaignsList.find(c => c.id === parseInt(selectedCampaignId))?.name}"</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Não há dados de métricas registrados para a campanha selecionada.</p>
                    </CardContent>
                </Card>
            ) : (
            <> {/* Fragmento para agrupar os cards e gráficos quando há dados */}
            {/* Cards de KPI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Impressões Totais</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{aggregatedMetrics.totalImpressions.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cliques Totais</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{aggregatedMetrics.totalClicks.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">CTR: {aggregatedMetrics.ctr.toFixed(2)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversões Totais</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{aggregatedMetrics.totalConversions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Leads: {aggregatedMetrics.totalLeads.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {aggregatedMetrics.totalCost.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">CPC: R$ {aggregatedMetrics.cpc.toFixed(2)} | CPA: R$ {aggregatedMetrics.cpa.toFixed(2)}</p>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {aggregatedMetrics.totalRevenue.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ROI (Retorno Sobre Investimento)</CardTitle>
                        {aggregatedMetrics.roi >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${aggregatedMetrics.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {isFinite(aggregatedMetrics.roi) ? `${aggregatedMetrics.roi.toFixed(2)}%` : "N/A"}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Desempenho ao Longo do Tempo */}
            <Card>
                <CardHeader>
                    <CardTitle>Desempenho ao Longo do Tempo</CardTitle>
                    <CardDescription>Impressões, cliques e custo registrados por data.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                labelFormatter={(label) => `Data: ${label}`}
                                formatter={(value, name) => [ name === 'cost' ? `R$ ${Number(value).toFixed(2)}` : Number(value).toLocaleString(), name === 'impressions' ? 'Impressões' : name === 'clicks' ? 'Cliques' : 'Custo' ]}
                            />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#8884d8" activeDot={{ r: 6 }} name="Impressões"/>
                            <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#82ca9d" activeDot={{ r: 6 }} name="Cliques"/>
                            <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ffc658" activeDot={{ r: 6 }} name="Custo (R$)"/>
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Gráficos de Pizza e Barras */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Distribuição de Custos por Campanha</CardTitle>
                        <CardDescription>Visualização dos custos por campanha em gráfico de pizza.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] w-full flex items-center justify-center">
                         {metricsByCampaign.filter(c => c.cost > 0).length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metricsByCampaign.filter(c => c.cost > 0)}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={renderCustomizedLabel}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="cost"
                                        nameKey="name"
                                    >
                                        {metricsByCampaign.filter(c => c.cost > 0).map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [`R$ ${Number(value).toFixed(2)}`, name]}
                                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p className="text-center text-muted-foreground">Nenhum custo registrado para exibir no gráfico.</p>}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Receita por Campanha</CardTitle>
                        <CardDescription>Comparativo de receita entre campanhas.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] w-full flex items-center justify-center">
                        {metricsByCampaign.filter(c => c.revenue > 0).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metricsByCampaign.filter(c => c.revenue > 0)} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => `R$${value}`}/>
                                <YAxis dataKey="name" type="category" width={120} interval={0} />
                                <Tooltip
                                    formatter={(value, name) => [`R$ ${Number(value).toFixed(2)}`, name === 'revenue' ? 'Receita' : name]}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                />
                                <Legend />
                                <Bar dataKey="revenue" fill="#82ca9d" name="Receita"/>
                            </BarChart>
                        </ResponsiveContainer>
                        ) : <p className="text-center text-muted-foreground">Nenhuma receita registrada para exibir no gráfico.</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Tabela Detalhada de Métricas */}
            <Card>
                <CardHeader>
                    <CardTitle>Tabela Detalhada de Métricas</CardTitle>
                    <CardDescription>Visão tabular de todas as métricas registradas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Campanha</TableHead>
                                <TableHead className="text-right">Impressões</TableHead>
                                <TableHead className="text-right">Cliques</TableHead>
                                <TableHead className="text-right">Conversões</TableHead>
                                <TableHead className="text-right">Leads</TableHead>
                                <TableHead className="text-right">Custo (R$)</TableHead>
                                <TableHead className="text-right">Receita (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMetrics.length > 0 ? filteredMetrics.map((metric) => (
                                <TableRow key={metric.id}>
                                    <TableCell>{metric.date ? format(parseISO(metric.date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</TableCell>
                                    <TableCell>{metric.campaign?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{(metric.impressions || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(metric.clicks || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(metric.conversions || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{(metric.leads || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{parseFloat(metric.cost?.toString() || '0').toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{parseFloat(metric.revenue?.toString() || '0').toFixed(2)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center">
                                        Nenhuma métrica encontrada para os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            </> // Fim do fragmento
            )}
        </div>
    );
};

export default MetricsPage;
