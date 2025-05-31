// client/src/pages/copy.tsx
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel as ShadcnSelectLabel } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import {
  Bot,
  Copy as CopyIcon,
  Save,
  Edit,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  Search,
  Info,
  ChevronDown,
  RotateCcw, // Para Reutilizar
} from 'lucide-react';
import { allCopyPurposesConfig, type CopyPurposeConfig, type FieldDefinition, type LaunchPhase as LaunchPhaseType } from '@/config/copyConfigurations'; // Importar do novo arquivo

// --- Interfaces (Parte 1 do seu prompt) ---
interface BaseGeneratorFormState {
  product: string;
  audience: string;
  objective: 'sales' | 'leads' | 'engagement' | 'awareness';
  tone: 'professional' | 'casual' | 'urgent' | 'inspirational' | 'educational' | 'empathetic' | 'divertido' | 'sofisticado';
}

type SpecificPurposeData = Record<string, any>;

interface FullGeneratorPayload extends BaseGeneratorFormState {
  launchPhase: LaunchPhaseType;
  copyPurposeKey: string;
  details: SpecificPurposeData;
}

interface GeneratedSpecificCopyItem {
  mainCopy: string;
  alternativeVariation1?: string;
  alternativeVariation2?: string;
  platformSuggestion?: string;
  notes?: string;
}

interface GeneratedSpecificCopyResult extends GeneratedSpecificCopyItem {
  timestamp: Date;
  purposeKey: string;
  // Adicionado para casar com a estrutura da API de cópias
  type?: string; 
  platform?: string; 
}

interface SavedCopy {
  id: string | number;
  title: string;
  content: string; // mainCopy
  purposeKey: string;
  launchPhase: LaunchPhaseType;
  details: SpecificPurposeData;
  baseInfo: BaseGeneratorFormState;
  platform?: string;
  campaignId?: number;
  createdAt: string;
  lastUpdatedAt: string;
  isFavorite?: boolean;
  tags?: string[];
  fullGeneratedResponse?: GeneratedSpecificCopyItem;
}
// --- End Interfaces ---

// Zod schema para o formulário base
const baseGeneratorFormSchema = z.object({
  product: z.string().min(3, "Produto/Serviço deve ter pelo menos 3 caracteres."),
  audience: z.string().min(3, "Público-Alvo deve ter pelo menos 3 caracteres."),
  objective: z.enum(['sales', 'leads', 'engagement', 'awareness']),
  tone: z.enum(['professional', 'casual', 'urgent', 'inspirational', 'educational', 'empathetic', 'divertido', 'sofisticado']),
});

const objectiveOptions: Array<{ value: BaseGeneratorFormState['objective']; label: string }> = [
    { value: 'sales', label: 'Gerar Vendas' }, { value: 'leads', label: 'Gerar Leads' },
    { value: 'engagement', label: 'Aumentar Engajamento' }, { value: 'awareness', label: 'Criar Reconhecimento' }
];
const toneOptions: Array<{ value: BaseGeneratorFormState['tone']; label: string }> = [
    { value: 'professional', label: 'Profissional' }, { value: 'casual', label: 'Casual' },
    { value: 'urgent', label: 'Urgente' }, { value: 'inspirational', label: 'Inspiracional' },
    { value: 'educational', label: 'Educativo' }, { value: 'empathetic', label: 'Empático' },
    { value: 'divertido', label: 'Divertido' }, { value: 'sofisticado', label: 'Sofisticado' }
];


export default function CopyPage() {
  const [baseGeneratorFormState, setBaseGeneratorFormState] = useState<BaseGeneratorFormState>({
    product: '', audience: '', objective: 'sales', tone: 'professional',
  });
  const [selectedLaunchPhase, setSelectedLaunchPhase] = useState<LaunchPhaseType | ''>('');
  const [selectedCopyPurposeKey, setSelectedCopyPurposeKey] = useState<string>('');
  const [specificPurposeData, setSpecificPurposeData] = useState<SpecificPurposeData>({});
  const [generatedCopies, setGeneratedCopies] = useState<GeneratedSpecificCopyResult[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLaunchPhase, setFilterLaunchPhase] = useState<LaunchPhaseType | 'all'>('all');
  const [filterCopyPurpose, setFilterCopyPurpose] = useState<string | 'all'>('all');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rhfBaseForm = useForm<BaseGeneratorFormState>({
    resolver: zodResolver(baseGeneratorFormSchema),
    defaultValues: baseGeneratorFormState,
  });

  useEffect(() => {
    rhfBaseForm.reset(baseGeneratorFormState);
  }, [baseGeneratorFormState, rhfBaseForm]);

  const { data: savedCopies = [], isLoading: copiesLoading, refetch: refetchSavedCopies } = useQuery<SavedCopy[]>({
    queryKey: ['savedCopies'],
    queryFn: async () => apiRequest('GET', '/api/copies').then(res => res.json()).then(data => Array.isArray(data) ? data : []),
  });

  const handleCopyPurposeChange = (purposeKey: string) => {
    setSelectedCopyPurposeKey(purposeKey);
    const currentConfig = allCopyPurposesConfig.find(p => p.key === purposeKey);
    const defaultValues: SpecificPurposeData = {};
    if (currentConfig) {
      currentConfig.fields.forEach(field => {
        defaultValues[field.name] = field.defaultValue ?? (field.type === 'textarea' || field.type === 'text' ? '' : field.type === 'number' ? 0 : '');
      });
    }
    setSpecificPurposeData(defaultValues);
    setGeneratedCopies([]); // Limpa geradas anteriormente ao mudar finalidade
  };
  
  useEffect(() => {
    setSelectedCopyPurposeKey(''); // Reseta finalidade quando fase muda
    setSpecificPurposeData({});
    setGeneratedCopies([]);
  }, [selectedLaunchPhase]);


  const handleSpecificDataChange = (name: string, value: string | number | boolean) => {
    setSpecificPurposeData(prev => ({ ...prev, [name]: value }));
  };

  const generateSpecificCopyMutation = useMutation<GeneratedSpecificCopyItem[], Error, FullGeneratorPayload>({
    mutationFn: async (payload: FullGeneratorPayload) => {
      // A chamada à API Gemini foi movida para o backend (/api/copies/generate)
      const response = await apiRequest('POST', '/api/copies/generate', payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Erro ${response.status} ao gerar copy.`}));
        throw new Error(errorData.message || errorData.error || `Erro desconhecido da API (${response.status})`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (!Array.isArray(data) || data.length === 0) {
        toast({ title: 'Nenhuma copy gerada', description: 'A IA não retornou sugestões para esta configuração.', variant: 'default' });
        setGeneratedCopies([]);
        return;
      }
      const timestampedData = data.map(item => ({
        ...item,
        timestamp: new Date(),
        purposeKey: selectedCopyPurposeKey,
        // type e platform devem vir da API agora se ela retornar múltiplas partes
      }));
      setGeneratedCopies(timestampedData);
      toast({ title: 'Copies Geradas!', description: `${timestampedData.length} ${timestampedData.length === 1 ? 'sugestão foi criada' : 'sugestões foram criadas'}.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao Gerar Copy', description: error.message, variant: 'destructive' });
    },
  });
  
  const saveCopyMutation = useMutation<SavedCopy, Error, Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'>>({
    mutationFn: async (dataToSave) => {
      const response = await apiRequest('POST', '/api/copies', dataToSave);
      if (!response.ok) throw new Error('Falha ao salvar copy na biblioteca.');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedCopies'] });
      toast({ title: 'Copy Salva!', description: 'Sua copy foi salva na biblioteca.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao Salvar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation<void, Error, string | number >({
    mutationFn: (id) => apiRequest('DELETE', `/api/copies/${id}`).then(res => {if (!res.ok) throw new Error('Falha ao excluir'); return res.json()}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedCopies'] });
      toast({ title: 'Copy Excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao Excluir', description: error.message, variant: 'destructive' });
    }
  });

  const handleBaseFormSubmit = async (data: BaseGeneratorFormState) => {
    setBaseGeneratorFormState(data); // Atualiza o estado local que é usado no payload
    
    if (!selectedLaunchPhase) {
      toast({ title: 'Seleção Necessária', description: 'Selecione uma Fase do Lançamento.', variant: 'destructive' });
      return;
    }
    if (!selectedCopyPurposeKey) {
      toast({ title: 'Seleção Necessária', description: 'Selecione uma Finalidade da Copy Específica.', variant: 'destructive' });
      return;
    }
    const currentFields = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey)?.fields || [];
    for (const field of currentFields) {
      if (field.required && (!specificPurposeData[field.name] || String(specificPurposeData[field.name]).trim() === '')) {
        toast({ title: 'Campo Específico Obrigatório', description: `O campo "${field.label}" é obrigatório.`, variant: 'destructive' });
        return;
      }
    }

    const payload: FullGeneratorPayload = {
      ...data, // Usa os dados validados do react-hook-form
      launchPhase: selectedLaunchPhase,
      copyPurposeKey: selectedCopyPurposeKey,
      details: specificPurposeData,
    };
    generateSpecificCopyMutation.mutate(payload);
  };

  const copyToClipboard = (text?: string) => { /* ... (como na sua versão) ... */ };
  const handleSaveGeneratedCopy = (copyItem: GeneratedSpecificCopyResult) => { /* ... (como na sua versão) ... */ };
  const handleReuseSavedCopy = (savedCopy: SavedCopy) => { /* ... (como na sua versão) ... */ };
  
  const currentPurposeConfigDetails = useMemo(() => allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey), [selectedCopyPurposeKey]);
  const currentSpecificFields: FieldDefinition[] = useMemo(() => currentPurposeConfigDetails?.fields || [], [currentPurposeConfigDetails]);

  const availablePurposesForPhase = useMemo(() => { /* ... (como na sua versão) ... */ }, [selectedLaunchPhase]);
  const filteredSavedCopies = useMemo(() => { /* ... (como na sua versão, talvez ajuste o filter para purposeKey) ... */ }, [savedCopies, searchTerm, filterLaunchPhase, filterCopyPurpose]);


  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 font-sans bg-background min-h-screen">
      <header className="pb-4 sm:pb-6 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gerador de Copy IA Avançado</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2">Crie textos altamente específicos para cada etapa do seu lançamento.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        <Card className="lg:col-span-2 neu-card">
          <CardHeader className="neu-card-header">
            <CardTitle className="neu-card-title"><Bot className="mr-2" />Configurar Geração</CardTitle>
            <CardDescription>Selecione a finalidade e preencha os detalhes para obter a copy perfeita.</CardDescription>
          </CardHeader>
          <CardContent className="neu-card-content space-y-6">
            <FormProvider {...rhfBaseForm}>
              <form onSubmit={rhfBaseForm.handleSubmit(handleBaseFormSubmit)} className="space-y-6">
                <Accordion type="single" collapsible defaultValue="item-base" className="w-full">
                  <AccordionItem value="item-base" className="border-b-0">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline p-3 bg-muted/50 dark:bg-muted/20 rounded-t-md">
                        Informações Base (Obrigatórias)
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-3 border border-t-0 rounded-b-md bg-card">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={rhfBaseForm.control} name="product" render={({ field }) => (<FormItem><FormLabel>Produto/Serviço Geral*</FormLabel><FormControl><Input placeholder="Ex: Consultoria de Marketing Avançada" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="audience" render={({ field }) => (<FormItem><FormLabel>Público-Alvo Geral*</FormLabel><FormControl><Input placeholder="Ex: Empresas SaaS B2B" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="objective" render={({ field }) => (<FormItem><FormLabel>Objetivo Geral da Marca</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{objectiveOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="tone" render={({ field }) => (<FormItem><FormLabel>Tom de Voz Geral</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{toneOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
            
                <div className="space-y-1.5">
                    <Label htmlFor="launch-phase" className="text-md font-semibold">1. Fase do Lançamento*</Label>
                    <Select value={selectedLaunchPhase} onValueChange={(value: LaunchPhaseType | '') => setSelectedLaunchPhase(value)}>
                        <SelectTrigger id="launch-phase"><SelectValue placeholder="Selecione uma fase..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pre_launch">Pré-Lançamento</SelectItem>
                            <SelectItem value="launch">Lançamento</SelectItem>
                            <SelectItem value="post_launch">Pós-Lançamento</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {selectedLaunchPhase && (
                  <div className="space-y-1.5">
                    <Label htmlFor="copy-purpose-key" className="text-md font-semibold">2. Finalidade da Copy Específica*</Label>
                    <Select value={selectedCopyPurposeKey} onValueChange={handleCopyPurposeChange} disabled={availablePurposesForPhase.length === 0}>
                        <SelectTrigger id="copy-purpose-key"><SelectValue placeholder={availablePurposesForPhase.length > 0 ? "Selecione a finalidade..." : "Nenhuma finalidade para esta fase"} /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                        {availablePurposesForPhase.map(([category, options]) => (
                            <SelectGroup key={category}>
                                <ShadcnSelectLabel>{category}</ShadcnSelectLabel>
                                {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectGroup>
                        ))}
                        </SelectContent>
                    </Select>
                     {currentPurposeConfigDetails && <CardDescription className="text-xs mt-1">{currentPurposeConfigDetails.description}</CardDescription>}
                  </div>
                )}
                
                {selectedCopyPurposeKey && currentSpecificFields.length > 0 && (
                  <Card className="p-4 pt-2 bg-muted/30 dark:bg-muted/10 border-border/70 shadow-inner">
                    <CardHeader className="p-0 pb-3 mb-3 border-b">
                        <CardTitle className="text-base">3. Detalhes para: <span className="text-primary">{allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey)?.label}</span></CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {currentSpecificFields.map(field => (
                        <div key={field.name} className="space-y-1.5">
                            <div className="flex items-center">
                            <Label htmlFor={`specific-${field.name}`} className="text-sm font-medium text-foreground">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {field.tooltip && (
                                <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="w-3.5 h-3.5 ml-1.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs z-50"><p className="text-xs">{field.tooltip}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            </div>
                            {field.type === 'textarea' ? (
                            <Textarea id={`specific-${field.name}`} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, e.target.value)} rows={field.label.toLowerCase().includes('tópicos') || field.label.toLowerCase().includes('passos') || field.label.toLowerCase().includes('conteúdo') ? 4 : 2} required={field.required} className="bg-background"/>
                            ) : field.type === 'select' ? (
                            <Select value={specificPurposeData[field.name] || field.defaultValue || ''} onValueChange={(value) => handleSpecificDataChange(field.name, value)} required={field.required}>
                                <SelectTrigger id={`specific-${field.name}`} className="bg-background"><SelectValue placeholder={field.placeholder || 'Selecione...'} /></SelectTrigger>
                                <SelectContent>{field.options?.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                            </Select>
                            ) : (
                            <Input id={`specific-${field.name}`} type={field.type as React.HTMLInputTypeAttribute} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} required={field.required} className="bg-background"/>
                            )}
                        </div>
                        ))}
                    </CardContent>
                  </Card>
                )}
                 {!selectedCopyPurposeKey && selectedLaunchPhase && (
                    <div className="text-center py-6 text-muted-foreground border rounded-md bg-muted/20">
                        <Info className="w-8 h-8 mx-auto mb-2 opacity-70"/>
                        <p>Selecione uma "Finalidade da Copy" para fornecer os detalhes.</p>
                    </div>
                )}

                <Button type="submit" disabled={generateSpecificCopyMutation.isPending || !selectedCopyPurposeKey} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-base py-6">
                  {generateSpecificCopyMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  Gerar Copy Avançada
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 sticky top-6 neu-card">
            <CardHeader className="neu-card-header">
                <CardTitle className="neu-card-title"><Sparkles className="mr-2 text-primary"/>Copies Geradas pela IA</CardTitle>
                <CardDescription>Resultados baseados nas suas configurações.</CardDescription>
            </CardHeader>
            <CardContent className="neu-card-content">
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                {generateSpecificCopyMutation.isPending && ( <div className="text-center py-10 text-primary"><Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" /> Gerando suas copies...</div> )}
                {!generateSpecificCopyMutation.isPending && generatedCopies.length === 0 && ( <div className="text-center py-10 text-muted-foreground"><Bot className="w-12 h-12 mx-auto mb-3 opacity-60" /><p>Suas copies personalizadas aparecerão aqui.</p></div> )}
                {generatedCopies.map((copy, index) => {
                    const displayContent = copy.mainCopy || (copy as any).content; // Compatibilidade
                    const purposeConfig = allCopyPurposesConfig.find(p => p.key === copy.purposeKey);
                    return (
                    <div key={index} className="border border-border rounded-lg p-3 bg-card hover:shadow-md transition-shadow relative">
                        <div className="flex justify-between items-center mb-1.5">
                        <Badge variant="outline" className="text-xs font-medium">{purposeConfig?.label || copy.purposeKey}</Badge>
                        <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(displayContent)} title="Copiar Principal"><CopyIcon className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveGeneratedCopy(copy)} disabled={saveCopyMutation.isPending} title="Salvar na Biblioteca"><Save className="w-3.5 h-3.5" /></Button>
                        </div>
                        </div>
                        <h5 className="font-semibold text-sm text-foreground mt-1">Texto Principal:</h5>
                        <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line p-2 bg-muted/30 dark:bg-muted/20 rounded">{displayContent}</p>
                        
                        {copy.alternativeVariation1 && (<details className="text-xs my-1"><summary className="cursor-pointer text-muted-foreground hover:text-primary font-medium">Ver Variação 1</summary><p className="mt-1 p-2 bg-muted/30 dark:bg-muted/20 rounded whitespace-pre-line text-muted-foreground">{copy.alternativeVariation1}</p></details>)}
                        {copy.alternativeVariation2 && (<details className="text-xs my-1"><summary className="cursor-pointer text-muted-foreground hover:text-primary font-medium">Ver Variação 2</summary><p className="mt-1 p-2 bg-muted/30 dark:bg-muted/20 rounded whitespace-pre-line text-muted-foreground">{copy.alternativeVariation2}</p></details>)}
                        
                        {copy.platformSuggestion && <p className="text-xs text-muted-foreground mt-2">Plataforma Sugerida: <Badge variant="secondary" className="text-xs">{copy.platformSuggestion}</Badge></p>}
                        {copy.notes && <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 italic">Nota da IA: {copy.notes}</p>}
                        <p className="text-xs text-muted-foreground/70 text-right mt-1.5">Gerado: {copy.timestamp.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    );
                })}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="neu-card">
        <CardHeader className="neu-card-header flex-wrap gap-3 md:flex-nowrap md:items-center md:justify-between">
          <CardTitle className="neu-card-title"><FileText className="mr-2"/> Biblioteca de Copies Salvas</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full md:w-auto">
            <div className="relative flex-grow"><Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Buscar na biblioteca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="neu-input pl-8 text-sm" /></div>
            <Select value={filterLaunchPhase} onValueChange={(v) => setFilterLaunchPhase(v as LaunchPhaseType | 'all')}>
                <SelectTrigger className="neu-input text-sm w-full sm:w-auto"><SelectValue placeholder="Filtrar Fase..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas as Fases</SelectItem><SelectItem value="pre_launch">Pré-Lançamento</SelectItem><SelectItem value="launch">Lançamento</SelectItem><SelectItem value="post_launch">Pós-Lançamento</SelectItem></SelectContent>
            </Select>
            <Select value={filterCopyPurpose} onValueChange={(v) => setFilterCopyPurpose(v as string | 'all')}>
                <SelectTrigger className="neu-input text-sm w-full sm:w-auto"><SelectValue placeholder="Filtrar Finalidade..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                    <SelectItem value="all">Todas Finalidades</SelectItem>
                    {allCopyPurposesConfig.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="neu-card-content">
          {copiesLoading && <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto"/> Carregando biblioteca...</div>}
          {!copiesLoading && filteredSavedCopies.length === 0 && (
             <div className="text-center py-12 text-muted-foreground"><FileText className="w-16 h-16 mx-auto mb-4 opacity-50" /><h3 className="text-lg font-semibold mb-2">Nenhuma copy encontrada.</h3><p>{(savedCopies || []).length === 0 ? 'Suas copies salvas aparecerão aqui.' : 'Ajuste os filtros ou crie novas copies.'}</p></div>
           )}
           {!copiesLoading && filteredSavedCopies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSavedCopies.map((copy) => (
                <Card key={copy.id} className="neu-card flex flex-col hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-4 flex flex-col flex-grow">
                    <h4 className="font-semibold text-foreground line-clamp-2 mb-1 text-base leading-tight">{copy.title}</h4>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="outline" className="text-xs">{allCopyPurposesConfig.find(p => p.key === copy.purposeKey)?.category || 'Desconhecido'}</Badge>
                        <Badge variant="secondary" className="text-xs">{copy.launchPhase === 'pre_launch' ? 'Pré-Lançamento' : copy.launchPhase === 'launch' ? 'Lançamento' : 'Pós-Lançamento'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-grow mb-2">{copy.content}</p>
                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">{new Date(copy.createdAt).toLocaleDateString('pt-BR')}</span>
                      <div className="flex space-x-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReuseSavedCopy(copy)} title="Reutilizar no Gerador"><RotateCcw className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(copy.content)} title="Copiar"><CopyIcon className="w-3.5 h-3.5" /></Button>
                        {/* <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar (Futuro)"><Edit className="w-3.5 h-3.5" /></Button> */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(copy.id)} disabled={deleteMutation.isPending && deleteMutation.variables === copy.id} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
