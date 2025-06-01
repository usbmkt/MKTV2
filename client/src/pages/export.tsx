// client/src/pages/export.tsx
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  Calendar as CalendarIcon,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Campaign as CampaignType } from '@shared/schema';

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'pdf' | 'excel' | 'csv' | 'image';
  icon: React.ElementType;
  fields: string[]; // IDs dos campos
  popular: boolean;
}

interface AvailableField {
  id: string;
  label: string;
  category: string;
}

// Esta lista define as OPÇÕES de templates, não são dados mockados do banco.
const exportTemplates: ExportTemplate[] = [
  {
    id: 'campaign-performance',
    name: 'Relatório de Performance de Campanhas',
    description: 'Métricas completas de performance por campanha',
    type: 'excel',
    icon: FileSpreadsheet,
    fields: ['impressions', 'clicks', 'ctr', 'conversions', 'cost', 'roi', 'cpa'],
    popular: true
  },
  {
    id: 'budget-analysis',
    name: 'Análise de Orçamento',
    description: 'Relatório detalhado de gastos e ROI',
    type: 'pdf',
    icon: FileText,
    fields: ['budget', 'spentAmount', 'remainingBudget', 'roi', 'cpa'],
    popular: true
  },
  {
    id: 'audience-insights',
    name: 'Insights de Audiência',
    description: 'Demografia e comportamento da audiência (exemplo)',
    type: 'excel',
    icon: FileSpreadsheet,
    fields: ['ageRange', 'gender', 'location', 'interests', 'device'],
    popular: false
  },
];

// Esta lista define as OPÇÕES de campos selecionáveis, não são dados mockados do banco.
const availableFields: AvailableField[] = [
  { id: 'campaignName', label: 'Nome da Campanha', category: 'Informações da Campanha' },
  { id: 'status', label: 'Status', category: 'Informações da Campanha' },
  { id: 'startDate', label: 'Data de Início', category: 'Informações da Campanha' },
  { id: 'endDate', label: 'Data de Fim', category: 'Informações da Campanha' },
  { id: 'budget', label: 'Orçamento Total', category: 'Financeiro' },
  { id: 'spentAmount', label: 'Valor Gasto', category: 'Financeiro' },
  { id: 'remainingBudget', label: 'Orçamento Restante', category: 'Financeiro' },
  { id: 'impressions', label: 'Impressões', category: 'Métricas de Performance' },
  { id: 'clicks', label: 'Cliques', category: 'Métricas de Performance' },
  { id: 'ctr', label: 'CTR', category: 'Métricas de Performance' },
  { id: 'conversions', label: 'Conversões', category: 'Métricas de Performance' },
  { id: 'cost', label: 'Custo Total (Ads)', category: 'Métricas de Performance' },
  { id: 'revenue', label: 'Receita (Ads)', category: 'Métricas de Performance' },
  { id: 'roi', label: 'ROI (Ads)', category: 'Métricas de Performance' },
  { id: 'cpa', label: 'CPA (Ads)', category: 'Métricas de Performance' },
  { id: 'leads', label: 'Leads Gerados', category: 'Métricas de Performance' },
  { id: 'ageRange', label: 'Faixa Etária', category: 'Audiência' },
  { id: 'gender', label: 'Gênero', category: 'Audiência' },
  { id: 'location', label: 'Localização', category: 'Audiência' },
  { id: 'interests', label: 'Interesses', category: 'Audiência' },
  { id: 'device', label: 'Dispositivo', category: 'Audiência' },
];


export default function ExportPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: subDays(new Date(), 30), to: new Date()});
  const [exportFormat, setExportFormat] = useState<string>('excel');
  const { toast } = useToast();

  const { data: campaigns = [], isLoading: isLoadingCampaigns, error: campaignsError } = useQuery<CampaignType[]>({
    queryKey: ['campaignsForExport'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) throw new Error('Falha ao carregar campanhas.');
      return response.json();
    },
  });
  
  const exportMutation = useMutation({
    mutationFn: async (exportParams: any) => {
      // Este endpoint é hipotético e precisaria ser implementado no backend.
      const response = await apiRequest('POST', '/api/export/generate', exportParams);
      if (!response.ok) {
        // Se o backend retornar um erro específico, usá-lo.
        const errorData = await response.json().catch(() => ({ message: 'Falha ao iniciar a exportação no servidor.' }));
        throw new Error(errorData.message || 'Endpoint de exportação não implementado ou erro no servidor.');
      }
      // Em um cenário real, o backend responderia com o arquivo ou um link para download.
      // Aqui, apenas simulamos o sucesso se o endpoint existisse e respondesse OK.
      return response.blob(); // ou response.json() dependendo do que o backend retornaria
    },
    onSuccess: (data) => { // data seria o blob do arquivo
      // Lógica para simular download do blob (se o backend retornasse o arquivo)
      // const url = window.URL.createObjectURL(data);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = `relatorio_${selectedTemplateId || 'personalizado'}.${exportFormat}`;
      // document.body.appendChild(a);
      // a.click();
      // window.URL.revokeObjectURL(url);
      // a.remove();
      
      toast({
        title: "Exportação Iniciada (Simulado)",
        description: "Seu relatório foi requisitado. O backend precisa implementar a geração.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na Exportação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = exportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSelectedFields(template.fields);
      setExportFormat(template.type);
    } else {
      setSelectedTemplateId('');
      setSelectedFields([]); // Limpar campos se nenhum template for selecionado ou inválido
    }
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaignIds(prev => 
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
    setSelectedTemplateId(''); // Desmarcar template se os campos forem personalizados
  };

  const handleExport = () => {
    if (selectedCampaignIds.length === 0) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione ao menos uma campanha.", variant: "destructive" });
      return;
    }
    if (selectedFields.length === 0) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione ao menos um campo para exportar.", variant: "destructive" });
      return;
    }
    if (!dateRange.from || !dateRange.to) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione um período de datas.", variant: "destructive" });
      return;
    }

    const exportParams = {
      templateId: selectedTemplateId,
      campaignIds: selectedCampaignIds,
      fields: selectedFields,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      format: exportFormat,
    };
    
    console.log('Parâmetros da Exportação:', exportParams);
    exportMutation.mutate(exportParams);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'csv': return <FileText className="w-4 h-4 text-blue-500" />; // CSV pode usar FileText ou um ícone específico se tiver
      case 'image': return <FileImage className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const groupedFields = availableFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof availableFields>);

  if (isLoadingCampaigns) {
    return <div className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" /> Carregando dados para exportação...</div>;
  }

  if (campaignsError) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
        Erro ao carregar campanhas: {(campaignsError as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exportar Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios personalizados das suas campanhas
          </p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={selectedCampaignIds.length === 0 || selectedFields.length === 0 || !dateRange.from || !dateRange.to || exportMutation.isPending}
          className="neu-button"
        >
          {exportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle>1. Escolher Template (Opcional)</CardTitle>
              <CardDescription>
                Selecione um template ou personalize os campos abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplateId === template.id
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold">{template.name}</h3>
                        </div>
                        {template.popular && <Badge variant="secondary">Popular</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        {getFileIcon(template.type)}
                        <span className="text-xs text-muted-foreground uppercase">
                          {template.type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="neu-card">
            <CardHeader>
              <CardTitle>2. Selecionar Campanhas *</CardTitle>
              <CardDescription>
                Escolha as campanhas para incluir no relatório.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-60 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {campaigns.length > 0 ? campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`campaign-${campaign.id}`}
                      checked={selectedCampaignIds.includes(String(campaign.id))}
                      onCheckedChange={() => handleCampaignToggle(String(campaign.id))}
                    />
                    <label
                      htmlFor={`campaign-${campaign.id}`}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {campaign.name}
                    </label>
                    <Badge 
                      variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="neu-card">
            <CardHeader>
              <CardTitle>3. Definir Período *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal neu-button">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.from ? format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inicial'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 neu-card" align="start">
                    <Calendar mode="single" selected={dateRange.from} onSelect={(d) => setDateRange(prev => ({ ...prev, from: d }))} initialFocus />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground hidden sm:inline">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal neu-button">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.to ? format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR }) : 'Data final'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 neu-card" align="start">
                    <Calendar mode="single" selected={dateRange.to} onSelect={(d) => setDateRange(prev => ({ ...prev, to: d }))} initialFocus disabled={(date) => dateRange.from ? date < dateRange.from : false }/>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle>4. Selecionar Campos *</CardTitle>
              <CardDescription>Personalize as métricas do relatório.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
              {Object.entries(groupedFields).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2 text-primary">{category}</h4>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${field.id}`}
                          checked={selectedFields.includes(field.id)}
                          onCheckedChange={() => handleFieldToggle(field.id)}
                        />
                        <label htmlFor={`field-${field.id}`} className="text-xs cursor-pointer">
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="neu-card">
            <CardHeader>
              <CardTitle>5. Formato de Exportação</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="neu-input">
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent className="neu-card">
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção de Histórico Removida - Requer Backend para ser funcional */}
      {/* <Card className="neu-card">
        <CardHeader>
          <CardTitle>Histórico de Exportações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Funcionalidade de histórico de exportações será implementada com o backend.
          </p>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
