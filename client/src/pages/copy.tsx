// client/src/pages/copy.tsx
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel as ShadcnSelectLabel } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label as StandardLabel } from '@/components/ui/label'; // Renomeado para evitar conflito com Label do RHF
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';

import {
  Bot,
  Copy as CopyIcon,
  Save,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  Search,
  Info,
  RotateCcw,
  Lightbulb,
  Wand2,
} from 'lucide-react';

import { 
    allCopyPurposesConfig, 
    type CopyPurposeConfig, 
    type FieldDefinition, 
    type LaunchPhase as LaunchPhaseType // Renomeado para evitar conflito de nomeação
} from '@/config/copyConfigurations';

// Tipos específicos para esta página
export interface BaseGeneratorFormState {
  product: string;
  audience: string;
  objective: 'sales' | 'leads' | 'engagement' | 'awareness';
  tone: 'professional' | 'casual' | 'urgent' | 'inspirational' | 'educational' | 'empathetic' | 'divertido' | 'sofisticado';
}

export type SpecificPurposeData = Record<string, any>;

interface FullGeneratorPayload extends BaseGeneratorFormState {
  launchPhase: LaunchPhaseType;
  copyPurposeKey: string;
  details: SpecificPurposeData;
}

interface BackendGeneratedCopyItem { // Resposta esperada da API /api/copies/generate
  mainCopy: string;
  alternativeVariation1?: string;
  alternativeVariation2?: string;
  platformSuggestion?: string;
  notes?: string;
}

interface DisplayGeneratedCopy extends BackendGeneratedCopyItem {
  timestamp: Date;
  purposeKey: string;
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
  fullGeneratedResponse?: BackendGeneratedCopyItem;
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
  const [selectedLaunchPhase, setSelectedLaunchPhase] = useState<LaunchPhaseType | ''>('');
  const [selectedCopyPurposeKey, setSelectedCopyPurposeKey] = useState<string>('');
  const [specificPurposeData, setSpecificPurposeData] = useState<SpecificPurposeData>({});
  const [generatedCopies, setGeneratedCopies] = useState<DisplayGeneratedCopy[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLaunchPhase, setFilterLaunchPhase] = useState<LaunchPhaseType | 'all'>('all');
  const [filterCopyPurpose, setFilterCopyPurpose] = useState<string | 'all'>('all');
  
  const [contentIdeas, setContentIdeas] = useState<string[]>([]);
  const [isContentIdeasModalOpen, setIsContentIdeasModalOpen] = useState(false);
  const [optimizingCopyInfo, setOptimizingCopyInfo] = useState<{text: string; index: number} | null>(null);


  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rhfBaseForm = useForm<BaseGeneratorFormState>({
    resolver: zodResolver(baseGeneratorFormSchema),
    defaultValues: { product: '', audience: '', objective: 'sales', tone: 'professional' },
  });

  useEffect(() => {
    setSelectedCopyPurposeKey(''); // Reseta finalidade quando fase muda
  }, [selectedLaunchPhase]);

  useEffect(() => {
    const currentConfig = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey);
    const defaultValues: SpecificPurposeData = {};
    if (currentConfig) {
      currentConfig.fields.forEach(field => {
        defaultValues[field.name] = field.defaultValue ?? (field.type === 'number' ? 0 : '');
      });
    }
    setSpecificPurposeData(defaultValues);
    setGeneratedCopies([]);
  }, [selectedCopyPurposeKey]);

  const { data: savedCopiesList = [], isLoading: copiesLoading } = useQuery<SavedCopy[]>({
    queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm],
    queryFn: async () => apiRequest('GET', '/api/copies').then(res => res.json()).then(data => Array.isArray(data) ? data : []),
  });

  const generateSpecificCopyMutation = useMutation<BackendGeneratedCopyItem[], Error, FullGeneratorPayload>({
    mutationFn: async (payload) => apiRequest('POST', '/api/copies/generate', payload).then(res => res.json()),
    onSuccess: (data) => {
      if (!Array.isArray(data) || data.length === 0) {
        toast({ title: 'Nenhuma copy gerada', description: 'A IA não retornou sugestões válidas.'});
        setGeneratedCopies([]); return;
      }
      const timestampedData: DisplayGeneratedCopy[] = data.map(item => ({ ...item, timestamp: new Date(), purposeKey: selectedCopyPurposeKey }));
      setGeneratedCopies(timestampedData);
      toast({ title: 'Copies Geradas!', description: `${timestampedData.length} sugestão(ões) criada(s).` });
    },
    onError: (error: Error) => toast({ title: 'Erro ao Gerar Copy', description: error.message, variant: 'destructive' }),
  });

  const generateContentIdeasMutation = useMutation<string[], Error, { product: string; audience: string; objective: string }>({
    mutationFn: async (payload) => apiRequest('POST', '/api/copies/generate-ideas', payload).then(res => res.json().then(data => data.contentIdeas || [])),
    onSuccess: (data) => { setContentIdeas(data); setIsContentIdeasModalOpen(true); toast({ title: 'Ideias de Conteúdo Geradas!' }); },
    onError: (error: Error) => toast({ title: 'Erro ao Gerar Ideias', description: error.message, variant: 'destructive' }),
  });

  const optimizeCopyMutation = useMutation<{ optimizedCopy: string; optimizationNotes?: string }, Error, { originalCopy: string; purposeKey: string; baseForm: BaseGeneratorFormState; copyIndex: number } >({
    mutationFn: async (payload) => {
      const apiPayload = { originalCopy: payload.originalCopy, purposeKey: payload.purposeKey, baseInfo: payload.baseForm, details: specificPurposeData };
      return apiRequest('POST', '/api/copies/optimize', apiPayload).then(res => res.json());
    },
    onSuccess: (data, variables) => {
      setGeneratedCopies(prevCopies => 
        prevCopies.map((copy, index) => 
          index === variables.copyIndex 
          ? { ...copy, mainCopy: data.optimizedCopy, notes: `${copy.notes || ''}\nNota Otim.: ${data.optimizationNotes || 'Otimizada.'}`.trim() } 
          : copy 
      ));
      toast({ title: 'Copy Otimizada!', description: 'A copy selecionada foi aprimorada.' });
      setOptimizingCopyInfo(null);
    },
    onError: (error: Error) => { toast({ title: 'Erro ao Otimizar Copy', description: error.message, variant: 'destructive' }); setOptimizingCopyInfo(null); },
  });
  
  const saveCopyMutation = useMutation<SavedCopy, Error, Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'>>({ 
    mutationFn: async (dataToSave) => apiRequest('POST', '/api/copies', dataToSave).then(res => res.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm] }); toast({ title: 'Copy Salva!' }); },
    onError: (error: Error) => { toast({ title: 'Erro ao Salvar', description: error.message, variant: 'destructive' }); }
  });

  const deleteMutation = useMutation<void, Error, string | number>({ 
    mutationFn: (id) => apiRequest('DELETE', `/api/copies/${id}`).then(res => {if(!res.ok) throw new Error("Falha ao excluir")}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm] }); toast({ title: 'Copy Excluída!' }); },
    onError: (error: Error) => { toast({ title: 'Erro ao Excluir', description: error.message, variant: 'destructive' }); }
  });

  const handleSpecificDataChange = (name: string, value: any) => {
    setSpecificPurposeData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmitGeneratorForm = async (baseFormData: BaseGeneratorFormState) => {
    if (!selectedLaunchPhase) { toast({ title: 'Seleção Necessária', description: 'Selecione uma Fase do Lançamento.', variant: 'destructive' }); return; }
    if (!selectedCopyPurposeKey) { toast({ title: 'Seleção Necessária', description: 'Selecione uma Finalidade da Copy Específica.', variant: 'destructive' }); return; }
    const currentFields = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey)?.fields || [];
    for (const field of currentFields) {
      if (field.required && (!specificPurposeData[field.name] || String(specificPurposeData[field.name]).trim() === '')) {
        toast({ title: 'Campo Específico Obrigatório', description: `O campo "${field.label}" é obrigatório.`, variant: 'destructive' });
        return;
      }
    }
    const payload: FullGeneratorPayload = { ...baseFormData, launchPhase: selectedLaunchPhase, copyPurposeKey: selectedCopyPurposeKey, details: specificPurposeData };
    generateSpecificCopyMutation.mutate(payload);
  };

  const copyToClipboard = (text?: string) => { if(text) navigator.clipboard.writeText(text).then(() => toast({title: 'Copiado!'})).catch(() => toast({title: 'Erro ao copiar', variant: 'destructive'})); };
  
  const handleSaveGeneratedCopy = (copyItem: DisplayGeneratedCopy) => {
    const currentBaseFormValues = rhfBaseForm.getValues();
    const purposeConfig = allCopyPurposesConfig.find(p => p.key === copyItem.purposeKey);
    const title = `[${purposeConfig?.label || 'Copy'}] ${currentBaseFormValues.product.substring(0,20)} (${new Date().toLocaleDateString('pt-BR')})`;
    const dataToSave: Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'> = {
        title: title, content: copyItem.mainCopy, purposeKey: copyItem.purposeKey,
        launchPhase: selectedLaunchPhase as LaunchPhase, details: specificPurposeData, 
        baseInfo: currentBaseFormValues, platform: copyItem.platformSuggestion,
        fullGeneratedResponse: { mainCopy: copyItem.mainCopy, alternativeVariation1: copyItem.alternativeVariation1, alternativeVariation2: copyItem.alternativeVariation2, platformSuggestion: copyItem.platformSuggestion, notes: copyItem.notes },
    };
    saveCopyMutation.mutate(dataToSave);
  };

  const handleReuseSavedCopy = (savedCopy: SavedCopy) => { 
    rhfBaseForm.reset(savedCopy.baseInfo); 
    setSelectedLaunchPhase(savedCopy.launchPhase);
    setTimeout(() => { 
        setSelectedCopyPurposeKey(savedCopy.purposeKey); 
        setSpecificPurposeData(savedCopy.details || {}); 
        if (savedCopy.fullGeneratedResponse) {
            setGeneratedCopies([{...savedCopy.fullGeneratedResponse, timestamp: new Date(), purposeKey: savedCopy.purposeKey}]);
        } else { 
            setGeneratedCopies([{ mainCopy: savedCopy.content, platformSuggestion: savedCopy.platform, timestamp: new Date(), purposeKey: savedCopy.purposeKey }]);
        }
        toast({title: "Dados Carregados!", description: "Informações da copy salva foram carregadas no gerador."}); 
    }, 50);
  };
  
  const handleGenerateContentIdeas = () => { 
    const baseFormData = rhfBaseForm.getValues();
    if (!baseFormData.product || !baseFormData.audience) { toast({ title: 'Informação Necessária', description: 'Preencha "Produto/Serviço" e "Público-Alvo" para gerar ideias.', variant: 'destructive' }); return; } 
    generateContentIdeasMutation.mutate({ product: baseFormData.product, audience: baseFormData.audience, objective: baseFormData.objective }); 
  };

  const handleOptimizeCopy = (copyToOptimize: DisplayGeneratedCopy, index: number) => { 
    if (!selectedCopyPurposeKey) return; 
    setOptimizingCopyInfo({text: copyToOptimize.mainCopy, index});
    optimizeCopyMutation.mutate({ 
        originalCopy: copyToOptimize.mainCopy, purposeKey: selectedCopyPurposeKey, 
        baseForm: rhfBaseForm.getValues(), copyIndex: index 
    }); 
  };
  
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

  const filteredSavedCopies = useMemo(() => {
    return (savedCopiesList || []).filter(copy => {
      const searchLower = searchTerm.toLowerCase();
      const titleMatch = copy.title?.toLowerCase().includes(searchLower);
      const contentMatch = copy.content?.toLowerCase().includes(searchLower);
      const purposeLabel = allCopyPurposesConfig.find(p => p.key === copy.purposeKey)?.label.toLowerCase();
      const purposeMatch = purposeLabel?.includes(searchLower);
      const phaseFilterMatch = filterLaunchPhase === 'all' || copy.launchPhase === filterLaunchPhase;
      const purposeFilterMatch = filterCopyPurpose === 'all' || copy.purposeKey === filterCopyPurpose;
      return (titleMatch || contentMatch || purposeMatch) && phaseFilterMatch && purposeFilterMatch;
    });
  }, [savedCopiesList, searchTerm, filterLaunchPhase, filterCopyPurpose]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-background min-h-screen">
      <header className="pb-4 sm:pb-6 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gerador de Copy IA Avançado</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2">Crie textos altamente específicos para cada etapa do seu lançamento.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center text-xl"><Bot className="mr-2 text-primary" />Configurar Geração</CardTitle>
            <CardDescription>Preencha os campos para que a IA crie a copy ideal para sua necessidade.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <FormProvider {...rhfBaseForm}>
              <form onSubmit={rhfBaseForm.handleSubmit(handleSubmitGeneratorForm)} className="space-y-6">
                <Accordion type="single" collapsible defaultValue="item-base" className="w-full">
                  <AccordionItem value="item-base" className="border rounded-md shadow-sm">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline p-4 bg-muted/30 dark:bg-muted/20 rounded-t-md">
                        Informações Base (Obrigatórias)
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-3 bg-card">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={rhfBaseForm.control} name="product" render={({ field }) => (<FormItem><FormLabel>Produto/Serviço Geral*</FormLabel><FormControl><Input placeholder="Ex: Consultoria de Marketing Avançada" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="audience" render={({ field }) => (<FormItem><FormLabel>Público-Alvo Geral*</FormLabel><FormControl><Input placeholder="Ex: Empresas SaaS B2B" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="objective" render={({ field }) => (<FormItem><FormLabel>Objetivo Geral da Marca</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{objectiveOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="tone" render={({ field }) => (<FormItem><FormLabel>Tom de Voz Geral</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{toneOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={handleGenerateContentIdeas} disabled={generateContentIdeasMutation.isPending}>
                    {generateContentIdeasMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lightbulb className="mr-2 h-4 w-4"/>}
                    Gerar Ideias de Conteúdo (para Produto/Público Base)
                </Button>
            
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
                    <FormItem> {/* Usando FormItem para consistência de espaçamento com Label */}
                        <FormLabel htmlFor="launch-phase">1. Fase do Lançamento*</FormLabel>
                        <Select value={selectedLaunchPhase} onValueChange={(value: LaunchPhaseType | '') => setSelectedLaunchPhase(value)}>
                            <SelectTrigger id="launch-phase"><SelectValue placeholder="Selecione uma fase..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pre_launch">Pré-Lançamento</SelectItem>
                                <SelectItem value="launch">Lançamento</SelectItem>
                                <SelectItem value="post_launch">Pós-Lançamento</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>

                    <FormItem>
                        <FormLabel htmlFor="copy-purpose-key">2. Finalidade da Copy Específica*</FormLabel>
                        <Select value={selectedCopyPurposeKey} onValueChange={handleCopyPurposeKeyChange} disabled={!selectedLaunchPhase || groupedPurposeOptions.length === 0}>
                            <SelectTrigger id="copy-purpose-key" disabled={!selectedLaunchPhase || groupedPurposeOptions.length === 0}>
                                <SelectValue placeholder={selectedLaunchPhase && groupedPurposeOptions.length > 0 ? "Selecione a finalidade..." : (selectedLaunchPhase ? "Nenhuma finalidade para esta fase" : "Selecione uma fase primeiro")}/>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                            {groupedPurposeOptions.map(([category, options]) => (
                                <SelectGroup key={category}>
                                    <ShadcnSelectLabel>{category}</ShadcnSelectLabel>
                                    {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                </SelectGroup>
                            ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                </div>
                {currentPurposeDetails && <CardDescription className="text-xs mt-1 px-1">{currentPurposeDetails.description}</CardDescription>}
                
                {selectedCopyPurposeKey && currentSpecificFields.length > 0 && (
                  <Card className="p-4 pt-2 bg-muted/30 dark:bg-muted/10 border-border/70 shadow-inner mt-4">
                    <CardHeader className="p-0 pb-3 mb-3 border-b">
                        <CardTitle className="text-base">3. Detalhes para: <span className="text-primary">{currentPurposeDetails?.label}</span></CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                        {currentSpecificFields.map(fieldDef => (
                        <FormItem key={fieldDef.name} className="space-y-1.5">
                            <div className="flex items-center">
                            <FormLabel htmlFor={`specific-${fieldDef.name}`}>
                                {fieldDef.label} {fieldDef.required && <span className="text-destructive">*</span>}
                            </FormLabel>
                            {fieldDef.tooltip && (
                                <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-5 w-5 ml-1.5"><Info className="w-3.5 h-3.5 text-muted-foreground" /></Button></TooltipTrigger><TooltipContent side="top" className="max-w-xs z-[100]"><p className="text-xs">{fieldDef.tooltip}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            </div>
                            {fieldDef.type === 'textarea' ? (
                            <FormControl><Textarea id={`specific-${fieldDef.name}`} placeholder={fieldDef.placeholder} value={specificPurposeData[fieldDef.name] || ''} onChange={(e) => handleSpecificDataChange(fieldDef.name, e.target.value)} rows={fieldDef.label.toLowerCase().includes('tópicos') || fieldDef.label.toLowerCase().includes('passos') || fieldDef.label.toLowerCase().includes('conteúdo') ? 4 : 2} required={fieldDef.required} className="bg-background"/></FormControl>
                            ) : fieldDef.type === 'select' ? (
                            <Select value={specificPurposeData[fieldDef.name] || fieldDef.defaultValue || ''} onValueChange={(value) => handleSpecificDataChange(fieldDef.name, value)} required={fieldDef.required}>
                                <FormControl><SelectTrigger id={`specific-${fieldDef.name}`} className="bg-background"><SelectValue placeholder={fieldDef.placeholder || 'Selecione...'} /></SelectTrigger></FormControl>
                                <SelectContent>{fieldDef.options?.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                            </Select>
                            ) : (
                            <FormControl><Input id={`specific-${fieldDef.name}`} type={fieldDef.type as React.HTMLInputTypeAttribute} placeholder={fieldDef.placeholder} value={specificPurposeData[fieldDef.name] || ''} onChange={(e) => handleSpecificDataChange(fieldDef.name, fieldDef.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} required={fieldDef.required} className="bg-background"/></FormControl>
                            )}
                            {/* <FormMessage /> AQUI para erros de campos específicos se integrados ao RHF */}
                        </FormItem>
                        ))}
                    </CardContent>
                  </Card>
                )}
                 {!selectedCopyPurposeKey && selectedLaunchPhase && ( <div className="text-center py-6 text-muted-foreground border rounded-md bg-muted/20"><Info className="w-8 h-8 mx-auto mb-2 opacity-70"/><p>Selecione uma "Finalidade da Copy" para fornecer os detalhes.</p></div> )}

                <Button type="submit" disabled={generateSpecificCopyMutation.isPending || !selectedCopyPurposeKey} className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white text-base py-3 shadow-lg mt-6">
                  {generateSpecificCopyMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  Gerar Copy Avançada
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 sticky top-6 shadow-lg rounded-xl">
            <CardHeader className="border-b">
                <CardTitle className="flex items-center text-xl"><Sparkles className="mr-2 text-primary"/>Copies Geradas</CardTitle>
                <CardDescription>Resultados da IA para sua finalidade.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                {generateSpecificCopyMutation.isPending && ( <div className="text-center py-10 text-primary"><Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" /> Gerando...</div> )}
                {!generateSpecificCopyMutation.isPending && generatedCopies.length === 0 && ( <div className="text-center py-10 text-muted-foreground"><Bot className="w-12 h-12 mx-auto mb-3 opacity-60" /><p>Suas copies personalizadas aparecerão aqui.</p></div> )}
                {generatedCopies.map((copy, index) => {
                    const purposeConfig = allCopyPurposesConfig.find(p => p.key === copy.purposeKey);
                    return (
                    <Card key={index} className="bg-card hover:shadow-md transition-shadow relative">
                        <CardContent className="p-3">
                            <div className="flex justify-between items-center mb-1.5">
                            <Badge variant="outline" className="text-xs font-medium">{purposeConfig?.label || copy.purposeKey}</Badge>
                            <div className="flex space-x-0.5">
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(copy.mainCopy)}><CopyIcon className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent><p>Copiar Principal</p></TooltipContent></Tooltip></TooltipProvider>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOptimizeCopy(copy, index)} disabled={optimizingCopyInfo?.index === index || optimizeCopyMutation.isPending}><Wand2 className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent><p>Otimizar com IA</p></TooltipContent></Tooltip></TooltipProvider>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveGeneratedCopy(copy)} disabled={saveCopyMutation.isPending}><Save className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent><p>Salvar na Biblioteca</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                            </div>
                            <StandardLabel className="font-semibold text-sm text-foreground mt-1 block">Texto Principal:</StandardLabel>
                            <Textarea value={copy.mainCopy} readOnly rows={Math.min(10, (copy.mainCopy?.split('\n').length || 1) +1 )} className="text-sm text-muted-foreground whitespace-pre-line p-2 bg-muted/30 dark:bg-muted/20 rounded h-auto mt-1"/>
                            
                            {copy.alternativeVariation1 && (<details className="text-xs my-2"><summary className="cursor-pointer text-muted-foreground hover:text-primary font-medium py-1">Ver Variação 1</summary><Textarea value={copy.alternativeVariation1} readOnly rows={3} className="mt-1 p-2 bg-muted/30 dark:bg-muted/20 rounded whitespace-pre-line text-muted-foreground h-auto text-xs"/></details>)}
                            {copy.alternativeVariation2 && (<details className="text-xs my-2"><summary className="cursor-pointer text-muted-foreground hover:text-primary font-medium py-1">Ver Variação 2</summary><Textarea value={copy.alternativeVariation2} readOnly rows={3} className="mt-1 p-2 bg-muted/30 dark:bg-muted/20 rounded whitespace-pre-line text-muted-foreground h-auto text-xs"/></details>)}
                            
                            {copy.platformSuggestion && <p className="text-xs text-muted-foreground mt-2">Plataforma Sugerida: <Badge variant="secondary" className="text-xs">{copy.platformSuggestion}</Badge></p>}
                            {copy.notes && <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 italic">Nota da IA: {copy.notes}</p>}
                            <p className="text-xs text-muted-foreground/70 text-right mt-1.5">Gerado: {copy.timestamp.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                        </CardContent>
                    </Card>
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
            <div className="relative flex-grow"><Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Buscar na biblioteca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-sm" /></div>
            <Select value={filterLaunchPhase} onValueChange={(v) => setFilterLaunchPhase(v as LaunchPhaseType | 'all')}>
                <SelectTrigger className="text-sm w-full sm:w-auto"><SelectValue placeholder="Filtrar Fase..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas as Fases</SelectItem><SelectItem value="pre_launch">Pré-Lançamento</SelectItem><SelectItem value="launch">Lançamento</SelectItem><SelectItem value="post_launch">Pós-Lançamento</SelectItem></SelectContent>
            </Select>
            <Select value={filterCopyPurpose} onValueChange={(v) => setFilterCopyPurpose(v as string | 'all')}>
                <SelectTrigger className="text-sm w-full sm:w-auto"><SelectValue placeholder="Filtrar Finalidade..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                    <SelectItem value="all">Todas Finalidades</SelectItem>
                    {allCopyPurposesConfig.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="neu-card-content">
          {copiesLoading && <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto"/> Carregando...</div>}
          {!copiesLoading && filteredSavedCopies.length === 0 && (
             <div className="text-center py-12 text-muted-foreground"><FileText className="w-16 h-16 mx-auto mb-4 opacity-50" /><h3 className="text-lg font-semibold mb-2">Nenhuma copy encontrada.</h3><p>{(savedCopiesList || []).length === 0 ? 'Suas copies salvas aparecerão aqui.' : 'Ajuste os filtros.'}</p></div>
           )}
           {!copiesLoading && filteredSavedCopies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSavedCopies.map((copy) => (
                <Card key={copy.id} className="neu-card flex flex-col hover:shadow-lg transition-shadow duration-200">
                  {/* ... (Conteúdo do Card da biblioteca, como na sua versão) ... */}
                </Card>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

      <Dialog open={isContentIdeasModalOpen} onOpenChange={setIsContentIdeasModalOpen}>
        <DialogContent className="sm:max-w-md neu-card p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center text-lg"><Lightbulb className="mr-2 text-yellow-400"/>Ideias de Conteúdo Geradas</DialogTitle>
            <DialogDescription className="text-xs">Use como inspiração para seus próximos posts ou copies.</DialogDescription>
          </DialogHeader>
          <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {generateContentIdeasMutation.isPending && <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> Gerando ideias...</div>}
            {generateContentIdeasMutation.isError && <div className="text-destructive">Ocorreu um erro: {(generateContentIdeasMutation.error as Error).message}</div>}
            {contentIdeas.length > 0 && !generateContentIdeasMutation.isPending && (
              <ul className="list-disc pl-5 space-y-2 mt-2 text-sm">
                {contentIdeas.map((idea, index) => ( <li key={index}>{idea}</li> ))}
              </ul>
            )}
            {contentIdeas.length === 0 && !generateContentIdeasMutation.isPending && !generateContentIdeasMutation.isError && (
              <p className="text-muted-foreground">Nenhuma ideia foi gerada. Tente refinar.</p>
            )}
          </div>
          <DialogFooter className="p-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsContentIdeasModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
