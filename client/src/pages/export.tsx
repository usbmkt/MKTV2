// client/src/pages/export.tsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { format, subDays, isValid, parseISO } from 'date-fns';
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
  id: keyof FormattedCampaignDataRow; // Chaves do objeto de dados que será exportado
  label: string;
  category: string;
}

// Define a estrutura da linha de dados para exportação
interface FormattedCampaignDataRow {
  campaignId?: number;
  campaignName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budget?: string; // Formatado como string
  spentAmount?: string; // Formatado como string, pode vir do dashboard.recentCampaigns.spent
  // Campos de métricas (alguns podem ser agregados ou de recentCampaigns)
  impressions?: number | string;
  clicks?: number | string;
  ctr?: string; // ex: "2.5%"
  conversions?: number | string;
  cost?: string; // Custo de ads, formatado
  revenue?: string; // Receita de ads, formatado
  roi?: string; // ex: "3.2x" ou "320%"
  cpa?: string; // Custo por aquisição, formatado
  leads?: number | string;
  // Campos de audiência (exemplos, não temos dados reais para eles)
  ageRange?: string;
  gender?: string;
  location?: string;
  interests?: string;
  device?: string;
  // Adicionar mais campos conforme necessário
  platforms?: string; // Formatado como string
}


// Esta lista define as OPÇÕES de templates.
const exportTemplates: ExportTemplate[] = [
  {
    id: 'campaign-performance-summary',
    name: 'Resumo de Performance de Campanhas',
    description: 'Principais métricas de performance por campanha selecionada.',
    type: 'csv',
    icon: FileSpreadsheet,
    fields: ['campaignName', 'status', 'budget', 'spentAmount', 'impressions', 'clicks', 'conversions', 'cost', 'roi'],
    popular: true
  },
  {
    id: 'campaign-details-list',
    name: 'Lista Detalhada de Campanhas',
    description: 'Informações cadastrais e de configuração das campanhas.',
    type: 'csv',
    icon: FileText,
    fields: ['campaignName', 'status', 'startDate', 'endDate', 'budget', 'platforms', 'targetAudience', 'industry'],
    popular: true
  },
];

// Esta lista define as OPÇÕES de campos selecionáveis.
const availableFields: AvailableField[] = [
  { id: 'campaignName', label: 'Nome da Campanha', category: 'Informações da Campanha' },
  { id: 'status', label: 'Status', category: 'Informações da Campanha' },
  { id: 'startDate', label: 'Data de Início', category: 'Informações da Campanha' },
  { id: 'endDate', label: 'Data de Fim', category: 'Informações da Campanha' },
  { id: 'platforms', label: 'Plataformas', category: 'Informações da Campanha'},
  { id: 'targetAudience', label: 'Público-Alvo', category: 'Informações da Campanha'},
  { id: 'industry', label: 'Indústria/Setor', category: 'Informações da Campanha'},
  { id: 'budget', label: 'Orçamento Total', category: 'Financeiro' },
  { id: 'spentAmount', label: 'Valor Gasto (Recente/Agregado)', category: 'Financeiro' },
  { id: 'cost', label: 'Custo de Ads (Agregado)', category: 'Métricas de Performance' },
  { id: 'impressions', label: 'Impressões (Agregado)', category: 'Métricas de Performance' },
  { id: 'clicks', label: 'Cliques (Agregado)', category: 'Métricas de Performance' },
  { id: 'ctr', label: 'CTR (Agregado)', category: 'Métricas de Performance' },
  { id: 'conversions', label: 'Conversões (Agregado)', category: 'Métricas de Performance' },
  { id: 'revenue', label: 'Receita (Agregado)', category: 'Métricas de Performance' },
  { id: 'roi', label: 'ROI (Agregado)', category: 'Métricas de Performance' },
  { id: 'cpa', label: 'CPA (Agregado)', category: 'Métricas de Performance' },
  { id: 'leads', label: 'Leads (Agregado)', category: 'Métricas de Performance' },
];

// Função para converter dados para CSV
function convertToCSV(data: FormattedCampaignDataRow[], fields: AvailableField[]): string {
  if (!data || data.length === 0 || !fields || fields.length === 0) {
    return "";
  }

  const selectedFieldIds = fields.map(f => f.id);
  const selectedFieldLabels = fields.map(f => f.label);
  
  const header = selectedFieldLabels.join(';');
  const rows = data.map(row => {
    return selectedFieldIds.map(fieldId => {
      let value = row[fieldId];
      if (value === null || value === undefined) {
        value = '';
      }
      // Escapar aspas e tratar quebras de linha para CSV
      const stringValue = String(value).replace(/"/g, '""');
      if (stringValue.includes(';') || stringValue.includes('\n') || stringValue.includes(',')) {
        return `"${stringValue}"`;
      }
      return stringValue;
    }).join(';');
  });

  return [header, ...rows].join('\n');
}

function downloadCSV(csvData: string, filename: string) {
  const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}


export default function ExportPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]); // Agora armazena IDs
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: subDays(new Date(), 30), to: new Date()});
  const [exportFormat, setExportFormat] = useState<string>('csv'); // Foco no CSV
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: campaigns = [], isLoading: isLoadingCampaigns, error: campaignsError } = useQuery<CampaignType[]>({
    queryKey: ['campaignsForExport'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) throw new Error('Falha ao carregar campanhas.');
      return response.json();
    },
  });

  // Query para dados agregados do dashboard que podem ser usados no relatório
  const { data: dashboardApiData, isLoading: isLoadingDashboardData } = useQuery({
    queryKey: ['dashboardDataForExport', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return null;
      const range = `${Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 3600 * 24))}d`;
      const response = await apiRequest('GET', `/api/dashboard?timeRange=${range}`); // O backend pode não usar esse range exato.
      if (!response.ok) return null; // Não tratar como erro fatal aqui, exportação pode prosseguir com menos dados.
      return response.json();
    },
    enabled: !!dateRange.from && !!dateRange.to,
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = exportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSelectedFieldIds(template.fields as (keyof FormattedCampaignDataRow)[]);
      setExportFormat(template.type === 'csv' || template.type === 'excel' ? template.type : 'csv'); // Prioriza CSV/Excel
    } else {
      setSelectedTemplateId('');
      // Não limpar selectedFieldIds aqui, para permitir personalização mesmo após desmarcar template
    }
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaignIds(prev => 
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleFieldToggle = (fieldId: keyof FormattedCampaignDataRow) => {
    setSelectedFieldIds(prev => 
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
    setSelectedTemplateId(''); 
  };

  const handleExport = async () => {
    if (selectedCampaignIds.length === 0 || selectedFields.length === 0 || !dateRange.from || !dateRange.to) {
      toast({ title: "Campos Obrigatórios", description: "Selecione campanhas, campos e período.", variant: "destructive" });
      return;
    }
    setIsExporting(true);

    const selectedCampaignObjects = campaigns.filter(c => selectedCampaignIds.includes(String(c.id)));
    const dataToExport: FormattedCampaignDataRow[] = [];
    const dashboardMetrics = dashboardApiData?.metrics;

    for (const campaign of selectedCampaignObjects) {
      const row: FormattedCampaignDataRow = {};
      const recentCampaignData = dashboardApiData?.recentCampaigns?.find((rc: any) => rc.id === campaign.id);

      for (const fieldId of selectedFieldIds as (keyof FormattedCampaignDataRow)[]) {
        switch (fieldId) {
          case 'campaignId': row[fieldId] = campaign.id; break;
          case 'campaignName': row[fieldId] = campaign.name; break;
          case 'status': row[fieldId] = campaign.status; break;
          case 'startDate': row[fieldId] = campaign.startDate ? format(parseISO(String(campaign.startDate)), 'dd/MM/yyyy') : 'N/A'; break;
          case 'endDate': row[fieldId] = campaign.endDate ? format(parseISO(String(campaign.endDate)), 'dd/MM/yyyy') : 'N/A'; break;
          case 'platforms': row[fieldId] = campaign.platforms?.join(', '); break;
          case 'targetAudience': row[fieldId] = campaign.targetAudience; break;
          case 'industry': row[fieldId] = campaign.industry; break;
          case 'budget': row[fieldId] = formatCurrency(campaign.budget); break;
          case 'spentAmount': row[fieldId] = formatCurrency(recentCampaignData?.spent ?? (selectedCampaignObjects.length === 1 ? dashboardMetrics?.totalCostPeriod : 'N/A')); break; // Usa spent de recentCampaigns se disponível
          
          // Métricas agregadas (usadas se for relatório geral ou se não houver dados por campanha)
          case 'impressions': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : formatNumber(dashboardMetrics?.impressions) ; break;
          case 'clicks': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : formatNumber(dashboardMetrics?.clicks); break;
          case 'ctr': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : `${dashboardMetrics?.ctr?.toFixed(2) || '0.00'}%`; break;
          case 'conversions': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : formatNumber(dashboardMetrics?.conversions); break;
          case 'cost': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : formatCurrency(dashboardMetrics?.totalCostPeriod); break; // Custo total do período
          case 'revenue': row[fieldId] = 'N/A (Dado Indisponível)'; break; // Não temos revenue granular
          case 'roi': row[fieldId] = selectedCampaignObjects.length === 1 && recentCampaignData ? 'N/A (Use Agregado)' : `${dashboardMetrics?.avgROI?.toFixed(1) || '0.0'}x`; break;
          case 'cpa': row[fieldId] = 'N/A (Dado Indisponível)'; break;
          case 'leads': row[fieldId] = 'N/A (Dado Indisponível)'; break;
          default: row[fieldId] = 'N/A';
        }
      }
      dataToExport.push(row);
    }
    
    // Adicionar linha de totais/agregados se múltiplos campos de métricas selecionados
    if (dataToExport.length > 1 && selectedFields.some(sf => ['impressions', 'clicks', 'conversions', 'cost', 'spentAmount'].includes(sf))) {
        const totalsRow: FormattedCampaignDataRow = { campaignName: "TOTAIS (Agregado do Período)" };
        if (selectedFields.includes('impressions')) totalsRow.impressions = formatNumber(dashboardMetrics?.impressions);
        if (selectedFields.includes('clicks')) totalsRow.clicks = formatNumber(dashboardMetrics?.clicks);
        if (selectedFields.includes('conversions')) totalsRow.conversions = formatNumber(dashboardMetrics?.conversions);
        if (selectedFields.includes('cost')) totalsRow.cost = formatCurrency(dashboardMetrics?.totalCostPeriod);
        if (selectedFields.includes('spentAmount')) totalsRow.spentAmount = formatCurrency(dashboardMetrics?.totalSpent); // Gasto total geral
        dataToExport.push(totalsRow);
    }


    if (exportFormat === 'csv') {
      const selectedFieldObjects = availableFields.filter(f => selectedFieldIds.includes(f.id));
      const csvData = convertToCSV(dataToExport, selectedFieldObjects);
      downloadCSV(csvData, `relatorio_mktv2_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      toast({ title: "Exportação CSV Concluída", description: "Seu relatório foi gerado e baixado." });
    } else {
      toast({ title: "Formato Indisponível", description: `A exportação para ${exportFormat.toUpperCase()} ainda não está implementada. Gerando CSV como alternativa.`, variant: "default" });
      // Fallback para CSV se outro formato for selecionado
      const selectedFieldObjects = availableFields.filter(f => selectedFieldIds.includes(f.id));
      const csvData = convertToCSV(dataToExport, selectedFieldObjects);
      downloadCSV(csvData, `relatorio_mktv2_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    }

    setIsExporting(false);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'csv': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'image': return <FileImage className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const groupedFields = availableFields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, AvailableField[]>);


  if (isLoadingCampaigns || isLoadingDashboardData) {
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
            Gere relatórios personalizados das suas campanhas (CSV)
          </p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={selectedCampaignIds.length === 0 || selectedFieldIds.length === 0 || !dateRange.from || !dateRange.to || isExporting}
          className="neu-button"
        >
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? "Exportando..." : "Exportar Relatório"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle>1. Escolher Template (Opcional)</CardTitle>
              <CardDescription>
                Selecione um template ou personalize os campos abaixo. Formato será CSV.
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
                        {template.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        {getFileIcon(template.type)}
                        <span className="text-xs text-muted-foreground uppercase">
                          {template.type.toUpperCase()}
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
            </CardHeader>
            <CardContent className="max-h-60 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {campaigns.length > 0 ? campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`campaign-export-${campaign.id}`}
                      checked={selectedCampaignIds.includes(String(campaign.id))}
                      onCheckedChange={() => handleCampaignToggle(String(campaign.id))}
                    />
                    <label
                      htmlFor={`campaign-export-${campaign.id}`}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {campaign.name}
                    </label>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma campanha disponível.</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="neu-card">
            <CardHeader><CardTitle>3. Definir Período *</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal neu-button">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.from && isValid(dateRange.from) ? format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inicial'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 neu-card" align="start">
                    <Calendar mode="single" selected={dateRange.from} onSelect={(d) => setDateRange(prev => ({ ...prev, from: d || undefined }))} initialFocus />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground hidden sm:inline">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal neu-button">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.to && isValid(dateRange.to) ? format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR }) : 'Data final'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 neu-card" align="start">
                    <Calendar mode="single" selected={dateRange.to} onSelect={(d) => setDateRange(prev => ({ ...prev, to: d || undefined }))} initialFocus disabled={(date) => dateRange.from ? date < dateRange.from : false }/>
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
              <CardDescription>Métricas para o relatório CSV.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[30rem] overflow-y-auto custom-scrollbar">
              {Object.entries(groupedFields).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2 text-primary">{category}</h4>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-export-${field.id}`}
                          checked={selectedFieldIds.includes(field.id)}
                          onCheckedChange={() => handleFieldToggle(field.id as keyof FormattedCampaignDataRow)}
                        />
                        <label htmlFor={`field-export-${field.id}`} className="text-xs cursor-pointer">
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                   {category !== Object.keys(groupedFields)[Object.keys(groupedFields).length -1] && <Separator className="my-3"/>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="neu-card">
            <CardHeader><CardTitle>5. Formato (CSV)</CardTitle></CardHeader>
            <CardContent>
              <Select value={exportFormat} onValueChange={(value) => {
                if (value !== 'csv') {
                    toast({ title: "Formato Indisponível", description: "Apenas CSV está implementado no momento.", variant: "default"});
                    setExportFormat('csv');
                } else {
                    setExportFormat(value);
                }
              }}>
                <SelectTrigger className="neu-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="neu-card">
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="excel" disabled>Excel (.xlsx) - Em breve</SelectItem>
                  <SelectItem value="pdf" disabled>PDF (.pdf) - Em breve</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
