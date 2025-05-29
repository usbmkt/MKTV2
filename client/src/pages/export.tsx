import { useState } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'pdf' | 'excel' | 'csv' | 'image';
  icon: any;
  fields: string[];
  popular: boolean;
}

export default function ExportPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [exportFormat, setExportFormat] = useState<string>('excel');

  const exportTemplates: ExportTemplate[] = [
    {
      id: 'campaign-performance',
      name: 'Relatório de Performance de Campanhas',
      description: 'Métricas completas de performance por campanha',
      type: 'excel',
      icon: FileSpreadsheet,
      fields: ['impressions', 'clicks', 'ctr', 'conversions', 'cost', 'roi'],
      popular: true
    },
    {
      id: 'budget-analysis',
      name: 'Análise de Orçamento',
      description: 'Relatório detalhado de gastos e ROI',
      type: 'pdf',
      icon: FileText,
      fields: ['budget', 'spent', 'remaining', 'roi', 'cpa'],
      popular: true
    },
    {
      id: 'audience-insights',
      name: 'Insights de Audiência',
      description: 'Demografia e comportamento da audiência',
      type: 'excel',
      icon: FileSpreadsheet,
      fields: ['demographics', 'interests', 'behavior', 'devices'],
      popular: false
    },
    {
      id: 'creative-performance',
      name: 'Performance de Criativos',
      description: 'Análise de performance por criativo',
      type: 'csv',
      icon: FileText,
      fields: ['creative_name', 'impressions', 'clicks', 'ctr', 'conversions'],
      popular: false
    },
    {
      id: 'executive-summary',
      name: 'Resumo Executivo',
      description: 'Relatório visual para apresentações',
      type: 'pdf',
      icon: FileImage,
      fields: ['summary_metrics', 'key_insights', 'recommendations'],
      popular: true
    }
  ];

  const campaigns = [
    { id: '1', name: 'Campanha E-commerce Q1', status: 'active' },
    { id: '2', name: 'Google Ads - Produtos', status: 'active' },
    { id: '3', name: 'Instagram Stories', status: 'paused' },
    { id: '4', name: 'LinkedIn B2B', status: 'active' },
    { id: '5', name: 'TikTok Awareness', status: 'completed' }
  ];

  const availableFields = [
    { id: 'impressions', label: 'Impressões', category: 'Métricas Básicas' },
    { id: 'clicks', label: 'Cliques', category: 'Métricas Básicas' },
    { id: 'ctr', label: 'CTR', category: 'Métricas Básicas' },
    { id: 'conversions', label: 'Conversões', category: 'Métricas Básicas' },
    { id: 'cost', label: 'Custo', category: 'Financeiro' },
    { id: 'revenue', label: 'Receita', category: 'Financeiro' },
    { id: 'roi', label: 'ROI', category: 'Financeiro' },
    { id: 'cpa', label: 'CPA', category: 'Financeiro' },
    { id: 'demographics', label: 'Demografia', category: 'Audiência' },
    { id: 'interests', label: 'Interesses', category: 'Audiência' },
    { id: 'devices', label: 'Dispositivos', category: 'Audiência' },
    { id: 'locations', label: 'Localização', category: 'Audiência' }
  ];

  const exportHistory = [
    {
      id: 1,
      name: 'Relatório Performance - Janeiro',
      type: 'excel',
      date: '2024-01-15T10:30:00Z',
      size: '2.4 MB',
      status: 'completed'
    },
    {
      id: 2,
      name: 'Análise de Orçamento Q4',
      type: 'pdf',
      date: '2024-01-10T14:22:00Z',
      size: '1.8 MB',
      status: 'completed'
    },
    {
      id: 3,
      name: 'Resumo Executivo',
      type: 'pdf',
      date: '2024-01-08T09:15:00Z',
      size: '3.2 MB',
      status: 'completed'
    }
  ];

  const handleTemplateSelect = (templateId: string) => {
    const template = exportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSelectedFields(template.fields);
      setExportFormat(template.type);
    }
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev => 
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
  };

  const handleExport = () => {
    // Em produção, isso faria uma chamada para a API de exportação
    console.log('Exportando...', {
      template: selectedTemplate,
      campaigns: selectedCampaigns,
      fields: selectedFields,
      dateRange,
      format: exportFormat
    });
    
    // Simular download
    const filename = `relatorio-${selectedTemplate}-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
    alert(`Exportação iniciada: ${filename}`);
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
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof availableFields>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exportar Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios personalizados das suas campanhas
          </p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={!selectedTemplate || selectedCampaigns.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuração de Exportação */}
        <div className="lg:col-span-2 space-y-6">
          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Escolher Template</CardTitle>
              <CardDescription>
                Selecione um template predefinido ou personalize seu relatório
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {exportTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Icon className="w-5 h-5 mt-1" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{template.name}</h3>
                              {template.popular && (
                                <Badge variant="secondary">Popular</Badge>
                              )}
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Campanhas */}
          <Card>
            <CardHeader>
              <CardTitle>Campanhas</CardTitle>
              <CardDescription>
                Selecione as campanhas para incluir no relatório
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={campaign.id}
                      checked={selectedCampaigns.includes(campaign.id)}
                      onCheckedChange={() => handleCampaignToggle(campaign.id)}
                    />
                    <label
                      htmlFor={campaign.id}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {campaign.name}
                    </label>
                    <Badge 
                      variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}
                    >
                      {campaign.status === 'active' ? 'Ativa' : campaign.status === 'paused' ? 'Pausada' : 'Concluída'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Período */}
          <Card>
            <CardHeader>
              <CardTitle>Período</CardTitle>
              <CardDescription>
                Defina o intervalo de datas para o relatório
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.from ? (
                        format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                      ) : (
                        'Data inicial'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.to ? (
                        format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })
                      ) : (
                        'Data final'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setDateRange({ from: lastWeek, to: today });
                  }}
                >
                  Últimos 7 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setDateRange({ from: lastMonth, to: today });
                  }}
                >
                  Últimos 30 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastQuarter = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    setDateRange({ from: lastQuarter, to: today });
                  }}
                >
                  Último trimestre
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Campos Personalizados */}
          <Card>
            <CardHeader>
              <CardTitle>Campos do Relatório</CardTitle>
              <CardDescription>
                Personalize quais métricas incluir no relatório
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(groupedFields).map(([category, fields]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium mb-3">{category}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map((field) => (
                        <div key={field.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={field.id}
                            checked={selectedFields.includes(field.id)}
                            onCheckedChange={() => handleFieldToggle(field.id)}
                          />
                          <label
                            htmlFor={field.id}
                            className="text-sm cursor-pointer"
                          >
                            {field.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Preview e Histórico */}
        <div className="space-y-6">
          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">
                    {selectedTemplate ? exportTemplates.find(t => t.id === selectedTemplate)?.name : 'Nenhum'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Campanhas:</span>
                  <span className="font-medium">{selectedCampaigns.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Campos:</span>
                  <span className="font-medium">{selectedFields.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Formato:</span>
                  <span className="font-medium uppercase">{exportFormat}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Período:</span>
                  <span className="font-medium">
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
                      : 'Não definido'
                    }
                  </span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Tamanho estimado
                </p>
                <p className="text-lg font-semibold">~2.3 MB</p>
              </div>
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Exportações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exportHistory.map((export_item) => (
                  <div key={export_item.id} className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getFileIcon(export_item.type)}
                      <div>
                        <p className="text-sm font-medium">{export_item.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(export_item.date), 'dd/MM HH:mm')}</span>
                          <span>•</span>
                          <span>{export_item.size}</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}