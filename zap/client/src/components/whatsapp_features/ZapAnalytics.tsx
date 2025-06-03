// zap/client/src/components/whatsapp_features/ZapAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@zap_client/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Loader2, AlertTriangle, Users, CheckCircle, Clock, MessageSquare, Send, TrendingUp, Filter } from 'lucide-react';
import { ApiError, FlowPerformanceData } from '@zap_client/features/types/whatsapp_flow_types'; // Importado

// Simulação de API
const fetchAnalyticsData = async (flowId: string = 'all', period: string = 'last_30_days'): Promise<any> => { // Alterado para any para mock
  console.log(`Fetching analytics for flow: ${flowId}, period: ${period} (mocked)`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock data
  const flowsPerformance: FlowPerformanceData[] = [
    { flowId: 'flow_1', flowName: 'Boas Vindas', totalStarted: 150, totalCompleted: 120, completionRate: 80, avgTimeToComplete: 180 },
    { flowId: 'flow_2', flowName: 'Recuperação Carrinho', totalStarted: 80, totalCompleted: 40, completionRate: 50, avgTimeToComplete: 300 },
    { flowId: 'flow_3', flowName: 'Suporte FAQ', totalStarted: 200, totalCompleted: 180, completionRate: 90, avgTimeToComplete: 120 },
  ];

  const selectedFlowData = flowId === 'all' ? 
    flowsPerformance.reduce((acc, curr) => ({
        flowId: 'all',
        flowName: 'Todos os Fluxos',
        totalStarted: acc.totalStarted + curr.totalStarted,
        totalCompleted: acc.totalCompleted + curr.totalCompleted,
        completionRate: 0, // Será recalculado
        avgTimeToComplete: (acc.avgTimeToComplete || 0) + (curr.avgTimeToComplete || 0)
    }), {flowId: 'all', flowName: 'Todos', totalStarted: 0, totalCompleted: 0, completionRate: 0, avgTimeToComplete: 0 })
    : flowsPerformance.find(f => f.flowId === flowId);
  
  if (selectedFlowData && selectedFlowData.flowId === 'all') {
    selectedFlowData.completionRate = selectedFlowData.totalStarted > 0 ? Math.round((selectedFlowData.totalCompleted / selectedFlowData.totalStarted) * 100) : 0;
    selectedFlowData.avgTimeToComplete = selectedFlowData.totalStarted > 0 ? Math.round((selectedFlowData.avgTimeToComplete || 0) / flowsPerformance.length) : 0;
  }


  return {
    summary: {
      totalMessagesSent: Math.floor(Math.random() * 5000) + 1000,
      totalMessagesReceived: Math.floor(Math.random() * 3000) + 500,
      activeConversations: Math.floor(Math.random() * 100) + 20,
      avgResponseTime: Math.floor(Math.random() * 120) + 30, // seconds
    },
    flowPerformance: selectedFlowData || flowsPerformance[0], // Fallback
    allFlowsPerformance: flowsPerformance, // Para o select
    messagesOverTime: Array.from({ length: 30 }, (_, i) => ({
      date: `Dia ${i + 1}`,
      sent: Math.floor(Math.random() * 100) + 20,
      received: Math.floor(Math.random() * 80) + 10,
    })),
    responseTimesDistribution: [
      { name: '< 1 min', value: Math.floor(Math.random() * 100) },
      { name: '1-5 min', value: Math.floor(Math.random() * 80) },
      { name: '5-15 min', value: Math.floor(Math.random() * 50) },
      { name: '> 15 min', value: Math.floor(Math.random() * 30) },
    ],
  };
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function ZapAnalytics() {
  const [selectedFlow, setSelectedFlow] = useState('all');
  const [timePeriod, setTimePeriod] = useState('last_30_days');

  const { data: analyticsData, isLoading, error, refetch } = useQuery<any, ApiError>({ // Usando any para mock, idealmente um tipo específico
    queryKey: ['zapAnalytics', selectedFlow, timePeriod],
    queryFn: () => fetchAnalyticsData(selectedFlow, timePeriod),
  });

  useEffect(() => {
    refetch();
  }, [selectedFlow, timePeriod, refetch]);

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> Carregando analytics...</div>;
  if (error) return <div className="p-4 text-center text-destructive"><AlertTriangle className="w-8 h-8 mx-auto mb-2"/>Erro ao carregar analytics: {error.message}</div>;
  if (!analyticsData) return <div className="p-4 text-center text-muted-foreground">Nenhum dado de analytics disponível.</div>;

  const flowPerformance = analyticsData.flowPerformance as FlowPerformanceData | undefined; // Cast
  const allFlowsForSelect = analyticsData.allFlowsPerformance as FlowPerformanceData[] | undefined;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Análise de Performance do WhatsApp</h1>
          <p className="text-muted-foreground">Insights sobre suas interações e fluxos.</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFlow} onValueChange={setSelectedFlow}>
            <SelectTrigger className="w-full sm:w-[200px] neu-input">
              <SelectValue placeholder="Selecionar Fluxo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Fluxos</SelectItem>
              {(allFlowsForSelect || []).map(flow => (
                <SelectItem key={flow.flowId} value={flow.flowId}>{flow.flowName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-full sm:w-[180px] neu-input">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
              <SelectItem value="last_90_days">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary?.totalMessagesSent?.toLocaleString() || 0}</div>
            {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
          </CardContent>
        </Card>
         {/* Adicione mais cards de resumo aqui */}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Performance do Fluxo Selecionado */}
        {flowPerformance && (
            <Card className="neu-card">
                <CardHeader>
                    <CardTitle>{flowPerformance.flowName || 'Performance do Fluxo'}</CardTitle>
                    <CardDescription>Métricas para o fluxo selecionado no período.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div><Users className="inline mr-1 h-4 w-4"/>Iniciados: <span className="font-bold">{flowPerformance.totalStarted?.toLocaleString() || 0}</span></div>
                    <div><CheckCircle className="inline mr-1 h-4 w-4 text-green-500"/>Completos: <span className="font-bold">{flowPerformance.totalCompleted?.toLocaleString() || 0}</span></div>
                    <div><TrendingUp className="inline mr-1 h-4 w-4 text-blue-500"/>Taxa de Conclusão: <span className="font-bold">{flowPerformance.completionRate || 0}%</span></div>
                    <div><Clock className="inline mr-1 h-4 w-4"/>Tempo Médio: <span className="font-bold">{flowPerformance.avgTimeToComplete ? `${Math.round(flowPerformance.avgTimeToComplete / 60)} min` : 'N/A'}</span></div>
                </CardContent>
            </Card>
        )}

        {/* Distribuição de Tempos de Resposta */}
        <Card className="neu-card">
          <CardHeader>
            <CardTitle>Distribuição de Tempos de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analyticsData.responseTimesDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {(analyticsData.responseTimesDistribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Mensagens ao Longo do Tempo */}
      <Card className="neu-card">
        <CardHeader>
          <CardTitle>Volume de Mensagens ao Longo do Tempo</CardTitle>
          <CardDescription>Mensagens enviadas e recebidas no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.messagesOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" name="Enviadas" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="received" name="Recebidas" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
