// client/src/pages/copy.tsx
'use client';

import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form'; // FormProvider para o form base
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Componentes SHADCN/UI REAIS
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel as ShadcnSelectLabel, // Renomeado para evitar conflito com HTML Label
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; // Label padrão do shadcn
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Ícones LUCIDE-REACT REAIS
import {
  Bot,
  Copy as CopyIcon,
  Save,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  Search as SearchIcon, // Renomeado para evitar conflito com componente Search se houver
  Info as InfoIcon,   // Renomeado para evitar conflito
  RotateCcw,
  Lightbulb,
  Wand2,
  Plus,
  Edit,
  MessageCircle, // Para modal de ideias
  ChevronDown, // Para Selects/Accordions (usado internamente por shadcn)
  ChevronUp,   // Para Selects/Accordions (usado internamente por shadcn)
  Filter as FilterIconLucide, // Para filtros
  BarChart3, // Para métricas/analytics
  Target, // Para objetivos
  DollarSign as DollarSignIcon, // Para orçamento
  CalendarDays, // Para datas
  ExternalLink, // Para links externos
  AlertTriangle, // Para alertas de erro
} from 'lucide-react';

// Hooks e Utils do SEU projeto
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api'; // SUA FUNÇÃO DE API REAL

// Configurações e Tipos (do arquivo dedicado)
// **IMPORTANTE**: Mova estas definições para @/config/copyConfigurations.ts
// e importe-as aqui. Por ora, estão inline para este exemplo ser autocontido.

export type LaunchPhase = 'pre_launch' | 'launch' | 'post_launch';

export interface BaseGeneratorFormState {
  product: string;
  audience: string;
  objective: 'sales' | 'leads' | 'engagement' | 'awareness';
  tone: 'professional' | 'casual' | 'urgent' | 'inspirational' | 'educational' | 'empathetic' | 'divertido' | 'sofisticado';
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date';
  placeholder?: string;
  tooltip: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
  dependsOn?: string;
  showIf?: (formData: Record<string, any>, baseData?: BaseGeneratorFormState) => boolean;
}

export interface CopyPurposeConfig {
  key: string;
  label: string;
  phase: LaunchPhase;
  fields: FieldDefinition[];
  category: string;
  description?: string; // Adicionado para descrição da finalidade
  promptEnhancer?: (basePrompt: string, details: Record<string, any>, baseForm: BaseGeneratorFormState) => string;
}

export type SpecificPurposeData = Record<string, any>;

export interface FullGeneratorPayload extends BaseGeneratorFormState {
  launchPhase: LaunchPhase;
  copyPurposeKey: string;
  details: SpecificPurposeData;
}

export interface BackendGeneratedCopyItem {
  mainCopy: string;
  alternativeVariation1?: string;
  alternativeVariation2?: string;
  platformSuggestion?: string;
  notes?: string;
}

export interface DisplayGeneratedCopy extends BackendGeneratedCopyItem {
  timestamp: Date;
  purposeKey: string;
}

export interface SavedCopy {
  id: string | number; // Drizzle usa number para serial, mas API pode retornar string
  title: string;
  content: string; 
  purposeKey: string;
  launchPhase: LaunchPhase;
  details: SpecificPurposeData;
  baseInfo: BaseGeneratorFormState;
  platform?: string;
  campaignId?: number | null; // Ajustado para ser compatível com o schema
  createdAt: string;
  lastUpdatedAt?: string; // Adicionado opcionalmente
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

// **IMPORTANTE**: Esta é uma versão abreviada. Cole sua configuração COMPLETA aqui ou importe-a.
const allCopyPurposesConfig: CopyPurposeConfig[] = [
  { key: 'prelaunch_ad_event_invitation', label: 'Anúncio: Convite para Evento Online Gratuito', phase: 'pre_launch', category: 'Anúncios (Pré-Lançamento)', description: 'Crie anúncios chamativos para convidar pessoas para seu webinar, masterclass ou live.', fields: [ { name: 'eventName', label: 'Nome do Evento *', type: 'text', placeholder: 'Ex: Masterclass "Decole Seu Negócio Online"', tooltip: 'O título principal do seu evento.', required: true }, { name: 'eventSubtitle', label: 'Subtítulo do Evento (Opcional)', type: 'text', placeholder: 'Ex: O guia definitivo para...', tooltip: 'Uma frase curta para complementar o nome.'}, { name: 'eventFormat', label: 'Formato do Evento', type: 'text', placeholder: 'Ex: Workshop online de 3 dias via Zoom', tooltip: 'Descreva como será o evento.', defaultValue: 'Webinar Ao Vivo' }, { name: 'eventDateTime', label: 'Data e Hora Principal *', type: 'text', placeholder: 'Ex: Terça, 25 de Junho, às 20h', tooltip: 'Quando o evento principal acontecerá?', required: true }, { name: 'eventDuration', label: 'Duração Estimada', type: 'text', placeholder: 'Ex: Aproximadamente 1h30', tooltip: 'Quanto tempo o público deve reservar?' }, { name: 'eventPromise', label: 'Principal Promessa *', type: 'textarea', placeholder: 'Ex: Descubra o método para criar anúncios que vendem.', tooltip: 'O que a pessoa vai ganhar/aprender?', required: true }, { name: 'eventTopics', label: 'Principais Tópicos (1 por linha) *', type: 'textarea', placeholder: 'Ex:\n- Como definir seu público\n- Erros comuns em anúncios', tooltip: 'Liste os pontos chave.', required: true }, { name: 'eventTargetAudience', label: 'Público Específico do Evento', type: 'text', placeholder: 'Ex: Empreendedores iniciantes', tooltip: 'Para quem este evento é desenhado?' }, { name: 'eventCTA', label: 'Chamada para Ação *', type: 'text', placeholder: 'Ex: "Garanta sua vaga gratuita!"', tooltip: 'O que você quer que a pessoa faça?', required: true, defaultValue: 'Inscreva-se Gratuitamente!' }, { name: 'urgencyScarcityElement', label: 'Urgência/Escassez (Opcional)', type: 'text', placeholder: 'Ex: Vagas limitadas', tooltip: 'Algum motivo para agir rápido?' }, ] },
  { key: 'prelaunch_email_welcome_confirmation', label: 'E-mail: Boas-vindas e Confirmação', phase: 'pre_launch', category: 'E-mails (Pré-Lançamento)', description: 'Envie um e-mail de boas-vindas caloroso e confirme a inscrição do lead.', fields: [ { name: 'signupReason', label: 'Motivo da Inscrição *', type: 'text', placeholder: 'Ex: Inscrição na Masterclass XPTO', tooltip: 'O que o lead fez para entrar na sua lista?', required: true }, { name: 'deliveredItemName', label: 'Nome do Item Entregue', type: 'text', placeholder: 'Ex: Acesso à Masterclass', tooltip: 'Nome do evento/material entregue.'}, { name: 'deliveredItemLink', label: 'Link de Acesso/Download', type: 'text', placeholder: 'Ex: https://...', tooltip: 'Link direto para o item.'}, { name: 'senderName', label: 'Nome do Remetente *', type: 'text', placeholder: 'Ex: João Silva da Empresa XPTO', tooltip: 'Como você/sua empresa se identificam?', required: true }, { name: 'nextStepsForLead', label: 'Próximos Passos (1 por linha)', type: 'textarea', placeholder: 'Ex:\n- Adicione este e-mail aos contatos.\n- Siga-nos no Instagram', tooltip: 'O que o lead deve fazer em seguida?'}, { name: 'valueTeaser', label: 'Teaser de Conteúdo Futuro (Opcional)', type: 'textarea', placeholder: 'Ex: Nos próximos dias, vou compartilhar dicas sobre X...', tooltip: 'Amostra do que esperar.'}, ] },
  // ... (COLE AQUI O RESTANTE DA SUA CONFIGURAÇÃO `allCopyPurposesConfig` COMPLETA)
];

const aiResponseSchema = { type: "OBJECT", properties: { mainCopy: { type: "STRING" }, alternativeVariation1: { type: "STRING" }, alternativeVariation2: { type: "STRING" }, platformSuggestion: { type: "STRING" }, notes: { type: "STRING" } }, required: ["mainCopy", "platformSuggestion"] };
const contentIdeasResponseSchema = { type: "OBJECT", properties: { contentIdeas: { type: "ARRAY", items: { "type": "STRING" } } }, required: ["contentIdeas"] };
const optimizeCopyResponseSchema = { type: "OBJECT", properties: { optimizedCopy: { type: "STRING" }, optimizationNotes: { type: "STRING" } }, required: ["optimizedCopy"] };

// --- Estilos Dark Neomórficos (constantes de string para classes Tailwind) ---
// Estas são aplicadas no JSX. As variáveis CSS correspondentes devem estar no seu index.css
const neoBgMainClass = 'bg-background'; // Usará a cor de fundo do tema (definida no index.css)
const neoTextPrimaryClass = 'text-foreground';
const neoTextSecondaryClass = 'text-muted-foreground';

// --- Início do Componente ---
export default function CopyPage() {
  const rhfBaseForm = useForm<BaseGeneratorFormState>({
    resolver: zodResolver(baseGeneratorFormSchema),
    defaultValues: { product: '', audience: '', objective: 'sales', tone: 'professional' },
  });

  const [selectedLaunchPhase, setSelectedLaunchPhase] = useState<LaunchPhase | ''>('');
  const [selectedCopyPurposeKey, setSelectedCopyPurposeKey] = useState<string>('');
  const [specificPurposeData, setSpecificPurposeData] = useState<SpecificPurposeData>({});
  const [generatedCopies, setGeneratedCopies] = useState<DisplayGeneratedCopy[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLaunchPhase, setFilterLaunchPhase] = useState<LaunchPhase | 'all'>('all');
  const [filterCopyPurpose, setFilterCopyPurpose] = useState<string | 'all'>('all');
  
  const [contentIdeas, setContentIdeas] = useState<string[]>([]);
  const [isContentIdeasModalOpen, setIsContentIdeasModalOpen] = useState(false);
  const [optimizingCopy, setOptimizingCopy] = useState<{text: string; index: number} | null>(null);


  const queryClient = useQueryClient();
  const { toast } = useToast(); // Hook real do seu projeto

  useEffect(() => {
    setSelectedCopyPurposeKey('');
    // Não resetar specificPurposeData aqui, o próximo useEffect cuidará disso com base em selectedCopyPurposeKey
  }, [selectedLaunchPhase]);

  useEffect(() => {
    const currentConfig = allCopyPurposesConfig.find(p => p.key === selectedCopyPurposeKey);
    const defaultValues: SpecificPurposeData = {};
    if (currentConfig) {
      currentConfig.fields.forEach(field => {
        if (field.defaultValue !== undefined) { // Checar se defaultValue existe
          defaultValues[field.name] = field.defaultValue;
        } else {
          // Para evitar uncontrolled -> controlled, inicializar com string vazia ou valor apropriado
          defaultValues[field.name] = field.type === 'number' ? '' : field.type === 'select' && field.options && field.options.length > 0 ? field.options[0].value : '';
        }
      });
    }
    setSpecificPurposeData(defaultValues);
    setGeneratedCopies([]); // Limpar cópias geradas ao mudar finalidade
  }, [selectedCopyPurposeKey]);

  const { data: savedCopiesList = [], isLoading: isSavedCopiesLoading, refetch: refetchSavedCopies } = useQuery<SavedCopy[]>({
    queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm], // Chave mais específica
    queryFn: async () => {
        // Adapte este endpoint e parâmetros conforme sua API de listagem de copies
        const params = new URLSearchParams();
        if (filterLaunchPhase !== 'all') params.append('phase', filterLaunchPhase);
        if (filterCopyPurpose !== 'all') params.append('purpose', filterCopyPurpose);
        if (searchTerm) params.append('search', searchTerm);
        
        const response = await apiRequest('GET', `/api/copies?${params.toString()}`); 
        if (!response.ok) throw new Error('Falha ao buscar copies salvas');
        return (await response.json()) || [];
    },
  });

  // MUTATION: Gerar Copy Específica
  const generateSpecificCopyMutation = useMutation<BackendGeneratedCopyItem[], Error, FullGeneratorPayload>({
    mutationFn: async (payload) => { 
        const currentPurposeConfig = allCopyPurposesConfig.find(p => p.key === payload.copyPurposeKey);
        if (!currentPurposeConfig) throw new Error("Configuração da finalidade da copy não encontrada.");
        
        const launchPhaseLabel = 
            payload.launchPhase === 'pre_launch' ? 'Pré-Lançamento' :
            payload.launchPhase === 'launch' ? 'Lançamento' :
            payload.launchPhase === 'post_launch' ? 'Pós-Lançamento' : 'Fase Desconhecida';

        // Construção do Prompt para a API Gemini
        let prompt = `Contexto da IA: Você é um Copywriter Mestre, especialista em criar textos persuasivos e altamente eficazes para lançamentos digitais no mercado brasileiro. Sua linguagem deve ser adaptada ao tom solicitado.

---
INFORMAÇÕES BASE PARA ESTA COPY:
- Produto/Serviço Principal: "${payload.product}"
- Público-Alvo Principal: "${payload.audience}"
- Objetivo Geral da Campanha: "${payload.objective}"
- Tom da Mensagem Desejado: "${payload.tone}"
- Fase Atual do Lançamento: "${launchPhaseLabel}"

---
FINALIDADE ESPECÍFICA DESTA COPY:
- Nome da Finalidade: "${currentPurposeConfig.label}"
- Categoria: "${currentPurposeConfig.category}"
${currentPurposeConfig.description ? `- Descrição da Finalidade: "${currentPurposeConfig.description}"\n` : ''}
---
DETALHES ESPECÍFICOS FORNECIDOS PARA ESTA FINALIDADE:
${Object.entries(payload.details).map(([key, value]) => {
  const fieldConfig = currentPurposeConfig.fields.find(f => f.name === key);
  return `- ${fieldConfig?.label || key}: ${value || '(Não informado)'}`;
}).join('\n')}

---
TAREFA:
Com base em TODAS as informações acima, gere os seguintes textos para a finalidade "${currentPurposeConfig.label}".
Responda OBRIGATORIAMENTE em formato JSON VÁLIDO, seguindo o schema abaixo.

Observações importantes para sua geração:
- Incorpore os "Detalhes Específicos" de forma inteligente e natural na "mainCopy".
- Se um detalhe crucial não foi informado, use seu conhecimento para criar a melhor copy possível, talvez sugerindo que o usuário complete essa informação.
- Seja direto, claro e use gatilhos mentais apropriados para o objetivo e público.
- Para anúncios, pense em limite de caracteres se a plataforma for sugerida (ex: Título Google Ads).
- Para e-mails, estruture com parágrafos curtos e uma chamada para ação clara.
`;
        if (currentPurposeConfig.promptEnhancer) {
          prompt = currentPurposeConfig.promptEnhancer(prompt, payload.details, payload);
        }
        
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const apiPayloadToGemini = { 
            contents: chatHistory, 
            generationConfig: { responseMimeType: "application/json", responseSchema: aiResponseSchema }
        };
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Chave da API Gemini não configurada no frontend.");

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        // Esta chamada DEVE ser movida para o backend em produção
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiPayloadToGemini) });
        
        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({error: {message: `Erro ${response.status} na API Gemini.`}})); 
            throw new Error(`Erro da IA: ${errorData?.error?.message || response.statusText}`); 
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            const generatedData = JSON.parse(result.candidates[0].content.parts[0].text) as BackendGeneratedCopyItem;
            // A API Gemini (com schema) retorna um objeto, não um array. Adaptar para retornar array com um item.
            return [generatedData]; 
        }
        throw new Error("Resposta inesperada da API Gemini.");
    },
    onSuccess: (data) => { 
      if (!Array.isArray(data) || data.length === 0) {
        toast({ title: 'Nenhuma copy gerada', description: 'A IA não retornou sugestões desta vez.', variant: 'default' });
        setGeneratedCopies([]);
        return;
      }
      const timestampedData: DisplayGeneratedCopy[] = data.map(item => ({
        ...item,
        timestamp: new Date(),
        purposeKey: selectedCopyPurposeKey,
      }));
      setGeneratedCopies(timestampedData); 
      toast({ title: 'Copies Geradas!', description: `${timestampedData.length} sugestão(ões) criada(s).` }); 
    },
    onError: (error: Error) => { toast({ title: 'Erro ao Gerar Copy', description: error.message, variant: 'destructive' }); },
  });

  const generateContentIdeasMutation = useMutation<string[], Error, { product: string; audience: string; objective: string }>({
    mutationFn: async (payload) => {
      const prompt = `Dado o produto "${payload.product}" e o público-alvo "${payload.audience}", gere uma lista de 5 ideias concisas para posts de blog ou redes sociais que seriam relevantes e engajadoras para este público, focando no objetivo de "${payload.objective}". Retorne as ideias como um array de strings em JSON.`;
      let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const apiPayloadToGemini = { contents: chatHistory, generationConfig: { responseMimeType: "application/json", responseSchema: contentIdeasResponseSchema }};
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave da API Gemini não configurada.");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiPayloadToGemini) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({error: {message: 'Erro API Gemini'}})); throw new Error(`Erro da IA: ${errorData?.error?.message || response.statusText}`); }
      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]) {
        const parsedResult = JSON.parse(result.candidates[0].content.parts[0].text);
        return parsedResult.contentIdeas || [];
      }
      throw new Error("Resposta inesperada da IA para ideias de conteúdo.");
    },
    onSuccess: (data) => { setContentIdeas(data); setIsContentIdeasModalOpen(true); toast({ title: 'Ideias de Conteúdo Geradas!' }); },
    onError: (error: Error) => { toast({ title: 'Erro ao Gerar Ideias', description: error.message, variant: 'destructive' }); },
  });

  const optimizeCopyMutation = useMutation<{ optimizedCopy: string; optimizationNotes?: string }, Error, { originalCopy: string; purposeKey: string; baseForm: BaseGeneratorFormState; copyIndex: number } >({
    mutationFn: async (payload) => {
      const purposeConfig = allCopyPurposesConfig.find(p => p.key === payload.purposeKey);
      const prompt = `Analise e otimize a seguinte copy, originalmente criada para a finalidade de "${purposeConfig?.label || 'desconhecida'}" com o objetivo de "${payload.baseForm.objective}" e tom "${payload.baseForm.tone}". A copy é: '${payload.originalCopy}'. Retorne uma versão otimizada e, opcionalmente, uma breve nota sobre as mudanças feitas. Responda em JSON com os campos "optimizedCopy" (string) e "optimizationNotes" (string, opcional).`;
      let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const apiPayloadToGemini = { contents: chatHistory, generationConfig: { responseMimeType: "application/json", responseSchema: optimizeCopyResponseSchema }};
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave da API Gemini não configurada.");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiPayloadToGemini) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({error: {message: 'Erro API Gemini'}})); throw new Error(`Erro da IA: ${errorData?.error?.message || response.statusText}`); }
      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]) {
        return JSON.parse(result.candidates[0].content.parts[0].text);
      }
      throw new Error("Resposta inesperada da IA para otimização.");
    },
    onSuccess: (data, variables) => {
      setGeneratedCopies(prevCopies => 
        prevCopies.map((copy, index) => 
          index === variables.copyIndex 
          ? { ...copy, mainCopy: data.optimizedCopy, notes: `${copy.notes || ''}\nNota Otim.: ${data.optimizationNotes || 'Otimizada.'}`.trim() } 
          : copy 
      ));
      toast({ title: 'Copy Otimizada!', description: 'A copy selecionada foi aprimorada pela IA.' });
      setOptimizingCopy(null);
    },
    onError: (error: Error) => { toast({ title: 'Erro ao Otimizar Copy', description: error.message, variant: 'destructive' }); setOptimizingCopy(null); },
  });
  
  const saveCopyMutation = useMutation<SavedCopy, Error, Omit<SavedCopy, 'id' | 'createdAt' | 'lastUpdatedAt'>>({ 
    mutationFn: async (dataToSave) => { 
      // Usar a apiRequest do seu projeto, que já deve incluir o token de autenticação
      const response = await apiRequest('POST', '/api/copies', dataToSave); 
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao salvar copy no backend' }));
        throw new Error(errorData.error || errorData.message || 'Erro desconhecido ao salvar copy');
      }
      return response.json(); 
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm] }); 
      toast({ title: 'Copy Salva!', description: 'Sua copy foi salva na biblioteca.' }); 
    },
    onError: (error: Error) => { toast({ title: 'Erro ao Salvar', description: error.message, variant: 'destructive' }); }
  });

  const deleteMutation = useMutation<void, Error, string | number>({ 
    mutationFn: async (id) => { 
      const response = await apiRequest('DELETE', `/api/copies/${id}`); 
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao excluir copy no backend' }));
        throw new Error(errorData.error || errorData.message || 'Erro desconhecido ao excluir copy');
      }
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['savedCopies', filterLaunchPhase, filterCopyPurpose, searchTerm] }); 
      toast({ title: 'Copy Excluída!' }); 
    },
    onError: (error: Error) => { toast({ title: 'Erro ao Excluir', description: error.message, variant: 'destructive' }); }
  });

  const handleSpecificDataChange = (name: string, value: any) => {
    setSpecificPurposeData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmitBaseFormAndGenerate = async (baseFormData: BaseGeneratorFormState) => {
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
        title: title,
        content: copyItem.mainCopy,
        purposeKey: copyItem.purposeKey,
        launchPhase: selectedLaunchPhase as LaunchPhase,
        details: specificPurposeData, 
        baseInfo: currentBaseFormValues, 
        platform: copyItem.platformSuggestion,
        fullGeneratedResponse: { 
            mainCopy: copyItem.mainCopy,
            alternativeVariation1: copyItem.alternativeVariation1,
            alternativeVariation2: copyItem.alternativeVariation2,
            platformSuggestion: copyItem.platformSuggestion,
            notes: copyItem.notes
        },
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
    }, 50); // Pequeno delay para garantir que a fase seja setada antes da finalidade
  };
  
  const handleGenerateContentIdeas = () => { 
    const baseFormData = rhfBaseForm.getValues();
    if (!baseFormData.product || !baseFormData.audience) { toast({ title: 'Informação Necessária', description: 'Preencha "Produto/Serviço" e "Público-Alvo" (nos campos base) para gerar ideias.', variant: 'destructive' }); return; } 
    generateContentIdeasMutation.mutate({ product: baseFormData.product, audience: baseFormData.audience, objective: baseFormData.objective }); 
  };

  const handleOptimizeCopy = (copyToOptimize: DisplayGeneratedCopy, index: number) => { 
    if (!selectedCopyPurposeKey) return; 
    setOptimizingCopy({text: copyToOptimize.mainCopy, index});
    optimizeCopyMutation.mutate({ 
        originalCopy: copyToOptimize.mainCopy, 
        purposeKey: selectedCopyPurposeKey, 
        baseForm: rhfBaseForm.getValues(), 
        copyIndex: index 
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

  // Função para lidar com a mudança da Finalidade da Copy, garantindo que o Select do Shadcn funcione bem com RHF ou estado local
  const handleCopyPurposeKeyChange = (value: string) => {
    setSelectedCopyPurposeKey(value);
    // Se você estivesse usando RHF para selectedCopyPurposeKey, seria:
    // rhfBaseForm.setValue('copyPurposeKey', value, { shouldValidate: true });
  };


  return (
    <div className={`p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 font-sans ${neoBgMainClass} ${neoTextSecondaryClass} min-h-screen`}>
      <style jsx global>{`
        /* Estilos para scrollbar no tema dark neomórfico */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.4); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.6); }
        .dark .custom-scrollbar { scrollbar-color: hsl(var(--muted-foreground) / 0.4) hsl(var(--muted) / 0.2); }
      `}</style>
      <header className="pb-4 sm:pb-6 border-b border-slate-700">
        <h1 className={`text-2xl sm:text-3xl font-bold ${neoTextPrimaryClass}`}>Gerador de Copy IA Avançado</h1>
        <p className="mt-1 sm:mt-2">Crie textos altamente específicos para cada etapa do seu lançamento.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Coluna de Configuração */}
        <Card className={`lg:col-span-2 ${cardStyleNeo}`}>
          <CardHeader className={cardHeaderStyleNeo}>
            <CardTitle className={cardTitleStyleNeo}><Bot className={`mr-2 ${neoTextPrimaryClass}`} />Configurar Geração</CardTitle>
            <CardDescription className={neoTextSecondaryClass}>Preencha os campos para que a IA crie a copy ideal.</CardDescription>
          </CardHeader>
          <CardContent className={cardContentStyleNeo}>
            <FormProvider {...rhfBaseForm}>
              <form onSubmit={rhfBaseForm.handleSubmit(handleSubmitBaseFormAndGenerate)} className="space-y-6">
                <Accordion type="single" collapsible defaultValue="item-base" className="w-full">
                  <AccordionItem value="item-base" className={`border rounded-lg ${neoShadowInset} bg-slate-800/30`}>
                    <AccordionTrigger className={`text-lg font-semibold hover:no-underline p-4 ${neoTextPrimaryClass} rounded-t-lg`}>
                        Informações Base (Obrigatórias)
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={rhfBaseForm.control} name="product" render={({ field }) => (<FormItem><FormLabel className={labelStyleNeo}>Produto/Serviço Geral*</FormLabel><FormControl><Input placeholder="Ex: Consultoria de Marketing Avançada" {...field} className={inputStyleNeo} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="audience" render={({ field }) => (<FormItem><FormLabel className={labelStyleNeo}>Público-Alvo Geral*</FormLabel><FormControl><Input placeholder="Ex: Empresas SaaS B2B" {...field} className={inputStyleNeo} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="objective" render={({ field }) => (<FormItem><FormLabel className={labelStyleNeo}>Objetivo Geral da Marca</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className={inputStyleNeo}><SelectValue /></SelectTrigger></FormControl><SelectContent className="bg-slate-800 text-slate-200 border-slate-700">{objectiveOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-700 focus:bg-slate-700">{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={rhfBaseForm.control} name="tone" render={({ field }) => (<FormItem><FormLabel className={labelStyleNeo}>Tom de Voz Geral</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className={inputStyleNeo}><SelectValue /></SelectTrigger></FormControl><SelectContent className="bg-slate-800 text-slate-200 border-slate-700">{toneOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-700 focus:bg-slate-700">{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <Button type="button" variant="outline" size="sm" className={`${buttonSecondaryNeo} w-full mt-2`} onClick={handleGenerateContentIdeas} disabled={generateContentIdeasMutation.isPending}>
                    {generateContentIdeasMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lightbulb className="mr-2 h-4 w-4"/>}
                    Gerar Ideias de Conteúdo (Produto/Público Base)
                </Button>
            
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-700 mt-4">
                    <FormItem>
                        <FormLabel htmlFor="launch-phase" className={`${labelStyleNeo} text-base`}>1. Fase do Lançamento*</FormLabel>
                        <Select value={selectedLaunchPhase} onValueChange={(value: LaunchPhase | '') => setSelectedLaunchPhase(value)}>
                            <SelectTrigger id="launch-phase" className={inputStyleNeo}><SelectValue placeholder="Selecione uma fase..." /></SelectTrigger>
                            <SelectContent className="bg-slate-800 text-slate-200 border-slate-700">
                                <SelectItem value="pre_launch" className="hover:bg-slate-700 focus:bg-slate-700">Pré-Lançamento</SelectItem>
                                <SelectItem value="launch" className="hover:bg-slate-700 focus:bg-slate-700">Lançamento</SelectItem>
                                <SelectItem value="post_launch" className="hover:bg-slate-700 focus:bg-slate-700">Pós-Lançamento</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>

                    <FormItem>
                        <FormLabel htmlFor="copy-purpose-key" className={`${labelStyleNeo} text-base`}>2. Finalidade da Copy*</FormLabel>
                        <Select value={selectedCopyPurposeKey} onValueChange={handleCopyPurposeKeyChange} disabled={!selectedLaunchPhase || groupedPurposeOptions.length === 0}>
                            <SelectTrigger id="copy-purpose-key" className={inputStyleNeo} disabled={!selectedLaunchPhase || groupedPurposeOptions.length === 0}>
                                <SelectValue placeholder={selectedLaunchPhase && groupedPurposeOptions.length > 0 ? "Selecione a finalidade..." : (selectedLaunchPhase ? "Nenhuma finalidade para esta fase" : "Selecione uma fase primeiro")}/>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] bg-slate-800 text-slate-200 border-slate-700">
                            {groupedPurposeOptions.map(([category, options]) => (
                                <SelectGroup key={category}>
                                    <ShadcnSelectLabel className="text-slate-400 px-2 py-1.5">{category}</ShadcnSelectLabel>
                                    {options.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-700 focus:bg-slate-700">{opt.label}</SelectItem>)}
                                </SelectGroup>
                            ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                </div>
                {currentPurposeDetails?.description && <CardDescription className={`text-xs mt-1 px-1 ${neoTextSecondaryClass}`}>{currentPurposeDetails.description}</CardDescription>}
                
                {selectedCopyPurposeKey && currentSpecificFields.length > 0 && (
                  <Card className={`p-4 pt-2 mt-4 ${neoBgBase} shadow-[var(--neu-shadow-inset)]`}>
                    <CardHeader className="p-0 pb-3 mb-3 border-b border-slate-700">
                        <CardTitle className={`${labelStyleNeo} text-base ${neoTextPrimaryClass}`}>3. Detalhes para: <span className="text-purple-400">{currentPurposeDetails?.label}</span></CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                        {currentSpecificFields.map(field => (
                        <FormItem key={field.name} className="space-y-1.5">
                            <div className="flex items-center">
                            <FormLabel htmlFor={`specific-${field.name}`} className={`${labelStyleNeo} mb-0.5`}>
                                {field.label} {field.required && <span className="text-red-400">*</span>}
                            </FormLabel>
                            {field.tooltip && (
                                <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-1.5 p-0"><InfoIconLucide className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" /></Button></TooltipTrigger><TooltipContent side="top" className="max-w-xs z-[100] bg-slate-900 text-slate-200 border-slate-700"><p className="text-xs">{field.tooltip}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            </div>
                            {field.type === 'textarea' ? (
                            <FormControl><Textarea id={`specific-${field.name}`} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, e.target.value)} rows={field.label.toLowerCase().includes('tópicos') || field.label.toLowerCase().includes('passos') || field.label.toLowerCase().includes('conteúdo') ? 4 : 2} required={field.required} className={inputStyleNeo}/></FormControl>
                            ) : field.type === 'select' ? (
                            <Select value={specificPurposeData[field.name] || field.defaultValue || ''} onValueChange={(value) => handleSpecificDataChange(field.name, value)} required={field.required}>
                                <FormControl><SelectTrigger id={`specific-${field.name}`} className={inputStyleNeo}><SelectValue placeholder={field.placeholder || 'Selecione...'} /></SelectTrigger></FormControl>
                                <SelectContent className="bg-slate-800 text-slate-200 border-slate-700">{field.options?.map(opt => (<SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-700 focus:bg-slate-700">{opt.label}</SelectItem>))}</SelectContent>
                            </Select>
                            ) : (
                            <FormControl><Input id={`specific-${field.name}`} type={field.type as React.HTMLInputTypeAttribute} placeholder={field.placeholder} value={specificPurposeData[field.name] || ''} onChange={(e) => handleSpecificDataChange(field.name, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} required={field.required} className={inputStyleNeo}/></FormControl>
                            )}
                            <FormMessage />
                        </FormItem>
                        ))}
                    </CardContent>
                  </Card>
                )}
                 {!selectedCopyPurposeKey && selectedLaunchPhase && ( <div className={`text-center py-6 ${neoTextSecondaryClass} border border-slate-700 rounded-md bg-slate-800/50 ${neoShadowInset}`}><InfoIconLucide className="w-8 h-8 mx-auto mb-2 opacity-70"/><p>Selecione uma "Finalidade da Copy" para detalhar.</p></div> )}

                <Button type="submit" disabled={generateSpecificCopyMutation.isPending || !selectedCopyPurposeKey} className={`${buttonPrimaryNeo} w-full mt-6 text-base py-3`}>
                  {generateSpecificCopyMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  Gerar Copy Avançada
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>

        {/* Coluna de Resultados */}
        <Card className={`lg:col-span-1 sticky top-6 ${cardStyleNeo}`}>
            <CardHeader className={cardHeaderStyleNeo}>
                <CardTitle className={cardTitleStyleNeo}><Sparkles className={`mr-2 ${neoTextPrimaryClass}`}/>Copies Geradas</CardTitle>
                <CardDescription className={neoTextSecondaryClass}>Resultados da IA para sua finalidade.</CardDescription>
            </CardHeader>
            <CardContent className={`${cardContentStyleNeo} max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar`}>
                <div className="space-y-4">
                {generateSpecificCopyMutation.isPending && ( <div className="text-center py-10"><Loader2 className={`w-10 h-10 ${neoTextPrimaryClass} mx-auto mb-3 animate-spin`} /> Gerando...</div> )}
                {!generateSpecificCopyMutation.isPending && generatedCopies.length === 0 && ( <div className="text-center py-10"> <Bot className={`w-16 h-16 mx-auto mb-4 ${neoTextSecondaryClass} opacity-50`} /> <p>Suas copies personalizadas aparecerão aqui.</p> </div> )}
                {generatedCopies.map((copy, index) => {
                    const purposeConfig = allCopyPurposesConfig.find(p => p.key === copy.purposeKey);
                    return (
                    <Card key={index} className={`${neoBgBase} rounded-lg shadow-[var(--neu-shadow-outset)] p-0.5`}>
                        <CardContent className={`p-3 bg-slate-800 rounded-md`}>
                            <div className="flex justify-between items-center mb-2">
                            <Badge className={badgeStyleNeo('bg-purple-600/30', 'text-purple-300')}>{purposeConfig?.label || copy.purposeKey}</Badge>
                            <div className="flex space-x-0.5">
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7`} onClick={() => copyToClipboard(copy.mainCopy)}><CopyIcon className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Copiar Principal</p></TooltipContent></Tooltip></TooltipProvider>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7`} onClick={() => handleOptimizeCopy(copy, index)} disabled={optimizingCopy?.index === index || optimizeCopyMutation.isPending}><Wand2 className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Otimizar com IA</p></TooltipContent></Tooltip></TooltipProvider>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7`} onClick={() => handleSaveGeneratedCopy(copy)} disabled={saveCopyMutation.isPending}><Save className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Salvar</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                            </div>
                            <Label className={`font-semibold text-sm ${neoTextPrimaryClass} mt-1 block`}>Texto Principal:</Label>
                            <Textarea value={copy.mainCopy || "---"} readOnly rows={Math.min(8, (copy.mainCopy?.split('\n').length || 1) +1 )} className={`text-sm ${neoTextSecondaryClass} whitespace-pre-line p-2.5 bg-slate-900/70 rounded-md mt-1 ${neoShadowInset} h-auto`}/>
                            
                            {copy.alternativeVariation1 && (<details className="text-xs my-2"><summary className={`cursor-pointer ${neoTextSecondaryClass} hover:text-purple-400 font-medium py-1`}>Ver Variação 1</summary><Textarea value={copy.alternativeVariation1} readOnly rows={3} className={`mt-1 p-2.5 bg-slate-900/70 rounded-md whitespace-pre-line ${neoTextSecondaryClass} h-auto text-xs ${neoShadowInset}`}/></details>)}
                            {copy.alternativeVariation2 && (<details className="text-xs my-2"><summary className={`cursor-pointer ${neoTextSecondaryClass} hover:text-purple-400 font-medium py-1`}>Ver Variação 2</summary><Textarea value={copy.alternativeVariation2} readOnly rows={3} className={`mt-1 p-2.5 bg-slate-900/70 rounded-md whitespace-pre-line ${neoTextSecondaryClass} h-auto text-xs ${neoShadowInset}`}/></details>)}
                            
                            {copy.platformSuggestion && <p className="text-xs text-slate-400 mt-2">Plataforma Sugerida: <Badge className={badgeStyleNeo('bg-slate-700', 'text-slate-200')}>{copy.platformSuggestion}</Badge></p>}
                            {copy.notes && <p className="text-xs text-amber-500 mt-1 italic">Nota da IA: {copy.notes}</p>}
                            <p className="text-xs text-slate-500 text-right mt-1.5">Gerado: {copy.timestamp.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                        </CardContent>
                    </Card>
                    );
                })}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className={cardStyleNeo}>
        <CardHeader className={`${cardHeaderStyleNeo} flex-wrap gap-3 md:flex-nowrap md:items-center md:justify-between`}> 
            <CardTitle className={cardTitleStyleNeo}><FileText className={`mr-2 ${neoTextPrimaryClass}`}/> Biblioteca de Copies Salvas</CardTitle> 
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto"> 
                <div className="relative flex-grow">
                    <SearchIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4`} />
                    <Input placeholder="Buscar na biblioteca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${inputStyleNeo} pl-10 text-sm`} />
                </div> 
                <Select value={filterLaunchPhase} onValueChange={(v) => setFilterLaunchPhase(v as LaunchPhase | 'all')}>
                    <SelectTrigger className={`${inputStyleNeo} text-sm w-full sm:w-auto`}><SelectValue placeholder="Filtrar Fase..." /></SelectTrigger>
                    <SelectContent className="bg-slate-800 text-slate-200 border-slate-700"><SelectItem value="all" className="hover:bg-slate-700 focus:bg-slate-700">Todas as Fases</SelectItem> <SelectItem value="pre_launch" className="hover:bg-slate-700 focus:bg-slate-700">Pré-Lançamento</SelectItem> <SelectItem value="launch" className="hover:bg-slate-700 focus:bg-slate-700">Lançamento</SelectItem> <SelectItem value="post_launch" className="hover:bg-slate-700 focus:bg-slate-700">Pós-Lançamento</SelectItem></SelectContent>
                </Select> 
                <Select value={filterCopyPurpose} onValueChange={(v) => setFilterCopyPurpose(v as string | 'all')}>
                    <SelectTrigger className={`${inputStyleNeo} text-sm w-full sm:w-auto`}><SelectValue placeholder="Filtrar Finalidade..." /></SelectTrigger>
                    <SelectContent className="max-h-60 bg-slate-800 text-slate-200 border-slate-700">
                        <SelectItem value="all" className="hover:bg-slate-700 focus:bg-slate-700">Todas Finalidades</SelectItem> 
                        {allCopyPurposesConfig.map(p => <SelectItem key={p.key} value={p.key} className="hover:bg-slate-700 focus:bg-slate-700">{p.label}</SelectItem>)} 
                    </SelectContent>
                </Select> 
            </div> 
        </CardHeader>
        <CardContent className={cardContentStyleNeo}>
          {isSavedCopiesLoading && <div className="text-center py-8"><Loader2 className={`w-8 h-8 ${neoTextPrimaryClass} mx-auto animate-spin`}/> Carregando biblioteca...</div>}
          {!isSavedCopiesLoading && filteredSavedCopies.length === 0 && (
             <div className="text-center py-12"> <FileText className={`w-16 h-16 mx-auto mb-4 ${neoTextSecondaryClass} opacity-50`} /> <h3 className={`text-lg font-semibold ${neoTextPrimaryClass}`}>Nenhuma copy encontrada.</h3> <p>{(savedCopiesList || []).length === 0 ? 'Suas copies salvas aparecerão aqui.' : 'Ajuste os filtros.'}</p> </div>
           )}
           {!isSavedCopiesLoading && filteredSavedCopies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSavedCopies.map((copy) => (
                <Card key={copy.id} className={`${cardStyleNeo} flex flex-col`}>
                  <CardContent className={`p-4 flex flex-col flex-grow bg-slate-800 rounded-lg`}>
                    <h4 className={`font-semibold ${neoTextPrimaryClass} line-clamp-2 mb-1 text-base leading-tight`}>{copy.title}</h4> 
                    <div className="flex flex-wrap gap-1.5 mb-2"> 
                        <Badge className={badgeStyleNeo('bg-blue-600/30', 'text-blue-300')}>{allCopyPurposesConfig.find(p => p.key === copy.purposeKey)?.label || copy.purposeKey}</Badge> 
                        <Badge className={badgeStyleNeo('bg-indigo-600/30', 'text-indigo-300')}>{copy.launchPhase === 'pre_launch' ? 'Pré-Lançamento' : copy.launchPhase === 'launch' ? 'Lançamento' : 'Pós-Lançamento'}</Badge> 
                    </div>
                    <p className={`text-sm ${neoTextSecondaryClass} mb-3 line-clamp-3 flex-grow`}>{copy.content}</p>
                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-700"> 
                        <span className="text-xs text-slate-400">{new Date(copy.createdAt).toLocaleDateString('pt-BR')}</span> 
                        <div className="flex space-x-0.5"> 
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7`} onClick={() => handleReuseSavedCopy(copy)}><RotateCcw className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Reutilizar Dados</p></TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7`} onClick={() => copyToClipboard(copy.content)}><CopyIcon className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Copiar Texto</p></TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`${buttonSecondaryNeo} !p-1.5 !h-7 !w-7 !text-red-400 hover:!bg-red-500/20`} onClick={() => deleteMutation.mutate(copy.id)} disabled={deleteMutation.isPending && deleteMutation.variables === copy.id}><Trash2 className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent side="top" className="bg-slate-900 text-slate-200 border-slate-700"><p>Excluir Copy</p></TooltipContent></Tooltip></TooltipProvider>
                        </div> 
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

      <Modal isOpen={isContentIdeasModalOpen} onClose={() => setIsContentIdeasModalOpen(false)} title="✨ Ideias de Conteúdo Geradas pela IA">
        {generateContentIdeasMutation.isPending && <div className="text-center py-4"><Loader2 className={`w-6 h-6 ${neoTextPrimaryClass} mx-auto animate-spin`} /> Gerando ideias...</div>}
        {generateContentIdeasMutation.isError && <div className="text-red-400">Ocorreu um erro ao gerar as ideias. Tente novamente.</div>}
        {contentIdeas.length > 0 && !generateContentIdeasMutation.isPending && (
          <ul className={`list-disc pl-5 space-y-2 mt-2 text-sm ${neoTextSecondaryClass}`}>
            {contentIdeas.map((idea, index) => ( <li key={index}>{idea}</li> ))}
          </ul>
        )}
        {contentIdeas.length === 0 && !generateContentIdeasMutation.isPending && !generateContentIdeasMutation.isError && (
            <p className="text-slate-400">Nenhuma ideia foi gerada. Tente refinar as informações do produto/público.</p>
        )}
        <Button onClick={() => setIsContentIdeasModalOpen(false)} className={`${buttonSecondaryNeo} mt-5 w-full`}>Fechar</Button>
      </Modal>
    </div>
  );
}

// Não exportar QueryClientProvider daqui, pois ele já existe globalmente no seu App.tsx
// export default function AppWithProviders() { ... } // Removido
