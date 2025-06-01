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
  id: keyof FormattedCampaignDataRow;
  label: string;
  category: string;
}

interface FormattedCampaignDataRow {
  campaignId?: number;
  campaignName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budget?: string; 
  spentAmount?: string; 
  impressions?: number | string;
  clicks?: number | string;
  ctr?: string; 
  conversions?: number | string;
  cost?: string; 
  revenue?: string; 
  roi?: string; 
  cpa?: string; 
  leads?: number | string;
  ageRange?: string;
  gender?: string;
  location?: string;
  interests?: string;
  device?: string;
  platforms?: string;
}

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

function convertToCSV(data: FormattedCampaignDataRow[], fieldObjects: AvailableField[]): string {
  if (!data || data.length === 0 || !fieldObjects || fieldObjects.length === 0) {
    return "";
  }
  
  const header = fieldObjects.map(f => f.label).join(';');
  const rows = data.map(row => {
    return fieldObjects.map(fieldObj => {
      let value = row[fieldObj.id];
      if (value === null || value === undefined) {
        value = '';
      }
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
  const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
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
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: subDays(new Date(), 30), to: new Date()});
  const [exportFormat, setExportFormat] = useState<string>('csv');
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

  const { data: dashboardApiData, isLoading: isLoadingDashboardData } = useQuery<any>({
    queryKey: ['dashboardDataForExport', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return null;
      const daysDiff = Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 3600 * 24)));
      const rangeParam = `${daysDiff}d`;
      const response = await apiRequest('GET', `/api/dashboard?timeRange=${rangeParam}`);
      if (!response.ok) {
        console.warn("Não foi possível carregar dados agregados do dashboard para exportação.");
        return null;
      }
      return response.json();
    },
    enabled: !!dateRange.from && !!dateRange.to,
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = exportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSelectedFieldIds(template.fields as (keyof FormattedCampaignDataRow)[]);
      setExportFormat(template.type === 'csv' || template.type === 'excel' ? template.type : 'csv');
    } else {
      setSelectedTemplateId('');
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
  
  const formatCurrency = (value?: string | number | null) => {
    if (value === null || value === undefined || String(value).trim() === "") return "N/A";
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) return "N/A";
    return `R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value?: number | string | null) => {
    if (value === null || value === undefined) return "N/A";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "0";
    return numValue.toLocaleString('pt-BR');
  };
  
  const handleExport = async () => {
    if (selectedCampaignIds.length === 0) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione ao menos uma campanha.", variant: "destructive" });
      return;
    }
    if (selectedFieldIds.length === 0) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione ao menos um campo para exportar.", variant: "destructive" });
      return;
    }
    if (!dateRange.from || !dateRange.to) {
      toast({ title: "Seleção Necessária", description: "Por favor, selecione um período de datas.", variant: "destructive" });
      return;
    }
    setIsExporting(true);

    const selectedCampaignObjects = campaigns.filter(c => selectedCampaignIds.includes(String(c.id)));
    const dataToExport: FormattedCampaignDataRow[] = [];
    const dashboardMetrics = dashboardApiData?.metrics;
    const recentCampaignsFromDashboard = dashboardApiData?.recentCampaigns || [];

    for (const campaign of selectedCampaignObjects) {
      const row: FormattedCampaignDataRow = {};
      const recentCampaignData = recentCampaignsFromDashboard.find((rc: any) => rc.id === campaign.id);

      for (const fieldId of selectedFieldIds as (keyof FormattedCampaignDataRow)[]) {
        switch (fieldId) {
          case 'campaignId': row[fieldId] = campaign.id; break;
          case 'campaignName': row[fieldId] = campaign.name; break;
          case 'status': row[fieldId] = campaign.status; break;
          case 'startDate': row[fieldId] = campaign.startDate && isValid(parseISO(String(campaign.startDate))) ? format(parseISO(String(campaign.startDate)), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'; break;
          case 'endDate': row[fieldId] = campaign.endDate && isValid(parseISO(String(campaign.endDate))) ? format(parseISO(String(campaign.endDate)), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'; break;
          case 'platforms': row[fieldId] = campaign.platforms?.join(', '); break;
          case 'targetAudience': row[fieldId] = campaign.targetAudience; break;
          case 'industry': row[fieldId] = campaign.industry; break;
          case 'budget': row[fieldId] = formatCurrency(campaign.budget); break;
          case 'spentAmount': row[fieldId] = formatCurrency(recentCampaignData?.spent ?? (selectedCampaignObjects.length === 1 ? dashboardMetrics?.totalCostPeriod : 'N/A (Agregado)')); break;
          
          case 'impressions': row[fieldId] = formatNumber(dashboardMetrics?.impressions); break;
          case 'clicks': row[fieldId] = formatNumber(dashboardMetrics?.clicks); break;
          case 'ctr': row[fieldId] = `${dashboardMetrics?.ctr?.toFixed(2) ?? '0.00'}%`; break;
          case 'conversions': row[fieldId] = formatNumber(dashboardMetrics?.conversions); break;
          case 'cost': row[fieldId] = formatCurrency(dashboardMetrics?.totalCostPeriod); break;
          case 'revenue': row[fieldId] = 'N/A'; break; 
          case 'roi': row[fieldId] = `${dashboardMetrics?.avgROI?.toFixed(1) ?? '0.0'}x`; break;
          case 'cpa': row[fieldId] = 'N/A'; break;
          case 'leads': row[fieldId] = 'N/A'; break;
          default: row[fieldId] = campaign[fieldId as keyof CampaignType] !== undefined && campaign[fieldId as keyof CampaignType] !== null ? String(campaign[fieldId as keyof CampaignType]) : 'N/A';
        }
      }
      dataToExport.push(row);
    }
    
    if (selectedCampaignObjects.length > 1 && selectedFieldIds.some(sf => ['impressions', 'clicks', 'conversions', 'cost', 'spentAmount'].includes(sf))) {
        const totalsRow: FormattedCampaignDataRow = { campaignName: "TOTAIS (Agregado do Período Selecionado)" };
        if (selectedFieldIds.includes('impressions')) totalsRow.impressions = formatNumber(dashboardMetrics?.impressions);
        if (selectedFieldIds.includes('clicks')) totalsRow.clicks = formatNumber(dashboardMetrics?.clicks);
        if (selectedFieldIds.includes('conversions')) totalsRow.conversions = formatNumber(dashboardMetrics?.conversions);
        if (selectedFieldIds.includes('cost')) totalsRow.cost = formatCurrency(dashboardMetrics?.totalCostPeriod); // Custo total do período para ads
        if (selectedFieldIds.includes('spentAmount')) totalsRow.spentAmount = formatCurrency(dashboardMetrics?.totalSpent); // Gasto total geral das campanhas
        dataToExport.push(totalsRow);
    }

    const finalSelectedFieldObjects = availableFields.filter(f => selectedFieldIds.includes(f.id));

    if (exportFormat === 'csv') {
      const csvData = convertToCSV(dataToExport, finalSelectedFieldObjects);
      if(csvData) {
        downloadCSV(csvData, `relatorio_mktv2_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        toast({ title: "Exportação CSV Concluída", description: "Seu relatório foi gerado e baixado." });
      } else {
        toast({ title: "Exportação Falhou", description: "Não foi possível gerar os dados para o CSV.", variant: "destructive" });
      }
    } else {
      toast({ title: "Formato Indisponível", description: `A exportação para ${exportFormat.toUpperCase()} ainda não está implementada. Gerando CSV.`, variant: "default" });
      const csvData = convertToCSV(dataToExport, finalSelectedFieldObjects);
      if(csvData) {
        downloadCSV(csvData, `relatorio_mktv2_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      } else {
        toast({ title: "Exportação Falhou", description: "Não foi possível gerar os dados para o CSV.", variant: "destructive" });
      }
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

  if (isLoadingCampaigns || isLoadingDashboardData && !dashboardApiData) { // Mostrar loading se ambos ou o principal estiver carregando
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
            Gere relatórios CSV personalizados das suas campanhas.
          </p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={selectedCampaignIds.length === 0 || selectedFieldIds.length === 0 || !dateRange.from || !dateRange.to || isExporting}
          className="neu-button"
        >
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? "Exportando..." : "Gerar CSV"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle>1. Escolher Template (Opcional)</CardTitle>
              <CardDescription>
                Templates pré-definem os campos. A exportação será em CSV.
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
                )) : <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>}
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
              {Object.entries(groupedFields).map(([category, fieldsInCategory]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2 text-primary">{category}</h4>
                  <div className="space-y-2">
                    {fieldsInCategory.map((field) => (
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
