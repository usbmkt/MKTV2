// client/src/pages/copy.tsx
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form'; // Controller não é explicitamente usado aqui se usando FormField
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel as ShadcnSelectLabel } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; // Label padrão, FormLabel é de "@/components/ui/form"
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
  RotateCcw,
} from 'lucide-react';
// Importar a configuração de finalidades de copy
import { allCopyPurposesConfig, type CopyPurposeConfig, type FieldDefinition, type LaunchPhase as LaunchPhaseType } from '@/config/copyConfigurations';

// CORREÇÃO CRÍTICA: Adicionar importações para componentes de formulário do shadcn/ui
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// --- Interfaces (mantidas como na sua especificação) ---
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
  type?: string; 
  platform?: string; 
}

interface SavedCopy {
  id: string | number;
  title: string;
  content: string; 
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
    defaultValues: baseGeneratorFormState, // Sincronizar com o estado local
  });

  // Sincronizar react-hook-form com o estado local baseGeneratorFormState
  useEffect(() => {
    rhfBaseForm.reset(baseGeneratorFormState);
  }, [baseGeneratorFormState, rhfBaseForm]);

  // Efeito para resetar campos específicos e limpar cópias geradas ao mudar a finalidade
  useEffect(() => {
    const currentConfig = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey);
    const defaultValues: SpecificPurposeData = {};
    if (currentConfig) {
      currentConfig.fields.forEach(field => {
        defaultValues[field.name] = field.defaultValue ?? (field.type === 'textarea' || field.type === 'text' ? '' : field.type === 'number' ? 0 : '');
      });
    }
    setSpecificPurposeData(defaultValues);
    setGeneratedCopies([]); // Limpar cópias geradas ao mudar finalidade
  }, [selectedCopyPurposeKey]);

  // Efeito para resetar finalidade e campos específicos ao mudar a fase
   useEffect(() => {
    setSelectedCopyPurposeKey('');
    // setSpecificPurposeData({}); // Já é tratado pelo useEffect acima que observa selectedCopyPurposeKey
    // setGeneratedCopies([]); // Já é tratado pelo useEffect acima
  }, [selectedLaunchPhase]);


  const { data: savedCopies = [], isLoading: copiesLoading, refetch: refetchSavedCopies } = useQuery<SavedCopy[]>({
    queryKey: ['savedCopies'],
    queryFn: async () => apiRequest('GET', '/api/copies').then(res => res.json()).then(data => Array.isArray(data) ? data : []),
  });

  const generateSpecificCopyMutation = useMutation<GeneratedSpecificCopyItem[], Error, FullGeneratorPayload>({
    mutationFn: async (payload: FullGeneratorPayload) => {
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
      }));
      setGeneratedCopies(timestampedData);
      toast({ title: 'Copies Geradas!', description: `${timestampedData.length} ${timestampedData.length === 1 ? 'sugestão foi criada' : 'sugestões foram criadas'}.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao Gerar Copy', description: error.message, variant: 'destructive' });
    },
  });
  
  const saveCopyMutation = useMutation<SavedCopy, Error, Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'>>({ /* ... (mantido como na sua última versão) ... */ });
  const deleteMutation = useMutation<void, Error, string | number >({ /* ... (mantido como na sua última versão) ... */ });

  const handleBaseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBaseGeneratorFormState(prev => ({ ...prev, [name]: value }));
    rhfBaseForm.setValue(name as keyof BaseGeneratorFormState, value, { shouldValidate: true });
  };
  
  const handleBaseSelectChange = (fieldName: keyof BaseGeneratorFormState, value: string) => {
    setBaseGeneratorFormState(prev => ({ ...prev, [fieldName]: value as any }));
    rhfBaseForm.setValue(fieldName, value as any, { shouldValidate: true });
  };

  const handleCopyPurposeKeyChange = (key: string) => {
    setSelectedCopyPurposeKey(key);
    // O useEffect que observa selectedCopyPurposeKey já cuidará de resetar specificPurposeData e generatedCopies
  };

  const handleSpecificDataChange = (name: string, value: any) => {
    setSpecificPurposeData(prev => ({ ...prev, [name]: value }));
  };
  
  const validateAndSubmit = async () => {
    const baseFormValid = await rhfBaseForm.trigger(); // Valida o react-hook-form
    if (!baseFormValid) {
      toast({ title: 'Campos Base Inválidos', description: 'Verifique os campos de Produto/Serviço e Público-Alvo.', variant: 'destructive' });
      // Foca no primeiro erro do RHF
      const firstErrorField = Object.keys(rhfBaseForm.formState.errors)[0] as keyof BaseGeneratorFormState;
      if (firstErrorField) rhfBaseForm.setFocus(firstErrorField);
      return;
    }

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
        toast({ title: 'Campo Específico Obrigatório', description: `O campo "${field.label}" é obrigatório para esta finalidade.`, variant: 'destructive' });
        // Poderia focar no campo dinâmico aqui, se eles tivessem refs gerenciadas
        return;
      }
    }

    const payload: FullGeneratorPayload = {
      ...rhfBaseForm.getValues(), // Pega os valores validados do RHF
      launchPhase: selectedLaunchPhase,
      copyPurposeKey: selectedCopyPurposeKey,
      details: specificPurposeData,
    };
    generateSpecificCopyMutation.mutate(payload);
  };

  const copyToClipboard = (text?: string) => { if(text) navigator.clipboard.writeText(text).then(() => toast({title: 'Copiado!'})).catch(() => toast({title: 'Erro ao copiar', variant: 'destructive'})); };
  const handleSaveGeneratedCopy = (copyItem: GeneratedSpecificCopyResult) => { /* ... (lógica mantida, mas certifique-se que os dados correspondem a SavedCopy) ... */ };
  const handleReuseSavedCopy = (savedCopy: SavedCopy) => { /* ... (lógica mantida) ... */ };
  
  const currentPurposeDetails = useMemo(() => allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey), [selectedCopyPurposeKey]);
  const currentSpecificFields: FieldDefinition[] = useMemo(() => currentPurposeDetails?.fields || [], [currentPurposeDetails]);

  const availablePurposesForPhase = useMemo(() => {
    if (!selectedLaunchPhase) return [];
    const filtered = allCopyPurposesConfig.filter(p => p.phase === selectedLaunchPhase);
    return filtered.reduce((acc, purpose) => {
      const category = purpose.category || 'Outras Finalidades';
      if (!acc[category]) acc[category] = [];
      acc[category].push({ value: purpose.key, label: purpose.label });
      return acc;
    }, {} as Record<string, Array<{ value: string; label: string }>>);
  }, [selectedLaunchPhase]);
  const groupedPurposeOptions = Object.entries(availablePurposesForPhase);

  const filteredSavedCopies = useMemo(() => { /* ... (lógica mantida) ... */ return []; }, [savedCopies, searchTerm, filterLaunchPhase, filterCopyPurpose]);

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
            <CardDescription>Preencha os campos para que a IA crie a copy ideal para sua necessidade.</CardDescription>
          </CardHeader>
          <CardContent className="neu-card-content space-y-6">
            <FormProvider {...rhfBaseForm}> {/* Envolver com FormProvider */}
              <form onSubmit={rhfBaseForm.handleSubmit(validateAndSubmit)} className="space-y-6"> {/* Usar validateAndSubmit */}
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
                    <Select value={selectedCopyPurposeKey} onValueChange={handleCopyPurposeKeyChange} disabled={groupedPurposeOptions.length === 0}>
                        <SelectTrigger id="copy-purpose-key" disabled={!selectedLaunchPhase || groupedPurposeOptions.length === 0}>
                            <SelectValue placeholder={selectedLaunchPhase && groupedPurposeOptions.length > 0 ? "Selecione a finalidade..." : (selectedLaunchPhase ? "Nenhuma finalidade para esta fase" : "Selecione uma fase primeiro")}/>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]"> {/* Aumentado max-h */}
                        {groupedPurposeOptions.map(([category, options]) => (
                            <SelectGroup key={category}>
                                <ShadcnSelectLabel>{category}</ShadcnSelectLabel>
                                {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectGroup>
                        ))}
                        </SelectContent>
                    </Select>
                     {currentPurposeDetails && <CardDescription className="text-xs mt-1">{currentPurposeDetails.description}</CardDescription>}
                  </div>
                )}
                
                {selectedCopyPurposeKey && currentSpecificFields.length > 0 && (
                  <Card className="p-4 pt-2 bg-muted/30 dark:bg-muted/10 border-border/70 shadow-inner">
                    <CardHeader className="p-0 pb-3 mb-3 border-b">
                        <CardTitle className="text-base">3. Detalhes para: <span className="text-primary">{currentPurposeDetails?.label}</span></CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"> {/* Adicionado custom-scrollbar e padding */}
                        {currentSpecificFields.map(field => (
                        <div key={field.name} className="space-y-1.5">
                            <div className="flex items-center">
                            <Label htmlFor={`specific-${field.name}`} className="text-sm font-medium">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {field.tooltip && (
                                <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-5 w-5 ml-1.5"><Info className="w-3.5 h-3.5 text-muted-foreground" /></Button></TooltipTrigger><TooltipContent side="top" className="max-w-xs z-[100]"><p className="text-xs">{field.tooltip}</p></TooltipContent></Tooltip></TooltipProvider>
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
                 {!selectedCopyPurposeKey && selectedLaunchPhase && ( /* ... (mantido) ... */ )}

                <Button type="submit" disabled={generateSpecificCopyMutation.isPending || !selectedCopyPurposeKey} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-base py-6">
                  {generateSpecificCopyMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  Gerar Copy Avançada
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 sticky top-6 neu-card">
            {/* ... (Seção de Copies Geradas, mantida como na sua versão, com ajustes para GeneratedSpecificCopyResult) ... */}
            <CardHeader className="neu-card-header">
                <CardTitle className="neu-card-title"><Sparkles className="mr-2 text-primary"/>Copies Geradas</CardTitle>
                <CardDescription>Resultados da IA para sua finalidade.</CardDescription>
            </CardHeader>
            <CardContent className="neu-card-content">
                <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
                {generateSpecificCopyMutation.isPending && ( <div className="text-center py-10 text-primary"><Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" /> Gerando...</div> )}
                {!generateSpecificCopyMutation.isPending && generatedCopies.length === 0 && ( <div className="text-center py-10 text-muted-foreground"><Bot className="w-12 h-12 mx-auto mb-3 opacity-60" /><p>Suas copies aparecerão aqui.</p></div> )}
                {generatedCopies.map((copy, index) => {
                    const purposeLabel = allCopyPurposesConfig.find(p => p.key === copy.purposeKey)?.label || copy.purposeKey;
                    return (
                    <div key={index} className="border border-border rounded-lg p-3 bg-card hover:shadow-md transition-shadow relative">
                        <div className="flex justify-between items-center mb-1.5">
                        <Badge variant="outline" className="text-xs font-medium">{purposeLabel}</Badge>
                        <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(copy.mainCopy)} title="Copiar Principal"><CopyIcon className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveGeneratedCopy(copy)} disabled={saveCopyMutation.isPending} title="Salvar na Biblioteca"><Save className="w-3.5 h-3.5" /></Button>
                        </div>
                        </div>
                        <h5 className="font-semibold text-sm text-foreground mt-1">Texto Principal:</h5>
                        <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line p-2 bg-muted/30 dark:bg-muted/20 rounded">{copy.mainCopy}</p>
                        
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
         {/* ... (Biblioteca de Copies Salvas, como na sua versão) ... */}
      </Card>
    </div>
  );
}
