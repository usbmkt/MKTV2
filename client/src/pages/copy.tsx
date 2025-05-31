// client/src/pages/copy.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Info, // Ícone para tooltips
  ChevronDown, // Para possível Accordion
} from 'lucide-react';
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Se for usar accordion

interface Copy {
  id: number;
  title: string;
  content: string;
  type: string;
  platform?: string;
  campaignId?: number;
  createdAt: string;
  purpose?: string; // Adicionado para futura organização na biblioteca
  details?: Record<string, any>; // Adicionado para futura organização
}

interface GeneratedCopy {
  type: string; // Ex: 'headline', 'body', 'cta'
  content: string;
  platform: string; // Ex: 'facebook', 'google_ads'
  // Adicionar purpose aqui se o backend retornar
  purpose?: string;
}

interface GeneratorFormState {
  product: string;
  audience: string;
  objective: string;
  tone: string;
}

// Definições para campos dinâmicos
interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  tooltip?: string;
  defaultValue?: string | number | boolean;
}

interface CopyPurposeFields {
  [purposeKey: string]: {
    description: string;
    fields: FieldDefinition[];
  };
}

// Configuração dos campos dinâmicos por finalidade
const copyPurposeFieldsConfig: CopyPurposeFields = {
  'anuncio_evento_gratuito': {
    description: "Para promover webinars, masterclasses, lives, desafios gratuitos, etc.",
    fields: [
      { name: 'eventName', label: 'Nome do Evento Gratuito', type: 'text', placeholder: 'Ex: Masterclass Orçamento Descomplicado', required: true, tooltip: 'O nome principal do seu webinar, live, desafio, etc.' },
      { name: 'eventFormat', label: 'Formato do Evento', type: 'text', placeholder: 'Ex: 3 aulas ao vivo pelo YouTube', tooltip: 'Como o evento será conduzido?' },
      { name: 'eventDateTime', label: 'Datas e Horários', type: 'text', placeholder: 'Ex: Dias 10, 11 e 12 de Agosto, às 20h', tooltip: 'Quando o evento acontecerá?' },
      { name: 'eventPromise', label: 'Promessa Principal', type: 'textarea', placeholder: 'Ex: Descubra como controlar suas finanças e começar a investir...', required: true, tooltip: 'O que a pessoa vai aprender ou qual transformação ela terá participando?' },
      { name: 'eventTopics', label: 'Principais Tópicos/Benefícios (um por linha)', type: 'textarea', placeholder: 'Ex:\n- Os 3 erros que te impedem de economizar\n- O método simples para criar seu orçamento', tooltip: 'Liste os principais pontos que serão abordados.' },
      { name: 'eventTargetAudience', label: 'Público Específico do Evento', type: 'text', placeholder: 'Ex: Para quem está endividado e quer sair do vermelho', tooltip: 'Se houver um público ainda mais específico para este evento, descreva-o.' },
      { name: 'eventCTA', label: 'Call to Action para o Anúncio', type: 'text', placeholder: 'Ex: Garanta sua vaga gratuita!', tooltip: 'Qual chamada para ação você quer no anúncio do evento?' },
    ]
  },
  'email_boas_vindas': {
    description: "Para dar as boas-vindas após uma inscrição e entregar o material prometido.",
    fields: [
      { name: 'welcomeReason', label: 'Motivo da Inscrição', type: 'text', placeholder: 'Ex: Inscrição na Masterclass XPTO, Download do E-book Y', required: true, tooltip: 'Pelo que o lead se inscreveu para receber este e-mail?' },
      { name: 'deliveryItemName', label: 'Nome do Item Entregue (se houver)', type: 'text', placeholder: 'Ex: E-book Guia de Finanças', tooltip: 'Qual o nome do material ou evento?'},
      { name: 'deliveryItemLink', label: 'Link do Item a ser Entregue (se houver)', type: 'text', placeholder: 'Ex: https://linkparaevento.com ou link do PDF', tooltip: 'Se for entregar um link de acesso ou material, coloque aqui.' },
      { name: 'nextSteps', label: 'Próximos Passos para o Lead (um por linha)', type: 'textarea', placeholder: 'Ex:\n- Adicione nosso e-mail aos contatos\n- Acesse nossa comunidade no WhatsApp', tooltip: 'O que você quer que o lead faça após ler o e-mail?'  },
      { name: 'senderName', label: 'Nome do Remetente/Empresa', type: 'text', placeholder: 'Ex: João da Silva / Empresa XPTO', required: true, tooltip: 'Quem está enviando o e-mail?'},
      { name: 'extraWelcomeContent', label: 'Conteúdo Extra de Boas-vindas (opcional)', type: 'textarea', placeholder: 'Ex: Link para um artigo do blog, um vídeo curto de introdução.', tooltip: 'Algo a mais que você queira oferecer?' },
    ]
  },
  'anuncio_download_material': {
    description: "Para promover o download de e-books, checklists, planilhas, etc.",
    fields: [
        { name: 'materialName', label: 'Nome do Material Rico', type: 'text', placeholder: 'Ex: E-book "Descomplicando Investimentos"', required: true, tooltip: 'Qual o título principal do seu material?' },
        { name: 'materialType', label: 'Tipo de Material', type: 'select', options: [{value: 'ebook', label: 'E-book'}, {value: 'checklist', label: 'Checklist'}, {value: 'planilha', label: 'Planilha'}, {value: 'guia', label: 'Guia'}, {value: 'template', label: 'Template'}, {value: 'outro', label: 'Outro'}], required: true, tooltip: 'Qual é o formato do material?' },
        { name: 'materialMainBenefit', label: 'Principal Benefício do Material', type: 'textarea', placeholder: 'Ex: Aprenda a organizar suas finanças em 7 dias.', required: true, tooltip: 'Qual a maior transformação ou resultado que o material oferece?' },
        { name: 'materialTopics', label: 'O que será encontrado no material (um por linha)', type: 'textarea', placeholder: 'Ex:\n- Passo a passo para criar um orçamento\n- Dicas para economizar no dia a dia\n- Introdução a investimentos básicos', tooltip: 'Liste os principais conteúdos do material.' },
        { name: 'materialCTA', label: 'Call to Action para Download', type: 'text', placeholder: 'Ex: Baixe agora gratuitamente!', required: true, tooltip: 'Qual chamada para ação para o download?' },
    ]
  },
  // Adicionar mais finalidades aqui conforme a lista completa
  // 'anuncio_lista_espera_vip', 'post_curiosidade_antecipacao', 'titulo_pagina_captura', 
  // 'email_conteudo_valor', 'headline_pagina_vendas', 'anuncio_abertura_carrinho'
};

const copyPurposeOptions = Object.keys(copyPurposeFieldsConfig).map(key => ({
  value: key,
  label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') // Transforma 'anuncio_evento_gratuito' em 'Anuncio Evento Gratuito'
}));


export default function CopyPage() {
  const [generatorForm, setGeneratorForm] = useState<GeneratorFormState>({
    product: '', // Nome do Produto/Serviço Geral da Marca/Empresa
    audience: '', // Público-Alvo Geral da Marca/Empresa
    objective: 'sales', // Objetivo geral (pode ser sobreposto pela finalidade)
    tone: 'professional', // Tom geral
  });
  const [selectedCopyPurpose, setSelectedCopyPurpose] = useState<string>('');
  const [specificPurposeData, setSpecificPurposeData] = useState<Record<string, any>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all'); // Renomeado para evitar conflito
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: copies = [], isLoading: copiesLoading } = useQuery<Copy[]>({ /* ... (mantido) ... */ });
  // const { data: campaigns = [] } = useQuery<CampaignType[]>({ /* ... (mantido) ... */ }); // Removido se não usado na biblioteca

  const handleCopyPurposeChange = (purpose: string) => {
    setSelectedCopyPurpose(purpose);
    // Resetar e definir valores padrão para os campos da nova finalidade
    const newSpecificData: Record<string, any> = {};
    if (purpose && copyPurposeFieldsConfig[purpose]) {
      copyPurposeFieldsConfig[purpose].fields.forEach(field => {
        newSpecificData[field.name] = field.defaultValue ?? (field.type === 'textarea' || field.type === 'text' ? '' : field.type === 'number' ? 0 : '');
      });
    }
    setSpecificPurposeData(newSpecificData);
  };

  const handleSpecificDataChange = (fieldName: string, value: string | number | boolean) => {
    setSpecificPurposeData(prev => ({ ...prev, [fieldName]: value }));
  };
  
  const generateMutation = useMutation({
    mutationFn: async (data: any) // Payload agora é mais complexo
    => {
      const response = await apiRequest('POST', '/api/copies/generate', data);
      return response.json();
    },
    onSuccess: (data: GeneratedCopy[]) => {
      toast({
        title: 'Copies geradas com sucesso!',
        description: `${data.length} versões foram criadas.`,
      });
      const timestampedCopies = data.map(copy => ({
        ...copy,
        timestamp: new Date(),
      }));
      setGeneratedCopies(prev => [...timestampedCopies, ...prev]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao gerar copies',
        description: error.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const saveCopyMutation = useMutation({ /* ... (mantido, mas pode precisar adaptar o 'data' se Copy mudou) ... */ });
  const deleteMutation = useMutation({ /* ... (mantido) ... */ });

  const [generatedCopies, setGeneratedCopies] = useState<(GeneratedCopy & { timestamp: Date })[]>([]);

  const handleGenerate = async () => {
    let missingGeneralField = false;
    if (!generatorForm.product) { form.setError("product", {type: "manual", message: "Produto/Serviço geral é obrigatório."}); missingGeneralField = true; }
    if (!generatorForm.audience) { form.setError("audience", {type: "manual", message: "Público-alvo geral é obrigatório."}); missingGeneralField = true; }
    
    if (!selectedCopyPurpose) {
      toast({ title: 'Finalidade não selecionada', description: 'Por favor, selecione uma finalidade para a copy.', variant: 'destructive'});
      return;
    }

    const currentFields = copyPurposeFieldsConfig[selectedCopyPurpose]?.fields || [];
    let firstErrorField: string | null = null;
    for (const field of currentFields) {
      if (field.required && !specificPurposeData[field.name]) {
        toast({ title: 'Campo Obrigatório Faltando', description: `Por favor, preencha o campo "${field.label}".`, variant: 'destructive' });
        if (!firstErrorField) firstErrorField = field.name; // Focar no primeiro erro
         // Adicionar erro ao react-hook-form se estiver usando-o para estes campos
      }
    }
    if (firstErrorField || missingGeneralField) return;


    const payload = {
      ...generatorForm,
      copyPurpose: selectedCopyPurpose,
      details: specificPurposeData,
    };
    generateMutation.mutate(payload);
  };
  
  // Adicionar form para os campos básicos, se desejar validação neles também
  const form = useForm<GeneratorFormState>({
    defaultValues: generatorForm,
  });


  const filteredCopies = copies.filter(copy => { /* ... (mantido) ... */ });
  const getTypeConfig = (type: string) => { /* ... (mantido) ... */ return {} as any };
  const copyToClipboard = (text: string) => { /* ... (mantido) ... */ };
  const saveCopy = (generatedCopy: GeneratedCopy & { timestamp: Date }) => {  /* ... (adaptar se necessário) ... */ };
  const deleteCopy = (id: number) => { /* ... (mantido) ... */ };
  
  const currentPurposeConfig = selectedCopyPurpose ? copyPurposeFieldsConfig[selectedCopyPurpose] : null;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerador Avançado de Copy</h1>
          <p className="text-muted-foreground mt-2">
            Crie textos persuasivos e específicos com a ajuda da IA.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-6 h-6 mr-2 text-primary" />
              Configurar Geração de Copy
            </CardTitle>
            <CardDescription>Selecione a finalidade e preencha os detalhes para obter a copy perfeita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campos Básicos */}
            <Form {...form}> {/* Envolver campos básicos com Form se for usar RHF para eles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                    <FormField control={form.control} name="product" render={({ field }) => (<FormItem><FormLabel>Produto/Serviço Geral*</FormLabel><FormControl><Input placeholder="Ex: Consultoria de Marketing" {...field} onChange={e => {field.onChange(e); setGeneratorForm(prev => ({...prev, product: e.target.value}))}} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="audience" render={({ field }) => (<FormItem><FormLabel>Público-Alvo Geral*</FormLabel><FormControl><Input placeholder="Ex: Pequenos empresários" {...field} onChange={e => {field.onChange(e); setGeneratorForm(prev => ({...prev, audience: e.target.value}))}} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="objective" render={({ field }) => (<FormItem><FormLabel>Objetivo Geral</FormLabel><Select value={field.value} onValueChange={value => {field.onChange(value); setGeneratorForm(prev => ({...prev, objective: value}))}}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{objectiveOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tone" render={({ field }) => (<FormItem><FormLabel>Tom Geral</FormLabel><Select value={field.value} onValueChange={value => {field.onChange(value); setGeneratorForm(prev => ({...prev, tone: value}))}}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="inspirational">Inspiracional</SelectItem>
                        <SelectItem value="educational">Educativo</SelectItem>
                        <SelectItem value=" divertido">Divertido</SelectItem>
                        <SelectItem value="empatico">Empático</SelectItem>
                        <SelectItem value="sofisticado">Sofisticado</SelectItem>
                    </SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
            </Form>
            
            {/* Seletor de Finalidade */}
            <div className="space-y-2">
              <Label htmlFor="copy-purpose" className="text-base font-semibold">Finalidade da Copy *</Label>
              <Select value={selectedCopyPurpose} onValueChange={handleCopyPurposeChange}>
                <SelectTrigger id="copy-purpose">
                  <SelectValue placeholder="Selecione uma finalidade..." />
                </SelectTrigger>
                <SelectContent>
                  {copyPurposeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentPurposeConfig && <p className="text-xs text-muted-foreground pl-1">{currentPurposeConfig.description}</p>}
            </div>

            {/* Campos Dinâmicos Específicos */}
            {selectedCopyPurpose && currentPurposeConfig && (
              <Card className="p-4 pt-2 bg-card border shadow-inner">
                <CardHeader className="p-2 mb-2 -mx-2 -mt-2 border-b">
                    <CardTitle className="text-md">Detalhes para: {copyPurposeOptions.find(o => o.value === selectedCopyPurpose)?.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {currentPurposeConfig.fields.map(field => (
                    <div key={field.name} className="space-y-1.5">
                        <div className="flex items-center">
                        <Label htmlFor={field.name} className="text-sm font-medium text-foreground">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {field.tooltip && (
                            <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 ml-1.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{field.tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        )}
                        </div>
                        {field.type === 'textarea' ? (
                        <Textarea
                            id={field.name}
                            placeholder={field.placeholder}
                            value={specificPurposeData[field.name] || ''}
                            onChange={(e) => handleSpecificDataChange(field.name, e.target.value)}
                            rows={field.label.toLowerCase().includes('tópicos') || field.label.toLowerCase().includes('passos') ? 4 : 2}
                            required={field.required}
                        />
                        ) : field.type === 'select' ? (
                        <Select
                            value={specificPurposeData[field.name] || field.defaultValue || ''}
                            onValueChange={(value) => handleSpecificDataChange(field.name, value)}
                            required={field.required}
                        >
                            <SelectTrigger id={field.name}><SelectValue placeholder={field.placeholder || 'Selecione...'} /></SelectTrigger>
                            <SelectContent>
                            {field.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        ) : (
                        <Input
                            id={field.name}
                            type={field.type as React.HTMLInputTypeAttribute} // Cast para tipo HTML
                            placeholder={field.placeholder}
                            value={specificPurposeData[field.name] || ''}
                            onChange={(e) => handleSpecificDataChange(field.name, field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                            required={field.required}
                        />
                        )}
                    </div>
                    ))}
                </CardContent>
              </Card>
            )}
             {!selectedCopyPurpose && (
                <div className="text-center py-6 text-muted-foreground">
                    <Info className="w-8 h-8 mx-auto mb-2"/>
                    <p>Selecione uma "Finalidade da Copy" acima para ver os campos específicos e gerar uma copy mais detalhada.</p>
                </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedCopyPurpose}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Copy Avançada
            </Button>
          </CardContent>
        </Card>

        {/* Generated Copies */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Copies Geradas</CardTitle>
            <CardDescription>Resultados da IA baseados nos seus inputs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
              {generatedCopies.length === 0 && !generateMutation.isPending && (
                 <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Suas copies personalizadas aparecerão aqui após a geração.</p>
                </div>
              )}
              {generateMutation.isPending && (
                <div className="text-center py-8 text-primary">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
                  <p>Gerando suas copies...</p>
                </div>
              )}
              {generatedCopies.map((copy, index) => {
                const typeConfig = getTypeConfig(copy.type);
                return (
                  <div key={index} className="border border-border rounded-lg p-3 bg-card hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-1.5">
                      <Badge className={typeConfig.className + " text-xs"}>
                        {typeConfig.label} {copy.platform && `(${copy.platform})`}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(copy.content)} title="Copiar"><CopyIcon className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveCopy(copy)} disabled={saveCopyMutation.isPending} title="Salvar"><Save className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground mb-2 whitespace-pre-line">{copy.content}</p>
                    <p className="text-xs text-muted-foreground text-right">Gerado: {copy.timestamp.toLocaleTimeString()}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved Copies Library */}
      <Card>
        {/* ... (Biblioteca de Copies como antes, pode precisar de adaptação para mostrar 'purpose' e 'details') ... */}
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Biblioteca de Copies Salvas</CardTitle>
            {/* Filtros da biblioteca */}
          </div>
        </CardHeader>
        <CardContent>
           {copiesLoading && <div className="text-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/> Carregando biblioteca...</div>}
           {!copiesLoading && filteredCopies.length === 0 && (
             <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma copy na biblioteca</h3>
                <p>{copies.length === 0 ? 'Suas copies salvas aparecerão aqui.' : 'Nenhuma copy corresponde aos filtros atuais.'}</p>
              </div>
           )}
           {!copiesLoading && filteredCopies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Mapeamento das copies salvas */}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
