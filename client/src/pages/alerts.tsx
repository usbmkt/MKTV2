import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Bell, CheckCircle, Clock, TrendingDown, DollarSign, Users, Settings } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Alert {
  id: number;
  type: 'budget' | 'performance' | 'audience' | 'system';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  campaignId?: number;
  campaignName?: string;
  createdAt: string;
  data?: any;
}

export default function AlertsPage() {
  const [selectedTab, setSelectedTab] = useState('active');
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['/api/alerts'],
    queryFn: async () => {
      // Mock data - em produção real seria da API
      const mockAlerts: Alert[] = [
        {
          id: 1,
          type: 'budget',
          title: 'Orçamento quase esgotado',
          message: 'A campanha "E-commerce Q1" atingiu 85% do orçamento mensal',
          severity: 'high',
          isRead: false,
          campaignId: 1,
          campaignName: 'E-commerce Q1',
          createdAt: new Date().toISOString(),
          data: { budgetUsed: 85, totalBudget: 5000, remaining: 750 }
        },
        {
          id: 2,
          type: 'performance',
          title: 'Queda no CTR',
          message: 'CTR da campanha "Google Ads" caiu 15% nas últimas 24h',
          severity: 'medium',
          isRead: false,
          campaignId: 2,
          campaignName: 'Google Ads - Produtos',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          data: { previousCTR: 3.2, currentCTR: 2.7, change: -15 }
        },
        {
          id: 3,
          type: 'audience',
          title: 'Novo segmento em alta',
          message: 'Audiência 25-34 anos apresentou crescimento de 25% em conversões',
          severity: 'low',
          isRead: true,
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          data: { segment: '25-34', growth: 25 }
        },
        {
          id: 4,
          type: 'system',
          title: 'Integração atualizada',
          message: 'Nova versão da API do Facebook disponível com melhorias de performance',
          severity: 'low',
          isRead: true,
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 5,
          type: 'budget',
          title: 'Limite diário atingido',
          message: 'Campanha "Instagram Stories" atingiu o limite diário de gastos',
          severity: 'critical',
          isRead: false,
          campaignId: 3,
          campaignName: 'Instagram Stories',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          data: { dailyBudget: 200, spent: 200 }
        }
      ];
      return mockAlerts;
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest('PATCH', `/api/alerts/${alertId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', '/api/alerts/read-all', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    }
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'budget': return <DollarSign className="w-5 h-5" />;
      case 'performance': return <TrendingDown className="w-5 h-5" />;
      case 'audience': return <Users className="w-5 h-5" />;
      case 'system': return <Settings className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Crítico</Badge>;
      case 'high': return <Badge variant="destructive">Alto</Badge>;
      case 'medium': return <Badge variant="secondary">Médio</Badge>;
      case 'low': return <Badge variant="outline">Baixo</Badge>;
      default: return <Badge variant="outline">Baixo</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h atrás`;
    } else {
      return `${minutes}m atrás`;
    }
  };

  const activeAlerts = alerts.filter(alert => !alert.isRead);
  const readAlerts = alerts.filter(alert => alert.isRead);
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Alertas</h1>
          <p className="text-muted-foreground">
            Monitore eventos importantes das suas campanhas
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => markAllAsReadMutation.mutate()}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Marcar Tudo Lido
          </Button>
          <Button>
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Resumo de Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Precisam de atenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Ação imediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamento</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.type === 'budget' && !a.isRead).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Alertas de gastos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.type === 'performance' && !a.isRead).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Quedas detectadas
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Ativos ({activeAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="all">Todos ({alerts.length})</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Tudo sob controle!</h3>
                <p className="text-muted-foreground text-center">
                  Não há alertas ativos no momento. Suas campanhas estão funcionando bem.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeAlerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${alert.severity === 'critical' ? 'border-l-red-500' : alert.severity === 'high' ? 'border-l-orange-500' : 'border-l-yellow-500'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {getAlertIcon(alert.type)}
                            <h3 className="font-semibold">{alert.title}</h3>
                            {getSeverityBadge(alert.severity)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {alert.message}
                          </p>
                          {alert.campaignName && (
                            <p className="text-xs text-blue-600 mb-2">
                              Campanha: {alert.campaignName}
                            </p>
                          )}
                          {alert.data && (
                            <div className="bg-muted/50 rounded-lg p-3 mb-3">
                              {alert.type === 'budget' && alert.data && (
                                <div className="text-sm">
                                  <p>Orçamento usado: {alert.data.budgetUsed}%</p>
                                  <p>Restante: R$ {alert.data.remaining}</p>
                                </div>
                              )}
                              {alert.type === 'performance' && alert.data && (
                                <div className="text-sm">
                                  <p>CTR anterior: {alert.data.previousCTR}%</p>
                                  <p>CTR atual: {alert.data.currentCTR}%</p>
                                  <p className="text-red-600">Variação: {alert.data.change}%</p>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTime(alert.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => markAsReadMutation.mutate(alert.id)}
                        >
                          Marcar como Lido
                        </Button>
                        {alert.campaignId && (
                          <Button size="sm">
                            Ver Campanha
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`${alert.isRead ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`}></div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getAlertIcon(alert.type)}
                          <h3 className="font-semibold">{alert.title}</h3>
                          {getSeverityBadge(alert.severity)}
                          {alert.isRead && <Badge variant="outline">Lido</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.message}
                        </p>
                        {alert.campaignName && (
                          <p className="text-xs text-blue-600 mb-2">
                            Campanha: {alert.campaignName}
                          </p>
                        )}
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(alert.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Personalize quando e como receber alertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Alertas de Orçamento</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Orçamento 80% esgotado</p>
                      <p className="text-xs text-muted-foreground">Alerta quando campanha atingir 80% do orçamento</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Orçamento diário esgotado</p>
                      <p className="text-xs text-muted-foreground">Notificação quando limite diário for atingido</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Alertas de Performance</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Queda no CTR superior a 15%</p>
                      <p className="text-xs text-muted-foreground">Alerta quando CTR cair significativamente</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Taxa de conversão baixa</p>
                      <p className="text-xs text-muted-foreground">Notificação quando conversões caírem abaixo da média</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Notificações</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Notificações por email</p>
                      <p className="text-xs text-muted-foreground">Receber alertas críticos por email</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Notificações push</p>
                      <p className="text-xs text-muted-foreground">Notificações em tempo real no navegador</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}