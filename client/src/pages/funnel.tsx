// client/src/pages/FunnelSimulatorPage.tsx
import { useState, useMemo, ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList, Cell } from 'recharts';
import { DollarSign, Users, Percent, TrendingUp, BarChartHorizontalBig, Settings, ShoppingBag, MousePointer } from 'lucide-react'; // MousePointer ADICIONADO AQUI

const FUNNEL_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F'];

interface SimulatorData {
  investimentoDiario: number;
  cpc: number;
  precoProduto: number;
  alcanceOrganico: number;
  conversaoAlcanceParaCliques: number; // Em %
  taxaConversaoSite: number; // Em %
}

const initialSimulatorData: SimulatorData = {
  investimentoDiario: 279.70,
  cpc: 1.95,
  precoProduto: 97.00,
  alcanceOrganico: 12000,
  conversaoAlcanceParaCliques: 2.00,
  taxaConversaoSite: 2.50,
};

export default function FunnelSimulatorPage() {
  const [data, setData] = useState<SimulatorData>(initialSimulatorData);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };
  
  const handleSliderChange = (name: keyof SimulatorData, value: number[]) => {
    setData(prev => ({ ...prev, [name]: value[0] || 0 }));
  };

  const calculations = useMemo(() => {
    const visitantesPagos = data.cpc > 0 ? data.investimentoDiario / data.cpc : 0;
    const visitantesOrganicos = data.alcanceOrganico * (data.conversaoAlcanceParaCliques / 100);
    const totalVisitantes = visitantesPagos + visitantesOrganicos;
    const vendas = totalVisitantes * (data.taxaConversaoSite / 100);
    
    const faturamentoDiario = vendas * data.precoProduto;
    const lucroDiario = faturamentoDiario - data.investimentoDiario;

    return {
      visitantesPagos: Math.round(visitantesPagos),
      visitantesOrganicos: Math.round(visitantesOrganicos),
      totalVisitantes: Math.round(totalVisitantes),
      vendas: parseFloat(vendas.toFixed(2)), 
      vendasDisplay: Math.round(vendas), 
      faturamentoDiario,
      lucroDiario,
      faturamentoSemanal: faturamentoDiario * 7,
      lucroSemanal: lucroDiario * 7,
      faturamentoMensal: faturamentoDiario * 30,
      lucroMensal: lucroDiario * 30,
      vendasSemanais: Math.round(vendas * 7),
      vendasMensais: Math.round(vendas * 30),
    };
  }, [data]);

  const funnelChartData = [
    { name: 'Total Visitantes', value: calculations.totalVisitantes, fill: FUNNEL_CHART_COLORS[0] },
    { name: 'Vendas Estimadas', value: calculations.vendasDisplay, fill: FUNNEL_CHART_COLORS[1] },
  ].filter(item => item.value > 0); 

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  const inputFields: Array<{ id: keyof SimulatorData, label: string, min: number, max: number, step: number, unit?: string, icon: React.ElementType }> = [
    { id: 'investimentoDiario', label: 'Investimento Diário (R$)', min: 0, max: 5000, step: 10, icon: DollarSign },
    { id: 'cpc', label: 'Custo por Clique - CPC (R$)', min: 0.01, max: 20, step: 0.01, icon: MousePointer }, // Usa MousePointer
    { id: 'precoProduto', label: 'Preço do Produto (R$)', min: 0, max: 2000, step: 1, icon: ShoppingBag },
    { id: 'alcanceOrganico', label: 'Alcance Orgânico (diário)', min: 0, max: 100000, step: 500, icon: Users },
    { id: 'conversaoAlcanceParaCliques', label: 'Conversão Alcance p/ Cliques (%)', min: 0.1, max: 20, step: 0.1, unit: '%', icon: Percent },
    { id: 'taxaConversaoSite', label: 'Taxa de Conversão do Site (%)', min: 0.1, max: 20, step: 0.1, unit: '%', icon: TrendingUp },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Simulador de Funil de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            Faça previsões e ajuste suas métricas para otimizar resultados.
          </p>
        </div>
        <Button variant="outline" className="mt-4 md:mt-0 neu-button">
          <Settings className="w-4 h-4 mr-2" /> Opções Avançadas
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 neu-card">
          <CardHeader>
            <CardTitle>Configurar Métricas</CardTitle>
            <CardDescription>Ajuste os valores para simular seu funil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {inputFields.map(field => {
              const Icon = field.icon;
              return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="flex items-center text-sm font-medium">
                  <Icon className="w-4 h-4 mr-2 text-primary" />
                  {field.label}
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    id={field.id}
                    name={field.id}
                    value={data[field.id]}
                    onChange={handleInputChange}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className="neu-input w-28 text-sm"
                  />
                  <Slider
                    name={field.id}
                    value={[data[field.id]]}
                    onValueChange={(value) => handleSliderChange(field.id, value)}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className="flex-1"
                  />
                </div>
                 <p className="text-xs text-muted-foreground text-right">
                    Min: {field.unit === '%' ? field.min.toFixed(1) : field.min}{field.unit || ''} / 
                    Max: {field.unit === '%' ? field.max.toFixed(1) : field.max}{field.unit || ''}
                </p>
              </div>
            )})}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChartHorizontalBig className="w-5 h-5 mr-2 text-primary"/>
                Previsão do Funil
              </CardTitle>
              <CardDescription>Resultados calculados com base nas suas métricas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-xs text-muted-foreground">Visitantes Pagos</p><p className="font-bold text-lg">{formatNumber(calculations.visitantesPagos)}</p></div>
                <div><p className="text-xs text-muted-foreground">Visitantes Orgânicos</p><p className="font-bold text-lg">{formatNumber(calculations.visitantesOrganicos)}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Visitantes</p><p className="font-bold text-lg text-primary">{formatNumber(calculations.totalVisitantes)}</p></div>
                <div><p className="text-xs text-muted-foreground">Vendas Estimadas</p><p className="font-bold text-lg text-green-500">{formatNumber(calculations.vendasDisplay)}</p></div>
              </div>
              
              <div className="h-[300px] md:h-[350px] mt-4">
                {funnelChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [`${formatNumber(value)} ${name.includes('Visitantes') ? 'visitantes' : 'vendas'}`, name]}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--background)/0.8)', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                      />
                      <RechartsFunnel
                        dataKey="value"
                        data={funnelChartData}
                        isAnimationActive
                        labelLine={false}
                        orientation="horizontal" 
                        neckWidth="20%"
                        neckHeight="0%"
                        trapezoid={false}
                      >
                        <LabelList 
                          position="center" 
                          dataKey="name" 
                          formatter={(value: string) => value}
                          className="text-xs md:text-sm font-semibold pointer-events-none select-none" 
                          fill="#fff"
                        />
                      </RechartsFunnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Ajuste as métricas para gerar o funil.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="neu-card">
              <CardHeader><CardTitle className="text-base">Volume de Vendas</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Diário: <span className="font-semibold">{formatNumber(calculations.vendasDisplay)}</span></p>
                <p>Semanal: <span className="font-semibold">{formatNumber(calculations.vendasSemanais)}</span></p>
                <p>Mensal: <span className="font-semibold">{formatNumber(calculations.vendasMensais)}</span></p>
              </CardContent>
            </Card>
            <Card className="neu-card">
              <CardHeader><CardTitle className="text-base">Faturamento (R$)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Diário: <span className="font-semibold">{formatCurrency(calculations.faturamentoDiario)}</span></p>
                <p>Semanal: <span className="font-semibold">{formatCurrency(calculations.faturamentoSemanal)}</span></p>
                <p>Mensal: <span className="font-semibold">{formatCurrency(calculations.faturamentoMensal)}</span></p>
              </CardContent>
            </Card>
            <Card className="neu-card">
              <CardHeader><CardTitle className="text-base">Lucro Estimado (R$)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Diário: <span className="font-semibold">{formatCurrency(calculations.lucroDiario)}</span></p>
                <p>Semanal: <span className="font-semibold">{formatCurrency(calculations.lucroSemanal)}</span></p>
                <p>Mensal: <span className="font-semibold">{formatCurrency(calculations.lucroMensal)}</span></p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
