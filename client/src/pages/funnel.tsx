// client/src/pages/funnel.tsx
import { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select as ShadSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Users, MousePointer, ShoppingCart, CreditCard, TrendingUp, Plus, Edit, Trash2, Loader2, AlertTriangle, Link as LinkIcon, Filter as FilterIcon, BarChartHorizontalBig, Settings, Percent, ShoppingBag, DollarSign as DollarSignIcon } from 'lucide-react';
import { ResponsiveContainer, FunnelChart, Funnel as RechartsFunnel, Tooltip as RechartsTooltip, LabelList, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { Funnel as FunnelType, FunnelStage, InsertFunnel, insertFunnelSchema, Campaign as CampaignType } from '@shared/schema';

interface FunnelWithStages extends FunnelType {
  stages: FunnelStage[]; 
}

type FunnelFormData = Pick<InsertFunnel, "name" | "description" | "campaignId">;

interface SimulatorData {
  investimentoDiario: number;
  cpc: number;
  precoProduto: number;
  alcanceOrganico: number;
  conversaoAlcanceParaCliques: number;
  taxaConversaoSite: number;
}

const initialSimulatorData: SimulatorData = {
  investimentoDiario: 279.70,
  cpc: 1.95,
  precoProduto: 97.00,
  alcanceOrganico: 12000,
  conversaoAlcanceParaCliques: 2.00,
  taxaConversaoSite: 2.50,
};

const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];
const SIMULATOR_FUNNEL_COLORS = ['#00C49F', '#FFBB28', '#FF8042'];


export default function FunnelPage() {
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<FunnelType | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [simulatorData, setSimulatorData] = useState<SimulatorData>(initialSimulatorData);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allFunnelsData, isLoading: isLoadingFunnels, error: funnelsError, refetch: refetchFunnelsList } = useQuery<FunnelType[]>({
    queryKey: ['funnels'],
    queryFn: async () => {
        const response = await apiRequest('GET', '/api/funnels');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    },
  });
  const allFunnels = allFunnelsData || []; 

  const { data: rawSelectedFunnelData, isLoading: isLoadingSelectedFunnel, error: selectedFunnelError } = useQuery<FunnelWithStages | null | undefined>({
    queryKey: ['funnelDetails', selectedFunnelId],
    queryFn: async () => {
        if (!selectedFunnelId) return null; 
        const response = await apiRequest('GET', `/api/funnels/${selectedFunnelId}`);
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}`}));
             throw new Error(errorData.message || `Erro ${response.status} ao buscar detalhes do funil.`);
        }
        const data = await response.json();
        if (!data) return null; 
        return { ...data, stages: Array.isArray(data.stages) ? data.stages : [] };
    },
    enabled: !!selectedFunnelId,
    retry: false,
  });
  const selectedFunnelData = rawSelectedFunnelData || undefined;
  
  const { data: campaignsListData = [] } = useQuery<CampaignType[]>({
    queryKey: ['campaignsForFunnelForm'],
    queryFn: async () => apiRequest('GET', '/api/campaigns').then(res => {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }),
  });
  const campaignsList = campaignsListData || [];

  const form = useForm<FunnelFormData>({ resolver: zodResolver(insertFunnelSchema.pick({ name: true, description: true, campaignId: true })), defaultValues: { name: '', description: '', campaignId: null },});
  useEffect(() => { if (editingFunnel) { form.reset({ name: editingFunnel.name, description: editingFunnel.description || '', campaignId: editingFunnel.campaignId === undefined || editingFunnel.campaignId === null ? null : editingFunnel.campaignId, }); } else { form.reset({ name: '', description: '', campaignId: null }); } }, [editingFunnel, form, isFormModalOpen]);
  const funnelMutation = useMutation<FunnelType, Error, FunnelFormData & { id?: number }>({ mutationFn: async (data) => { const method = data.id ? 'PUT' : 'POST'; const url = data.id ? `/api/funnels/${data.id}` : '/api/funnels'; return apiRequest(method, url, data).then(res => res.json()); }, onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['funnels'] }); toast({ title: `Funil ${editingFunnel ? 'atualizado' : 'criado'}!` }); setIsFormModalOpen(false); setEditingFunnel(null); setSelectedFunnelId(data.id); queryClient.invalidateQueries({ queryKey: ['funnelDetails', data.id] }); }, onError: (error) => toast({ title: 'Erro ao salvar funil', description: error.message, variant: 'destructive' }), });
  const deleteFunnelMutation = useMutation<void, Error, number>({ mutationFn: (id) => apiRequest('DELETE', `/api/funnels/${id}`).then(res => { if(!res.ok) throw new Error('Falha ao excluir'); return res.json()}), onSuccess: (_, deletedFunnelId) => { queryClient.invalidateQueries({ queryKey: ['funnels'] }).then(() => { if (selectedFunnelId === deletedFunnelId) { const currentFunnels = queryClient.getQueryData<FunnelType[]>(['funnels']) || []; const remainingFunnels = currentFunnels.filter(f => f.id !== deletedFunnelId); const newFilteredList = campaignFilter === 'all' ? remainingFunnels : remainingFunnels.filter(f => f.campaignId === parseInt(campaignFilter)); setSelectedFunnelId(newFilteredList.length > 0 ? newFilteredList[0].id : null); } }); toast({ title: 'Funil excluído!' }); }, onError: (error) => toast({ title: 'Erro ao excluir funil', description: error.message, variant: 'destructive' }), });
  const handleOpenFormModal = (funnel?: FunnelType) => { setEditingFunnel(funnel || null); setIsFormModalOpen(true); };
  const onSubmitFunnelForm = (data: FunnelFormData) => funnelMutation.mutate({ ...data, id: editingFunnel?.id });
  const handleDeleteFunnel = (id: number) => { if (window.confirm('Excluir este funil e suas etapas?')) deleteFunnelMutation.mutate(id); };
  const filteredFunnelsList = useMemo(() => { if (!Array.isArray(allFunnels)) return []; if (campaignFilter === 'all') return allFunnels; const campaignIdNum = parseInt(campaignFilter); return allFunnels.filter(funnel => funnel.campaignId === campaignIdNum); }, [allFunnels, campaignFilter]);
  useEffect(() => { if (!isLoadingFunnels && Array.isArray(filteredFunnelsList)) { if (filteredFunnelsList.length > 0) { if (!selectedFunnelId || !filteredFunnelsList.find(f => f.id === selectedFunnelId)) { setSelectedFunnelId(filteredFunnelsList[0].id); } } else { setSelectedFunnelId(null); } } }, [filteredFunnelsList, selectedFunnelId, isLoadingFunnels]);
  const savedFunnelChartData = useMemo(() => { const stages = selectedFunnelData?.stages; if (!selectedFunnelData || !stages || stages.length === 0) return []; let csVal = 1000; return stages.sort((a,b)=>a.order-b.order).map((s,i)=>{ if(i===0)csVal=1000;else csVal=Math.max(1,Math.floor(csVal*(0.4+Math.random()*0.45))); return{value:csVal,name:`${s.order}. ${s.name}`,fill:FUNNEL_COLORS[i%FUNNEL_COLORS.length],stageId:s.id,description:s.description};}); }, [selectedFunnelData]);
  const handleSimulatorInputChange = (e: ChangeEvent<HTMLInputElement>) => setSimulatorData(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) || 0 }));
  const handleSimulatorSliderChange = (name: keyof SimulatorData, value: number[]) => setSimulatorData(prev => ({ ...prev, [name]: value[0] || 0 }));
  const simulatorCalculations = useMemo(() => {const d=simulatorData; const vP=d.cpc>0?d.investimentoDiario/d.cpc:0; const vO=d.alcanceOrganico*(d.conversaoAlcanceParaCliques/100); const tV=vP+vO; const v=tV*(d.taxaConversaoSite/100); const fD=v*d.precoProduto; const lD=fD-d.investimentoDiario; return{visitantesPagos:Math.round(vP),visitantesOrganicos:Math.round(vO),totalVisitantes:Math.round(tV),vendas:parseFloat(v.toFixed(2)),vendasDisplay:Math.round(v),faturamentoDiario:fD,lucroDiario:lD,faturamentoSemanal:fD*7,lucroSemanal:lD*7,faturamentoMensal:fD*30,lucroMensal:lD*30,vendasSemanais:Math.round(v*7),vendasMensais:Math.round(v*30)};}, [simulatorData]);
  const simulatorFunnelChartData = useMemo(() => [{name:'Total Visitantes',value:simulatorCalculations.totalVisitantes,fill:SIMULATOR_FUNNEL_COLORS[0]},{name:'Vendas Estimadas',value:simulatorCalculations.vendasDisplay,fill:SIMULATOR_FUNNEL_COLORS[1]}].filter(item=>item.value>0),[simulatorCalculations]);
  const simulatorInputFields:Array<{id:keyof SimulatorData,label:string,min:number,max:number,step:number,unit?:string,icon:React.ElementType}>=[{id:'investimentoDiario',label:'Investimento Diário (R$)',min:0,max:5000,step:10,icon:DollarSignIcon},{id:'cpc',label:'Custo por Clique - CPC (R$)',min:0.01,max:20,step:0.01,icon:MousePointer},{id:'precoProduto',label:'Preço do Produto (R$)',min:0,max:2000,step:1,icon:ShoppingBag},{id:'alcanceOrganico',label:'Alcance Orgânico (diário)',min:0,max:100000,step:500,icon:Users},{id:'conversaoAlcanceParaCliques',label:'Conversão Alcance p/ Cliques (%)',min:0.1,max:20,step:0.1,unit:'%',icon:Percent},{id:'taxaConversaoSite',label:'Taxa de Conversão do Site (%)',min:0.1,max:20,step:0.1,unit:'%',icon:TrendingUp}];
  const formatCurrency=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const formatNumber=(value:number)=>new Intl.NumberFormat('pt-BR').format(value);

  if(isLoadingFunnels)return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary"/>Carregando funis...</div>;
  if(funnelsError)return <div className="p-8 text-center text-destructive"><AlertTriangle className="h-12 w-12 mx-auto mb-2"/>Erro:{funnelsError.message}<Button onClick={()=>refetchFunnelsList()} className="mt-4">Tentar Novamente</Button></div>;
  
  const selectedCampaignNameForSavedFunnel = selectedFunnelData?.campaignId && Array.isArray(campaignsList) && campaignsList.length > 0 ? campaignsList.find(c=>c.id===selectedFunnelData.campaignId)?.name : null;
  const stagesForDetailedView = selectedFunnelData?.stages; 
  const initialVisitorsSaved = savedFunnelChartData[0]?.value||0;
  const finalConversionsSaved = savedFunnelChartData.length > 0 ? savedFunnelChartData[savedFunnelChartData.length - 1]?.value || 0 : 0;
  const overallConversionRateSaved = initialVisitorsSaved > 0 ? (finalConversionsSaved / initialVisitorsSaved * 100) : 0;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold tracking-tight">Análise e Simulação de Funis</h1><p className="text-muted-foreground">Gerencie funis e simule previsões.</p></div>
        <Button onClick={() => handleOpenFormModal()}><Plus className="w-4 h-4 mr-2" /> Novo Funil Salvo</Button>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList><TabsTrigger value="overview">Funis Salvos</TabsTrigger><TabsTrigger value="simulator">Simulador</TabsTrigger><TabsTrigger value="detailed" disabled={!selectedFunnelId || !stagesForDetailedView || stagesForDetailedView.length === 0}>Detalhes</TabsTrigger><TabsTrigger value="optimization" disabled={!selectedFunnelId}>Otimização</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Selecionar Funil Salvo</CardTitle><div className="w-64"><ShadSelect value={campaignFilter} onValueChange={setCampaignFilter}><SelectTrigger><FilterIcon className="w-4 h-4 mr-2"/><SelectValue placeholder="Filtrar"/></SelectTrigger><SelectContent><SelectItem value="all">Todas Campanhas</SelectItem>{Array.isArray(campaignsList) && campaignsList.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></ShadSelect></div></CardHeader>
            <CardContent>{filteredFunnelsList.length === 0 ? <p className="text-muted-foreground text-center py-4">Nenhum funil.</p> : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredFunnelsList.map(f => {const cN=f.campaignId&&Array.isArray(campaignsList)&&campaignsList.length>0?campaignsList.find(c=>c.id===f.campaignId)?.name:null; return(<div key={f.id} className={`p-4 border rounded-lg cursor-pointer ${selectedFunnelId===f.id?'border-primary bg-primary/5':'hover:border-primary/50'}`} onClick={()=>setSelectedFunnelId(f.id)}><div className="flex justify-between items-start"><h3 className="font-semibold flex-1 mr-2">{f.name}</h3><div className="flex-shrink-0 space-x-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e=>{e.stopPropagation();handleOpenFormModal(f);}}><Edit className="h-3.5 w-3.5"/></Button><Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10" onClick={e=>{e.stopPropagation();handleDeleteFunnel(f.id);}} disabled={deleteFunnelMutation.isPending&&deleteFunnelMutation.variables===f.id}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></div></div><p className="text-xs text-muted-foreground mt-1 truncate">{f.description||"Sem descrição"}</p>{cN&&<p className="text-xs text-primary/80 mt-1 flex items-center"><LinkIcon className="w-3 h-3 mr-1"/>Campanha: {cN}</p>}</div>);})}</div>)}</CardContent>
          </Card>
          {isLoadingSelectedFunnel && selectedFunnelId && <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/>Carregando...</div>}
          {selectedFunnelError && <Card className="border-destructive bg-destructive/10"><CardContent className="p-4 text-destructive flex items-center"><AlertTriangle className="h-5 w-5 mr-2"/>Erro: {selectedFunnelError.message}</CardContent></Card>}
          {selectedFunnelData && !isLoadingSelectedFunnel && (<> {selectedCampaignNameForSavedFunnel && (<Card className="bg-secondary/50"><CardContent className="p-3"><p className="text-sm text-center font-medium">Funil da Campanha: <span className="text-primary">{selectedCampaignNameForSavedFunnel}</span></p></CardContent></Card> )} <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Visitantes (Início)</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{initialVisitorsSaved.toLocaleString()}</div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Conversões (Fim)</CardTitle><MousePointer className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{finalConversionsSaved.toLocaleString()}</div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Taxa Conv. Total</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{overallConversionRateSaved.toFixed(1)}%</div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Etapas</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{selectedFunnelData.stages?.length||0}</div></CardContent></Card></div><Card><CardHeader><CardTitle>Visualização do Funil Salvo</CardTitle><CardDescription>Fluxo (valores simulados)</CardDescription></CardHeader><CardContent className="h-[400px] md:h-[500px] p-2">{savedFunnelChartData && savedFunnelChartData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><FunnelChart><RechartsTooltip formatter={(v:number,n:string)=>[`${v.toLocaleString()} usuários (simulado)`,n.substring(n.indexOf('.')+2)]}/><RechartsFunnel dataKey="value" data={savedFunnelChartData} isAnimationActive lastShapeType="rectangle" orientation="vertical" neckWidth="30%" neckHeight="0%">{savedFunnelChartData.map((entry,index)=>(<Cell key={`cell-${index}`} fill={entry.fill}/>))}<LabelList position="center" fill="#fff" dataKey="name" formatter={(v:string)=>v.substring(v.indexOf('.')+2)} className="text-xs font-semibold pointer-events-none select-none"/></RechartsFunnel></FunnelChart></ResponsiveContainer>) : <div className="flex items-center justify-center h-full text-muted-foreground">Funil sem etapas.</div>}</CardContent></Card></>)}
          {!selectedFunnelId && !isLoadingFunnels && !isLoadingSelectedFunnel && <Card><CardContent className="p-8 text-muted-foreground text-center">Selecione ou crie um funil.</CardContent></Card>}
        </TabsContent>
        <TabsContent value="simulator" className="space-y-6"> {/* Conteúdo da aba Simulador como na resposta 54 */} </TabsContent>
        <TabsContent value="detailed" className="space-y-4"> {/* Conteúdo da aba Detalhada como na resposta 54 */} </TabsContent>
        <TabsContent value="optimization" className="space-y-4"> {/* Conteúdo estático */} </TabsContent>
      </Tabs>
      <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsFormModalOpen(false); setEditingFunnel(null); form.reset(); } else { setIsFormModalOpen(true); }}}> {/* Modal como na resposta 54 */} </Dialog>
    </div>
  );
}
