// client/src/pages/copy.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form'; // Adicionado Controller
import { zodResolver } from '@hookform/resolvers/zod'; // Se for usar Zod para o form principal
import { z } from 'zod'; // Se for usar Zod para o form principal
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel as ShadcnSelectLabel } from '@/components/ui/select'; // ShadcnSelectLabel
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
} from 'lucide-react';
// Importar a configuração de finalidades de copy
import { allCopyPurposesConfig, type CopyPurposeConfig, type FieldDefinition } from '@/config/copyConfigurations'; // Ajuste o caminho se necessário

// Interfaces (alinhadas com o seu prompt detalhado)
interface BaseGeneratorFormState {
  product: string;
  audience: string;
  objective: string; // sales, leads, engagement, awareness
  tone: string; // professional, casual, etc.
}

type LaunchPhase = 'pre_launch' | 'launch' | 'post_launch' | ''; // Adicionado '' para estado inicial
type SpecificPurposeData = Record<string, any>;

interface FullGeneratorPayload extends BaseGeneratorFormState {
  launchPhase: LaunchPhase;
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
  // Adicionar type e platform se a API for retornar assim para cada variação
  type?: string;      // Ex: 'headline', 'body', 'cta'
  platform?: string;  // Ex: 'Facebook', 'Email'
}

interface SavedCopy {
  id: string | number; // Ajustado para corresponder ao schema do banco se necessário
  title: string;
  content: string; // mainCopy
  purposeKey: string;
  launchPhase: LaunchPhase;
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

// Zod schema para o formulário base (opcional, mas bom para validação)
const baseGeneratorFormSchema = z.object({
  product: z.string().min(1, "Produto/Serviço é obrigatório."),
  audience: z.string().min(1, "Público-Alvo é obrigatório."),
  objective: z.string().min(1, "Objetivo geral é obrigatório."),
  tone: z.string().min(1, "Tom geral é obrigatório."),
});


export default function CopyPage() {
  const [baseGeneratorForm, setBaseGeneratorForm] = useState<BaseGeneratorFormState>({
    product: '',
    audience: '',
    objective: 'sales',
    tone: 'professional',
  });
  const [selectedLaunchPhase, setSelectedLaunchPhase] = useState<LaunchPhase>('');
  const [selectedCopyPurposeKey, setSelectedCopyPurposeKey] = useState<string>('');
  const [specificPurposeData, setSpecificPurposeData] = useState<SpecificPurposeData>({});
  const [generatedCopies, setGeneratedCopies] = useState<GeneratedSpecificCopyResult[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Hook Form para o formulário base
  const rhfBaseForm = useForm<BaseGeneratorFormState>({
    resolver: zodResolver(baseGeneratorFormSchema),
    defaultValues: baseGeneratorForm,
  });

  useEffect(() => {
    rhfBaseForm.reset(baseGeneratorForm);
  }, [baseGeneratorForm, rhfBaseForm]);


  const { data: savedCopies = [], isLoading: copiesLoading } = useQuery<SavedCopy[]>({
    queryKey: ['savedCopies'], // Alterado queryKey para ser mais específico
    queryFn: async () => apiRequest('GET', '/api/copies').then(res => res.json()),
  });

  const handleBaseFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBaseGeneratorForm(prev => ({ ...prev, [name]: value }));
    rhfBaseForm.setValue(name as keyof BaseGeneratorFormState, value, { shouldValidate: true });
  };

  const handleBaseFormSelectChange = (name: keyof BaseGeneratorFormState, value: string) => {
    setBaseGeneratorForm(prev => ({ ...prev, [name]: value }));
    rhfBaseForm.setValue(name, value, { shouldValidate: true });
  };

  const handleCopyPurposeChange = (purposeKey: string) => {
    setSelectedCopyPurposeKey(purposeKey);
    const newSpecificData: Record<string, any> = {};
    const config = allCopyPurposesConfig.find(p => p.key === purposeKey);
    if (config) {
      config.fields.forEach(field => {
        newSpecificData[field.name] = field.defaultValue ?? '';
      });
    }
    setSpecificPurposeData(newSpecificData);
  };

  const handleSpecificDataChange = (fieldName: string, value: string | number | boolean) => {
    setSpecificPurposeData(prev => ({ ...prev, [fieldName]: value }));
  };

  // CORREÇÃO DA SINTAXE AQUI: "=>" na mesma linha ou após parênteses.
  const generateMutation = useMutation<GeneratedSpecificCopyItem, Error, FullGeneratorPayload>({
    mutationFn: async (data: FullGeneratorPayload) => { // Payload agora é FullGeneratorPayload
      const response = await apiRequest('POST', '/api/copies/generate', data);
      return response.json();
    },
    onSuccess: (data: GeneratedSpecificCopyItem) => { // API deve retornar GeneratedSpecificCopyItem
      toast({
        title: 'Copy gerada com sucesso!',
        // description: `Uma nova copy foi criada.`,
      });
      // Adiciona a nova copy gerada ao estado para exibição imediata
      setGeneratedCopies(prev => [{
        ...data,
        timestamp: new Date(),
        purposeKey: selectedCopyPurposeKey,
      }, ...prev]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao gerar copy',
        description: error.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const saveCopyMutation = useMutation<SavedCopy, Error, Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'>>({
    mutationFn: async (dataToSave) => {
      const response = await apiRequest('POST', '/api/copies', dataToSave);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedCopies'] });
      toast({
        title: 'Copy salva',
        description: 'A copy foi salva na sua biblioteca.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar copy', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation<void, Error, string | number >({
    mutationFn: (id) => apiRequest('DELETE', `/api/copies/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedCopies'] });
      toast({ title: 'Copy excluída', description: 'A copy foi removida da sua biblioteca.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir copy', description: error.message, variant: 'destructive' });
    }
  });


  const handleGenerate = async () => {
    const baseFormValid = await rhfBaseForm.trigger();
    if (!baseFormValid) {
      toast({ title: 'Campos básicos inválidos', description: 'Verifique os campos de Produto/Serviço e Público-Alvo.', variant: 'destructive' });
      return;
    }

    if (!selectedCopyPurposeKey) {
      toast({ title: 'Finalidade não selecionada', description: 'Por favor, selecione uma finalidade para a copy.', variant: 'destructive'});
      return;
    }

    const currentFieldsConfig = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey)?.fields || [];
    let allSpecificFieldsValid = true;
    for (const field of currentFieldsConfig) {
      if (field.required && (!specificPurposeData[field.name] || String(specificPurposeData[field.name]).trim() === '')) {
        toast({ title: 'Campo Específico Obrigatório', description: `O campo "${field.label}" é obrigatório para esta finalidade.`, variant: 'destructive' });
        allSpecificFieldsValid = false;
        break; 
      }
    }
    if (!allSpecificFieldsValid) return;

    const payload: FullGeneratorPayload = {
      ...baseGeneratorForm,
      launchPhase: selectedLaunchPhase,
      copyPurposeKey: selectedCopyPurposeKey,
      details: specificPurposeData,
    };
    generateMutation.mutate(payload);
  };
  
  const filteredSavedCopies = savedCopies.filter(copy => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch = copy.title.toLowerCase().includes(searchTermLower) ||
                         copy.content.toLowerCase().includes(searchTermLower) ||
                         (copy.purposeKey && allCopyPurposesConfig.find(p=>p.key === copy.purposeKey)?.label.toLowerCase().includes(searchTermLower));
    
    const purposeDetails = allCopyPurposesConfig.find(p => p.key === copy.purposeKey);
    const typeMatch = selectedTypeFilter === 'all' || (purposeDetails && purposeDetails.category.toLowerCase().includes(selectedTypeFilter.toLowerCase()));
    
    return matchesSearch && typeMatch;
  });

  const getTypeConfig = (type: string | undefined, purposeKey?: string ) => {
    // Prioriza a categoria da finalidade, se disponível
    if (purposeKey) {
        const purposeConfig = allCopyPurposesConfig.find(p => p.key === purposeKey);
        if (purposeConfig?.category) {
            return { label: purposeConfig.category, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' };
        }
    }
    const typeConfigs: Record<string, { label: string; className: string }> = {
      headline: { label: 'Headline', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
      cta: { label: 'CTA', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
      description: { label: 'Descrição', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
      body: { label: 'Corpo de Texto', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
      email_body: { label: 'Corpo de E-mail', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' },
      geral: { label: 'Geral', className: 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300' },
      fallback: { label: 'Fallback', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
      error_generation: { label: 'Erro Geração', className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    };
    return typeConfigs[type || 'geral'] || { label: type || 'Geral', className: 'bg-muted text-muted-foreground' };
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência.' }); };

  const handleSaveGeneratedCopy = (generatedCopy: GeneratedSpecificCopyResult) => {
    const title = `${allCopyPurposesConfig.find(p=>p.key === generatedCopy.purposeKey)?.label || 'Copy Gerada'} - ${baseGeneratorForm.product.substring(0,20)} (${new Date(generatedCopy.timestamp).toLocaleDateString('pt-BR')})`;
    const dataToSave: Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'> = {
        title: title,
        content: generatedCopy.mainCopy,
        purposeKey: generatedCopy.purposeKey,
        launchPhase: selectedLaunchPhase,
        details: specificPurposeData, // Os detalhes usados para gerar
        baseInfo: baseGeneratorForm,  // As infos base usadas para gerar
        platform: generatedCopy.platformSuggestion,
        fullGeneratedResponse: { // Salvar toda a resposta da IA
            mainCopy: generatedCopy.mainCopy,
            alternativeVariation1: generatedCopy.alternativeVariation1,
            alternativeVariation2: generatedCopy.alternativeVariation2,
            platformSuggestion: generatedCopy.platformSuggestion,
            notes: generatedCopy.notes
        },
        // campaignId: // Adicionar seletor de campanha ao salvar
    };
    saveCopyMutation.mutate(dataToSave);
  };

  const deleteSavedCopy = (id: string | number) => { if (window.confirm('Tem certeza que deseja excluir esta copy salva?')) { deleteMutation.mutate(id); } };
  
  const availablePurposesForPhase = useMemo(() => {
    if (!selectedLaunchPhase) return [];
    const filtered = allCopyPurposesConfig.filter(p => p.phase === selectedLaunchPhase);
    const grouped = filtered.reduce((acc, purpose) => {
      const category = purpose.category || 'Outros';
      if (!acc[category]) acc[category] = [];
      acc[category].push({ value: purpose.key, label: purpose.label });
      return acc;
    }, {} as Record<string, Array<{ value: string; label: string }>>);
    return Object.entries(grouped);
  }, [selectedLaunchPhase]);

  const currentPurposeConfig = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerador Avançado de Copy</h1>
          <p className="text-muted-foreground mt-2">Crie textos persuasivos e específicos com a ajuda da IA.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center"><Bot className="w-6 h-6 mr-2 text-primary" />Configurar Geração</CardTitle>
            <CardDescription>Preencha os campos para que a IA crie a copy ideal para sua necessidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormProvider {...rhfBaseForm}>
              <form> {/* Não precisa de onSubmit aqui, o botão de gerar é separado */}
                <Card className="p-4 border-border/70 shadow-sm">
                  <CardHeader className="p-0 pb-3"><CardTitle className="text-lg">Informações Base</CardTitle></CardHeader>
                  <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={rhfBaseForm.control} name="product" render={({ field }) => (<FormItem><FormLabel>Produto/Serviço Geral*</FormLabel><FormControl><Input placeholder="Ex: Consultoria de Marketing" {...field} value={baseGeneratorForm.product} onChange={handleBaseFormChange} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={rhfBaseForm.control} name="audience" render={({ field }) => (<FormItem><FormLabel>Público-Alvo Geral*</FormLabel><FormControl><Input placeholder="Ex: Pequenos empresários" {...field} value={baseGeneratorForm.audience} onChange={handleBaseFormChange} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={rhfBaseForm.control} name="objective" render={({ field }) => (<FormItem><FormLabel>Objetivo Geral da Marca</FormLabel><Select value={field.value} onValueChange={value => handleBaseFormSelectChange("objective", value)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{[{value: 'sales', label: 'Gerar Vendas'}, {value: 'leads', label: 'Gerar Leads'}, {value: 'engagement', label: 'Aumentar Engajamento'}, {value: 'awareness', label: 'Criar Reconhecimento'}].map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={rhfBaseForm.control} name="tone" render={({ field }) => (<FormItem><FormLabel>Tom de Voz Geral</FormLabel><Select value={field.value} onValueChange={value => handleBaseFormSelectChange("tone", value)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>
                        {['professional', 'casual', 'urgent', 'inspirational', 'educational', 'empathetic', 'sofisticado', 'divertido'].map(tone => <SelectItem key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</SelectItem>)}
                    </SelectContent></Select><FormMessage /></FormItem>)} />
                  </CardContent>
                </Card>
              </form>
            </FormProvider>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="launch-phase" className="font-semibold">Fase do Lançamento</Label>
                    <Select value={selectedLaunchPhase} onValueChange={(value: LaunchPhase | '') => { setSelectedLaunchPhase(value); setSelectedCopyPurposeKey(''); setSpecificPurposeData({}); }}>
                        <SelectTrigger id="launch-phase"><SelectValue placeholder="Selecione a fase..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pre_launch">Pré-Lançamento</SelectItem>
                            <SelectItem value="launch">Lançamento</SelectItem>
                            <SelectItem value="post_launch">Pós-Lançamento</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="copy-purpose" className="font-semibold">Finalidade da Copy Específica*</Label>
                    <Select value={selectedCopyPurposeKey} onValueChange={handleCopyPurposeChange} disabled={!selectedLaunchPhase}>
                        <SelectTrigger id="copy-purpose" disabled={!selectedLaunchPhase || availablePurposesForPhase.length === 0}>
                            <SelectValue placeholder={selectedLaunchPhase ? "Selecione uma finalidade..." : "Selecione uma fase primeiro"}/>
                        </SelectTrigger>
                        <SelectContent>
                        {availablePurposesForPhase.map(([category, options]) => (
                            <SelectGroup key={category}>
                                <ShadcnSelectLabel className="text-xs text-muted-foreground px-2 py-1.5">{category}</ShadcnSelectLabel>
                                {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectGroup>
                        ))}
                        {selectedLaunchPhase && availablePurposesForPhase.length === 0 && <div className="p-2 text-sm text-muted-foreground">Nenhuma finalidade para esta fase.</div>}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {currentPurposeConfig && (
              <Card className="p-4 pt-2 bg-card border-border/70 shadow-sm">
                <CardHeader className="p-0 pb-3 mb-3 border-b">
                    <CardTitle className="text-base">Detalhes para: {allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey)?.label}</CardTitle>
                    {currentPurposeConfig.description && <CardDescription className="text-xs mt-1">{currentPurposeConfig.description}</CardDescription>}
                </CardHeader>
                <CardContent className="p-0 space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {currentPurposeConfig.fields.map(field => (
                    <div key={field.name} className="space-y-1">
                        <div className="flex items-center">
                        <Label htmlFor={`specific-${field.name}`} className="text-sm font-medium text-foreground">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {field.tooltip && (
                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="w-3.5 h-3.5 ml-1.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs z-50"><p className="text-xs">{field.tooltip}</p></TooltipContent></Tooltip></TooltipProvider>
                        )}
                        </div>
                        {field.type === 'textarea' ? (
                        <Textarea id={`specific-${field.name}`} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, e.target.value)} rows={field.label.toLowerCase().includes('tópicos') || field.label.toLowerCase().includes('passos') || field.label.toLowerCase().includes('conteúdo') ? 4 : 2} required={field.required} />
                        ) : field.type === 'select' ? (
                        <Select value={specificPurposeData[field.name] || field.defaultValue || ''} onValueChange={(value) => handleSpecificDataChange(field.name, value)} required={field.required}>
                            <SelectTrigger id={`specific-${field.name}`}><SelectValue placeholder={field.placeholder || 'Selecione...'} /></SelectTrigger>
                            <SelectContent>{field.options?.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                        </Select>
                        ) : (
                        <Input id={`specific-${field.name}`} type={field.type as React.HTMLInputTypeAttribute} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} required={field.required} />
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

            <Button onClick={handleGenerate} disabled={generateMutation.isPending || !selectedCopyPurposeKey || !baseGeneratorForm.product || !baseGeneratorForm.audience} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-base py-6">
              {generateMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Gerar Copy Avançada
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 sticky top-8">
          <CardHeader>
            <CardTitle>Copies Geradas pela IA</CardTitle>
            <CardDescription>Resultados baseados nas suas configurações.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar"> {/* Ajuste de altura */}
              {generateMutation.isPending && ( <div className="text-center py-8 text-primary"><Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" /><p>Gerando suas copies...</p></div> )}
              {!generateMutation.isPending && generatedCopies.length === 0 && ( <div className="text-center py-10 text-muted-foreground"><Bot className="w-12 h-12 mx-auto mb-3 opacity-60" /><p>Suas copies aparecerão aqui.</p></div> )}
              {generatedCopies.map((copy, index) => {
                const typeConfig = getTypeConfig(copy.type, copy.purposeKey);
                const displayContent = copy.mainCopy || copy.content; // Prioriza mainCopy se existir
                return (
                  <div key={index} className="border border-border rounded-lg p-3 bg-card hover:shadow-md transition-shadow relative">
                    <div className="flex justify-between items-start mb-1.5">
                      <Badge className={`${typeConfig.className} text-xs font-medium`}>{typeConfig.label} {copy.platform && copy.platform !== 'geral' && `(${copy.platform})`}</Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(displayContent)} title="Copiar"><CopyIcon className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveGeneratedCopy(copy)} disabled={saveCopyMutation.isPending} title="Salvar na Biblioteca"><Save className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground mb-2 whitespace-pre-line">{displayContent}</p>
                    {copy.alternativeVariation1 && <details className="text-xs"><summary className="cursor-pointer text-muted-foreground hover:text-primary">Ver Variação 1</summary><p className="mt-1 p-2 bg-muted/50 rounded whitespace-pre-line">{copy.alternativeVariation1}</p></details>}
                    {copy.alternativeVariation2 && <details className="text-xs mt-1"><summary className="cursor-pointer text-muted-foreground hover:text-primary">Ver Variação 2</summary><p className="mt-1 p-2 bg-muted/50 rounded whitespace-pre-line">{copy.alternativeVariation2}</p></details>}
                    {copy.notes && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">Nota IA: {copy.notes}</p>}
                    <p className="text-xs text-muted-foreground text-right mt-1.5">Gerado: {copy.timestamp.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Biblioteca de Copies Salvas</CardTitle>
            <div className="flex items-center space-x-2">
              <Input placeholder="Buscar na biblioteca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-56 text-xs" />
              <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                <SelectTrigger className="w-48 text-xs"><SelectValue placeholder="Filtrar por categoria..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {/* Gerar opções de categoria dinamicamente a partir de allCopyPurposesConfig */}
                  {Array.from(new Set(allCopyPurposesConfig.map(p => p.category))).map(cat => (
                    <SelectItem key={cat} value={cat.toLowerCase().replace(/\s+/g, '_')}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {copiesLoading && <div className="text-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/> Carregando biblioteca...</div>}
          {!copiesLoading && filteredSavedCopies.length === 0 && (
             <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma copy na biblioteca</h3>
                <p>{savedCopies.length === 0 ? 'Suas copies salvas aparecerão aqui.' : 'Nenhuma copy corresponde aos filtros atuais.'}</p>
              </div>
           )}
          {!copiesLoading && filteredSavedCopies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavedCopies.map((copy) => {
                const typeConfig = getTypeConfig(copy.type, copy.purposeKey);
                return (
                  <Card key={copy.id} className="hover:shadow-lg transition-shadow flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-semibold line-clamp-2 mr-2">{copy.title}</CardTitle>
                        <Badge className={`${typeConfig.className} text-xs self-start shrink-0`}>{typeConfig.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground line-clamp-4 flex-grow mb-2">
                      {copy.content}
                    </CardContent>
                    <DialogFooter className="p-3 border-t mt-auto flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Salvo em: {new Date(copy.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(copy.content)} title="Copiar"><CopyIcon className="w-3.5 h-3.5" /></Button>
                        {/* <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar (Futuro)"><Edit className="w-3.5 h-3.5" /></Button> */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteSavedCopy(copy.id)} disabled={deleteMutation.isPending && deleteMutation.variables === copy.id} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </DialogFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
