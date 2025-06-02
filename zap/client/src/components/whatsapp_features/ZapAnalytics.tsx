// zap/client/src/components/whatsapp_features/ZapAnalytics.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@zap_client/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { BarChart2, MessageCircle, TrendingUp, Users, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
// Para gráficos, você pode usar Recharts, Chart.js (com react-chartjs-2), etc.
// Exemplo: import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ZapAnalyticsData {
  totalMessagesSent: number;
  totalMessagesReceived: number;
  activeConversations: number;
  avgFirstResponseTimeMinutes?: number | null; // em minutos
  flowPerformance: Array<{
    flowName: string;
    totalStarted: number;
    totalCompleted: number;
    completionRate: number; // 0-100
  }>;
  // Outras métricas...
}

const ZapAnalytics: React.FC = () => {
  const { data: analyticsData, isLoading, error } = useQuery<ZapAnalyticsData, ApiError>({
    queryKey: ['zapAnalytics'],
    queryFn: () => apiRequest({ url: '/whatsapp/analytics', method: 'GET' }),
    // Exemplo de mock data
    // queryFn: async () => {
    //   await new Promise(r => setTimeout(r, 1000));
    //   return {
    //     totalMessagesSent: 1250,
    //     totalMessagesReceived: 980,
    //     activeConversations: 45,
    //     avgFirstResponseTimeMinutes: 15,
    //     flowPerformance: [
    //       { flowName: "Boas-vindas", totalStarted: 200, totalCompleted: 180, completionRate: 90 },
    //       { flowName: "Suporte N1", totalStarted: 80, totalCompleted: 50, completionRate: 62.5 },
    //     ]
    //   };
    // }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /> Carregando dados analíticos...</div>;
  }

  if (error) {
    return (
      <Card className="neu-card">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center"><AlertTriangle className="w-5 h-5 mr-2"/> Erro ao Carregar Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive-foreground">{error.message}</p>
          <Button onClick={() => queryClientHook.invalidateQueries({queryKey: ['zapAnalytics']})} className="mt-4">Tentar Novamente</Button>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return <div className="text-center p-10 text-muted-foreground">Nenhum dado analítico disponível.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalMessagesSent}</div>
            {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Recebidas</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalMessagesReceived}</div>
            {/* <p className="text-xs text-muted-foreground">+180.1% from last month</p> */}
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeConversations}</div>
            {/* <p className="text-xs text-muted-foreground">+19% from last month</p> */}
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Méd. Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                {analyticsData.avgFirstResponseTimeMinutes !== null && analyticsData.avgFirstResponseTimeMinutes !== undefined 
                    ? `${analyticsData.avgFirstResponseTimeMinutes} min` 
                    : 'N/A'}
            </div>
            {/* <p className="text-xs text-muted-foreground">-5% from last month</p> */}
          </CardContent>
        </Card>
      </div>

      <Card className="neu-card">
        <CardHeader>
          <CardTitle>Performance dos Fluxos</CardTitle>
          <CardDescription>Acompanhe quantos usuários iniciam e completam seus fluxos automatizados.</CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsData.flowPerformance && analyticsData.flowPerformance.length > 0 ? (
            <div className="space-y-4">
              {analyticsData.flowPerformance.map(flow => (
                <div key={flow.flowName} className="p-3 border rounded-md bg-muted/30">
                  <h4 className="font-semibold text-sm">{flow.flowName}</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                    <span>Iniciados: <span className="font-bold">{flow.totalStarted}</span></span>
                    <span>Completos: <span className="font-bold">{flow.totalCompleted}</span></span>
                    <span>Taxa de Conclusão: <Badge variant={flow.completionRate > 70 ? "success" : flow.completionRate > 40 ? "warning" : "destructive"}>{flow.completionRate.toFixed(1)}%</Badge></span>
                  </div>
                  {/* Placeholder para um mini-gráfico de funil ou progresso */}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de performance de fluxos para exibir.</p>
          )}
          {/* <ResponsiveContainer width="100%" height={300}>
             <BarChart data={analyticsData.flowPerformance}> ... </BarChart>
          </ResponsiveContainer> */}
        </CardContent>
      </Card>
       {/* Adicionar mais cards e gráficos aqui */}
    </div>
  );
};

export default ZapAnalytics; 
