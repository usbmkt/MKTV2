// zap/client/src/components/whatsapp_features/ZapAnalytics.tsx
import React, { useState } from 'react'; // Adicionado useState
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@zap_client/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { BarChart2, MessageCircle, TrendingUp, Users, AlertTriangle, Loader2, Clock, CalendarDays } from 'lucide-react'; // Adicionado CalendarDays
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select'; // Select local do Zap


interface FlowPerformanceData { /* ... como antes ... */ }
interface MessagesByDayData { date: string; sent: number; received: number; }
interface ZapAnalyticsData {
  totalMessagesSent: number;
  totalMessagesReceived: number;
  activeConversations: number;
  avgFirstResponseTimeMinutes?: number | null;
  flowPerformance: Array<FlowPerformanceData>;
  messagesByDay?: Array<MessagesByDayData>;
}

const COLORS_PIE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']; // Cores Tailwind-like

const ZapAnalytics: React.FC = () => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('7'); // '7', '30', '90' dias

  const { data: analyticsData, isLoading, error, refetch } = useQuery<ZapAnalyticsData, ApiError>({
    queryKey: ['zapAnalytics', period], // Adicionar período à chave da query
    queryFn: () => apiRequest({ url: `/whatsapp/analytics?period=${period}`, method: 'GET' }),
  });

  if (isLoading) { /* ... como antes ... */ }
  if (error) { /* ... como antes, usando refetch() ... */ }
  if (!analyticsData) { /* ... como antes ... */ }

  const kpiCardClass = "neu-card shadow-sm hover:shadow-md transition-shadow bg-card text-card-foreground";
  const chartCardClass = "neu-card shadow-sm bg-card text-card-foreground";

  const flowCompletionDataForPie = analyticsData.flowPerformance.map((flow, index) => ({
      name: flow.flowName,
      value: flow.completionRate,
      fill: COLORS_PIE[index % COLORS_PIE.length]
  }));


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-semibold text-foreground">Visão Geral - Analytics</h2>
        <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[120px] h-9 neu-input text-xs">
                    <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="neu-button h-9">
            <TrendingUp className="w-4 h-4 mr-2" /> Atualizar
            </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* ... (KPI Cards como antes, usando analyticsData) ... */}
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className={chartCardClass}>
          <CardHeader><CardTitle className="text-lg">Performance dos Fluxos</CardTitle><CardDescription className="text-xs">Taxa de conclusão (%) e total de execuções.</CardDescription></CardHeader>
          <CardContent>
            {analyticsData.flowPerformance && analyticsData.flowPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.flowPerformance} margin={{ top: 5, right: 5, left: -25, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                  <XAxis dataKey="flowName" angle={-20} textAnchor="end" height={50} fontSize={10} interval={0} tickFormatter={(value) => value.substring(0,12) + (value.length > 12 ? '...' : '')} />
                  <YAxis yAxisId="left" unit="%" fontSize={10} domain={[0,100]} />
                  <YAxis yAxisId="right" orientation="right" unit="" fontSize={10} />
                  <Tooltip contentStyle={{backgroundColor: 'hsl(var(--popover))', border:'1px solid hsl(var(--border))', borderRadius:'0.5rem'}} labelStyle={{color: 'hsl(var(--popover-foreground))', fontWeight: 'bold'}} itemStyle={{fontSize: '12px'}}/>
                  <Legend wrapperStyle={{fontSize: "12px", paddingTop: '10px'}}/>
                  <Bar yAxisId="left" dataKey="completionRate" name="Conclusão" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20}/>
                  <Bar yAxisId="right" dataKey="totalStarted" name="Iniciados" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} barSize={20} opacity={0.7}/>
                </BarChart>
              </ResponsiveContainer>
            ) : ( <p className="text-sm text-muted-foreground text-center py-10">Sem dados de performance de fluxos.</p> )}
          </CardContent>
        </Card>

        <Card className={chartCardClass}>
          <CardHeader><CardTitle className="text-lg">Volume de Mensagens ({period} dias)</CardTitle><CardDescription className="text-xs">Mensagens enviadas vs. recebidas por dia.</CardDescription></CardHeader>
          <CardContent>
            {analyticsData.messagesByDay && analyticsData.messagesByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.messagesByDay} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10}/>
                        <Tooltip contentStyle={{backgroundColor: 'hsl(var(--popover))', border:'1px solid hsl(var(--border))', borderRadius:'0.5rem'}}/>
                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                        <Line type="monotone" dataKey="sent" name="Enviadas" stroke="#8884d8" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                        <Line type="monotone" dataKey="received" name="Recebidas" stroke="#82ca9d" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                    </LineChart>
                </ResponsiveContainer>
            ) : ( <p className="text-sm text-muted-foreground text-center py-10">Sem dados de volume de mensagens para o período.</p> )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ZapAnalytics;