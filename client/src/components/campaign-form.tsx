// client/src/components/campaign-form.tsx
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { insertCampaignSchema, Campaign as CampaignType, InsertCampaign } from '@shared/schema'; // Usando InsertCampaign e CampaignType
import { X, Loader2, CalendarIcon, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Schema já definido em @shared/schema
// const campaignSchema = z.object({ ... });
type CampaignFormData = InsertCampaign; // Usando o tipo gerado pelo Zod a partir do schema do banco

interface CampaignFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: CampaignType; // Agora usa o tipo CampaignType para initialData
}

const platformOptions = [
  { value: 'facebook', label: 'Facebook Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram Ads' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
];

const objectiveOptions = [
  { value: 'awareness', label: 'Reconhecimento de Marca' },
  { value: 'traffic', label: 'Tráfego para o Site' },
  { value: 'engagement', label: 'Engajamento com Conteúdo' },
  { value: 'leads', label: 'Geração de Leads' },
  { value: 'app_promotion', label: 'Promoção de Aplicativo' },
  { value: 'sales', label: 'Vendas Online (Conversões)' },
  { value: 'store_visits', label: 'Visitas à Loja Física' },
];

export default function CampaignForm({ onClose, onSuccess, initialData }: CampaignFormProps) {
  const { toast } = useToast();
  
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(insertCampaignSchema), // Usando o schema importado
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      status: initialData?.status || 'draft',
      platforms: initialData?.platforms || [],
      objectives: initialData?.objectives || [],
      budget: initialData?.budget ? String(initialData.budget) : '', // Convertendo para string para o input
      dailyBudget: initialData?.dailyBudget ? String(initialData.dailyBudget) : '',
      startDate: initialData?.startDate ? new Date(initialData.startDate) : undefined,
      endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined,
      targetAudience: initialData?.targetAudience || '',
      industry: initialData?.industry || '',
      avgTicket: initialData?.avgTicket ? String(initialData.avgTicket) : '',
      userId: initialData?.userId || 0, // Adicionado userId, será pego no backend de qualquer forma
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || '',
        description: initialData.description || '',
        status: initialData.status || 'draft',
        platforms: initialData.platforms || [],
        objectives: initialData.objectives || [],
        budget: initialData.budget ? String(initialData.budget) : '',
        dailyBudget: initialData.dailyBudget ? String(initialData.dailyBudget) : '',
        startDate: initialData.startDate ? new Date(initialData.startDate) : undefined,
        endDate: initialData.endDate ? new Date(initialData.endDate) : undefined,
        targetAudience: initialData.targetAudience || '',
        industry: initialData.industry || '',
        avgTicket: initialData.avgTicket ? String(initialData.avgTicket) : '',
        userId: initialData.userId,
      });
    }
  }, [initialData, form]);


  const mutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const method = initialData ? 'PUT' : 'POST';
      const url = initialData ? `/api/campaigns/${initialData.id}` : '/api/campaigns';
      
      // Convertendo budget para número antes de enviar, se não for nulo/undefined
      const payload: any = { ...data };
      if (payload.budget !== undefined && payload.budget !== null && payload.budget !== '') {
        payload.budget = parseFloat(payload.budget);
      } else {
        delete payload.budget; // Remove se for string vazia para não dar erro no Zod do backend
      }
      if (payload.dailyBudget !== undefined && payload.dailyBudget !== null && payload.dailyBudget !== '') {
        payload.dailyBudget = parseFloat(payload.dailyBudget);
      } else {
        delete payload.dailyBudget;
      }
      if (payload.avgTicket !== undefined && payload.avgTicket !== null && payload.avgTicket !== '') {
        payload.avgTicket = parseFloat(payload.avgTicket);
      } else {
        delete payload.avgTicket;
      }


      const response = await apiRequest(method, url, payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Erro ao ${initialData ? 'atualizar' : 'criar'} campanha` }));
        throw new Error(errorData.error || errorData.message || `Erro desconhecido`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: `Campanha ${initialData ? 'atualizada' : 'criada'}`,
        description: `A campanha foi ${initialData ? 'atualizada' : 'criada'} com sucesso.`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: `Erro ao ${initialData ? 'atualizar' : 'criar'} campanha`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    // Os valores de platforms e objectives já estão no 'data' do form.control
    // Se você gerencia eles separadamente com useState (como 'selectedPlatforms'),
    // então você precisaria mesclá-los aqui:
    // mutation.mutate({ ...data, platforms: selectedPlatforms, objectives: selectedObjectives });
    // Mas o ideal é usar o form.watch ou form.setValue para manter o estado dentro do RHF.
    // O código atual com Controller para Checkbox já deve lidar com isso.
    mutation.mutate(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold">
              {initialData ? 'Editar Campanha' : 'Nova Campanha'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
          {initialData && <DialogDescription>Modifique os detalhes da campanha {initialData.name}.</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome da Campanha *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Lançamento Produto X - Q4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="completed">Finalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor/Indústria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: E-commerce, SaaS, Varejo" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes sobre o público, oferta, metas principais..."
                      rows={3}
                      {...field}
                      value={field.value || ''} // Garante que não seja null
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="platforms"
                render={() => (
                  <FormItem>
                    <FormLabel>Plataformas *</FormLabel>
                     <FormDescription className="text-xs">Selecione onde a campanha será veiculada.</FormDescription>
                    <div className="mt-2 space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                      {platformOptions.map((platform) => (
                        <FormField
                          key={platform.value}
                          control={form.control}
                          name="platforms"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(platform.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), platform.value])
                                        : field.onChange(
                                            (field.value || []).filter(
                                              (value) => value !== platform.value
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {platform.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />


              <FormField
                control={form.control}
                name="objectives"
                render={() => (
                  <FormItem>
                    <FormLabel>Objetivos da Campanha</FormLabel>
                    <FormDescription className="text-xs">Quais metas você deseja alcançar?</FormDescription>
                    <div className="mt-2 space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                      {objectiveOptions.map((objective) => (
                         <FormField
                          key={objective.value}
                          control={form.control}
                          name="objectives"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(objective.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), objective.value])
                                        : field.onChange(
                                            (field.value || []).filter(
                                              (value) => value !== objective.value
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {objective.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Total (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 5000.00" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dailyBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Diário (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 100.00" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="avgTicket"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Médio (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 150.00" {...field} value={field.value || ''} />
                    </FormControl>
                     <FormDescription className="text-xs flex items-center">
                        <Info size={12} className="mr-1"/> Valor médio por venda/conversão.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setDate(new Date().getDate() -1)) // Não permite datas passadas
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Fim</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            (form.getValues("startDate") && date < form.getValues("startDate")!) ||
                            date < new Date(new Date().setDate(new Date().getDate() -1))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="targetAudience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Público-Alvo Detalhado</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Mulheres, 25-45 anos, interessadas em moda sustentável, residentes em capitais..."
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? 'Salvar Alterações' : 'Criar Campanha'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
