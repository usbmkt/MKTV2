import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
// CORRIGIDO: Path Aliases para @zap_client
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@zap_client/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { DateRangePicker } from '@zap_client/components/ui/date-range-picker'; // Supondo que este componente exista e seja importado corretamente
import { ApiError, FlowPerformanceData } from '@zap_client/features/types/whatsapp_flow_types'; // Corrigido para o local correto
import { apiRequest } from '@zap_client/lib/api'; // Assumindo que apiRequest está em lib do zap
import { Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { subDays, format } from 'date-fns';

// Mock data (substituir com chamadas de API reais para o backend do ZAP)
const mockPerformanceData: FlowPerformanceData[] = [
  { flowId: 'flow1', flowName: 'Boas Vindas Cliente Novo', totalStarted: 1520, totalCompleted: 1292, completionRate: 85, averageDurationSeconds: 120 },
  { flowId: 'flow2', flowName: 'Recuperação de Carrinho', totalStarted: 340, totalCompleted: 204, completionRate: 60, averageDurationSeconds: 90 },
  { flowId: 'flow3', flowName: 'Suporte Nível 1', totalStarted: 875, totalCompleted: 700, completionRate: 80, averageDurationSeconds: 180 },
];

const mockTimeSeriesData = [
    { date: '2023-05-01', started: 100, completed: 80 },
    { date: '2023-05-02', started: 120, completed: 90 },
    { date: '2023-05-03', started: 90, completed: 70 },
    { date: '2023-05-04', started: 150, completed: 120 },
    { date: '2023-05-05', started: 130, completed: 110 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const ZapAnalytics: React.FC = () => {
  const [flowPerformance, setFlowPerformance] = useState<FlowPerformanceData[]>(mockPerformanceData);
  const [timeSeries, setTimeSeries] = useState(mockTimeSeriesData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;
      setIsLoading(true);
      setError(null);
      try {
        // const params = { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') };
        // const perfPromise = apiRequest('GET', '/zap-api/analytics/flow-performance', { params });
        // const seriesPromise = apiRequest('GET', '/zap-api/analytics/time-series', { params });
        // const [perfResponse, seriesResponse] = await Promise.all([perfPromise, seriesPromise]);
        // setFlowPerformance(perfResponse.data);
        // setTimeSeries(seriesResponse.data);
        setFlowPerformance(mockPerformanceData); // Usando mock
        setTimeSeries(mockTimeSeriesData); // Usando mock

      } catch (err) {
        const apiErr = err as ApiError; // Cast para o tipo ApiError
        setError(apiErr.message || 'Falha ao carregar dados de analytics.');
        console.error("Erro ao carregar analytics:", apiErr);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const topPerformingFlows = useMemo(() => {
    return [...flowPerformance].sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);
  }, [flowPerformance]);

  const overallStats = useMemo(() => {
    const totalStarted = flowPerformance.reduce((sum, flow) => sum + flow.totalStarted, 0);
    const totalCompleted = flowPerformance.reduce((sum, flow) => sum + flow.totalCompleted, 0);
    const avgCompletionRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;
    const avgDuration = flowPerformance.length > 0 ? flowPerformance.reduce((sum, flow) => sum + flow.averageDurationSeconds, 0) / flowPerformance.length : 0;
    return { totalStarted, totalCompleted, avgCompletionRate: parseFloat(avgCompletionRate.toFixed(1)), avgDurationSeconds: parseFloat(avgDuration.toFixed(0)) };
  }, [flowPerformance]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Analytics do WhatsApp</h2>
        {/* DateRangePicker é um componente customizado que não foi fornecido. 
          Se você tiver este componente em `@zap_client/components/ui/date-range-picker`, 
          o import deve ser `@zap_client/components/ui/date-range-picker`.
          Caso contrário, substitua por um seletor de data mais simples ou remova.
        */}
        {/* <DateRangePicker date={dateRange} onDateChange={setDateRange} /> */}
         <div className="text-sm text-muted-foreground">
            Período: {dateRange?.from ? format(dateRange.from, "dd/MM/yy") : ""} - {dateRange?.to ? format(dateRange.to, "dd/MM/yy") : ""}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fluxos Iniciados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalStarted}</div>
            {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fluxos Completos</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalCompleted}</div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média de Conclusão</CardTitle>
            <BarChart2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgCompletionRate}%</div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duração Média do Fluxo</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(overallStats.avgDurationSeconds / 60).toFixed(1)} min</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="neu-card">
          <CardHeader>
            <CardTitle>Fluxos Iniciados vs. Completos (Série Temporal)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), "dd/MM")} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="started" name="Iniciados" stroke="#8884d8" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="completed" name="Completos" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardHeader>
            <CardTitle>Top 5 Fluxos por Taxa de Conclusão</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPerformingFlows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis dataKey="flowName" type="category" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="completionRate" name="Taxa de Conclusão" fill="#00C49F" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ZapAnalytics;
