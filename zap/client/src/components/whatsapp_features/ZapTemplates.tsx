// zap/client/src/components/whatsapp_features/ZapTemplates.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@zap_client/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Badge } from '@zap_client/components/ui/badge';
import { Input } from '@zap_client/components/ui/input';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@zap_client/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@zap_client/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@zap_client/components/ui/dropdown-menu';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Separator } from '@zap_client/components/ui/separator';
import { apiRequest } from '@zap_client/lib/api';
import { Loader2, Plus, Edit, Trash2, ListChecks, AlertTriangle, MoreVertical, Send, Eye, MessageSquare, Link2, PhoneCall, Copy, HelpCircle } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';
import { z } from 'zod';
import { useForm, Controller, useFieldArray, FieldErrors, UseFormReturn, Path, PathValue, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Tipos
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type TemplateMetaStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'UNKNOWN';
type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
type TemplateComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
type HeaderFormatType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';


interface TemplateButtonFormData {
  idUi?: string; // Para react-hook-form key
  type: TemplateButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string[]; // Para URL dinâmica com uma variável {{1}}
  copy_code_text?: string; // Para botão de copiar código (Meta API)
}

interface TemplateComponentFormData {
  idUi?: string;
  type: TemplateComponentType;
  format?: HeaderFormatType;
  text?: string; // Para HEADER (TEXT), BODY, FOOTER
  example?: {
    header_handle?: string[]; // Para HEADER IMAGE/VIDEO/DOCUMENT (URL pública ou ID da Meta)
    header_text?: string;     // Para HEADER TEXT com UMA variável {{1}}
    body_text?: string[][];   // Array de arrays de strings para variáveis no BODY. Ex: [["valor1_var1", "valor1_var2"], ["valor2_var1", "valor2_var2"]]
    // TODO: Adicionar examples para buttons com variáveis de URL
  };
  buttons?: TemplateButtonFormData[];
}

// Schema Zod
const templateButtonFormSchemaInternal = z.object({
  idUi: z.string().optional(),
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'], { required_error: "Tipo é obrigatório."}),
  text: z.string().min(1, "Texto do botão é obrigatório.").max(200, "Texto do botão: máx 200 chars para WhatsApp (Meta diz 25, mas API aceita mais para alguns casos). Verifique a documentação oficial."), // Ajustado limite
  url: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  example: z.array(z.string().max(1000, "Exemplo de variável de URL muito longo.")).max(1, "Apenas 1 exemplo para URL dinâmica.").optional(),
  copy_code_text: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'URL' && (!data.url || !z.string().url().safeParse(data.url).success)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL inválida ou obrigatória.", path: ['url'] });
    }
    if (data.type === 'PHONE_NUMBER' && (!data.phoneNumber || !/^\+[1-9]\d{6,14}$/.test(data.phoneNumber))) { // E.164 simplificado
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefone inválido (Ex: +55119...).", path: ['phoneNumber'] });
    }
    if (data.type === 'COPY_CODE' && (!data.copy_code_text || data.copy_code_text.trim() === '')) {
        // Meta pode exigir que 'example' seja usado para COPY_CODE em vez de copy_code_text
        // ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Texto de exemplo para copiar é obrigatório.", path: ['copy_code_text'] });
    }
});

const templateComponentFormSchemaInternal = z.object({
  idUi: z.string().optional(),
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).optional(),
  text: z.string().max(32768).optional(), // Limite geral alto, mas Meta tem específicos
  example: z.object({
    header_handle: z.array(z.string()).optional().or(z.string().url("Deve ser uma URL válida para mídia no cabeçalho.").optional()),
    header_text: z.string().max(60, "Máx 60 chars para header text.").optional(),
    body_text: z.array(z.array(z.string().max(1000, "Exemplo de variável muito longo."))).optional(),
  }).optional().default({}),
  buttons: z.array(templateButtonFormSchemaInternal).max(10, "Máximo de 10 botões (verifique regras da Meta para combinações).").optional().default([]), // Meta tem regras: até 3 quick_reply OU até 10 marketing buttons
}).superRefine((data, ctx) => {
    if (data.type === 'HEADER' && !data.format) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato é obrigatório para HEADER.", path: ['format'] });
    if (data.type === 'HEADER' && data.format === 'TEXT' && (!data.text || data.text.length > 60)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cabeçalho de texto: obrigatório e máx 60 chars.", path: ['text'] });
    if (data.type === 'BODY' && (!data.text || data.text.length === 0 || data.text.length > 1024)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Corpo: obrigatório e máx 1024 chars.", path: ['text'] });
    if (data.type === 'FOOTER' && data.text && data.text.length > 60) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rodapé: máx 60 chars.", path: ['text'] });
    if (data.type === 'BUTTONS' && (!data.buttons || data.buttons.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Adicione pelo menos um botão.", path: ['buttons'] });
    if (data.type === 'BUTTONS' && data.buttons) {
        const quickReplies = data.buttons.filter(b => b.type === 'QUICK_REPLY').length;
        const callToActions = data.buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER').length;
        const copyCode = data.buttons.filter(b => b.type === 'COPY_CODE').length;
        if (quickReplies > 0 && (callToActions > 0 || copyCode > 0) ) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Não misture botões de Resposta Rápida com Chamada para Ação/Copiar Código.", path: ['buttons']});
        if (quickReplies > 3) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo de 3 botões de Resposta Rápida.", path: ['buttons']});
        // Meta: Up to 10 buttons (combination of up to 3 quick replies, or up to 10 call-to-action / marketing buttons).
        // If CTAs + Marketing, up to 2 URL, up to 1 Phone, and others can be marketing type.
        // This simplified Zod doesn't capture all Meta rules, but it's a start.
    }
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").regex(/^[a-z0-9_]+$/, "Nome: minúsculas, números, underscores (_).").max(512, "Máx 512 chars."),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION'], {required_error: "Categoria é obrigatória."}),
  language: z.string().min(2, "Código do idioma é obrigatório.").max(15),
  components: z.array(templateComponentFormSchemaInternal)
    .min(1, "Pelo menos um componente (ex: BODY) é obrigatório.")
    .superRefine((components, ctx) => {
        if (!components.find(c => c.type === 'BODY')) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Um componente BODY é obrigatório.", path: ['components'] });
        if (components.filter(c => c.type === 'BUTTONS').length > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas um grupo de BOTÕES é permitido.", path: ['components']});
        if (components.filter(c => c.type === 'HEADER').length > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas um HEADER é permitido.", path: ['components']});
        if (components.filter(c => c.type === 'FOOTER').length > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas um FOOTER é permitido.", path: ['components']});
    }),
});
type TemplateFormData = z.infer<typeof templateFormSchema>;
interface ZapMessageTemplate { id: number; mktv2UserId: number; name: string; category?: TemplateCategory | null; language: string; components: TemplateComponentFormData[]; metaTemplateId?: string | null; statusMeta?: TemplateMetaStatus | null; createdAt: string; updatedAt: string; }

// Sub-componente para editar Botões (como na rodada anterior, mas usando TemplateButtonFormData)
interface TemplateButtonsSubFormProps { /* ... como antes ... */ }
const TemplateButtonsSubForm: React.FC<TemplateButtonsSubFormProps> = ({ componentIndex, control, register, watch, errors }) => { /* ... (código como na rodada anterior, usando os tipos e paths corretos) ... */ return <div>...</div>; };


const ZapTemplates: React.FC = () => {
  const queryClientHook = useQueryClient();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ZapMessageTemplate | null>(null);

  const { control, register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', category: 'UTILITY', language: 'pt_BR', components: [{ idUi: `comp_${Date.now()}`, type: 'BODY', text: '', example: {}, buttons: [] }] }
  });

  const { fields: componentFields, append: appendComponent, remove: removeComponent } = useFieldArray({ control, name: "components" });

  const { data: templates = [], isLoading: isLoadingTemplates, error: templatesError } = useQuery<ZapMessageTemplate[], ApiError>({ /* ... */ });
  const templateMutation = useMutation<ZapMessageTemplate, ApiError, { id?: number, data: TemplateFormData }>({ /* ... */ });
  const deleteTemplateMutation = useMutation<void, ApiError, number>({ /* ... */ });

  const handleOpenFormModal = (template?: ZapMessageTemplate) => {
    setEditingTemplate(template || null);
    const defaultComponents = [{ idUi: `comp_${Date.now()}`, type: 'BODY' as const, text: '', example: {}, buttons: [] }];
    reset({
      name: template?.name || '',
      category: template?.category || 'UTILITY',
      language: template?.language || 'pt_BR',
      components: template?.components?.length ? template.components.map(c => ({...c, idUi: c.idUi || `comp_${Date.now()}_${Math.random()}`, buttons: (c.buttons || []).map(b => ({...b, idUi: b.idUi || `btn_${Date.now()}_${Math.random()}`})) })) : defaultComponents,
    });
    setIsFormModalOpen(true);
  };
  const onFormSubmit = (data: TemplateFormData) => {
    const cleanedData = { // Limpar idUi antes de enviar para API
        ...data,
        components: data.components.map(({ idUi, ...comp }) => ({
            ...comp,
            buttons: (comp.buttons || []).map(({ idUi: btnIdUi, ...btn }) => btn)
        }))
    };
    console.log("Template Form Data (Cleaned for API):", JSON.stringify(cleanedData, null, 2));
    templateMutation.mutate({ id: editingTemplate?.id, data: cleanedData });
  };
  const handleDeleteTemplate = (templateId: number) => { /* ... */ };
  const getStatusMetaBadgeVariant = (status?: TemplateMetaStatus | null): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => { /* ... */ return 'secondary'; };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"> /* ... Título e Botão Criar ... */ </div>
      {isLoadingTemplates && <div className="text-center p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> Carregando...</div>}
      {templatesError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Erro!</AlertTitle><AlertDescription>{(templatesError as Error).message}</AlertDescription></Alert>}
      {!isLoadingTemplates && templates.length === 0 && !templatesError && ( /* ... Nenhum template ... */ )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => ( /* ... Card do template como antes ... */ ))}
      </div>

      <Dialog open={isFormModalOpen} onOpenChange={(open) => { setIsFormModalOpen(open); if (!open) { setEditingTemplate(null); reset(); } }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl neu-card p-0">
          <DialogHeader className="p-6 pb-4 border-b"><DialogTitle className="text-xl">{editingTemplate ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle><DialogDescription>Configure os componentes e o conteúdo do seu modelo.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <ScrollArea className="max-h-[calc(80vh-150px)] p-1">
            <div className="p-6 space-y-4">
              <div><Label htmlFor="template-form-name">Nome do Template*</Label><Input id="template-form-name" {...register("name")} className="neu-input mt-1"/><p className="text-xxs text-muted-foreground mt-0.5">Minúsculas, números, underscores (_).</p>{errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="template-form-category">Categoria*</Label><Controller name="category" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="template-form-category" className="neu-input mt-1"><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent><SelectItem value="MARKETING">Marketing</SelectItem><SelectItem value="UTILITY">Utilidade</SelectItem><SelectItem value="AUTHENTICATION">Autenticação</SelectItem></SelectContent></Select> )}/>{errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}</div>
                <div><Label htmlFor="template-form-language">Idioma*</Label><Input id="template-form-language" {...register("language")} className="neu-input mt-1"/>{errors.language && <p className="text-xs text-destructive mt-1">{errors.language.message}</p>}</div>
              </div>
              
              <Separator className="my-4"/>
              <Label className="text-md font-medium text-foreground block mb-2">Componentes do Template</Label>
              {componentFields.map((componentField, componentIndex) => {
                const componentPathPrefix = `components.${componentIndex}` as const;
                const currentComponentType = watch(`${componentPathPrefix}.type` as Path<TemplateFormData>);
                const currentHeaderFormat = watch(`${componentPathPrefix}.format` as Path<TemplateFormData>);
                const componentErrors = errors.components?.[componentIndex];
                return (
                <Card key={componentField.idUi || componentField.id} className="p-4 space-y-3 neu-inset-card mb-3 shadow-sm">
                    <div className="flex justify-between items-center">
                        <Controller name={`${componentPathPrefix}.type` as Path<TemplateFormData>} control={control} render={({ field: typeField }) => (
                            <Select onValueChange={typeField.onChange} value={typeField.value as TemplateComponentType}>
                            <SelectTrigger className="w-[190px] h-9 text-xs neu-input"><SelectValue placeholder="Tipo Componente" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="HEADER">Cabeçalho (HEADER)</SelectItem>
                                <SelectItem value="BODY">Corpo (BODY)*</SelectItem>
                                <SelectItem value="FOOTER">Rodapé (FOOTER)</SelectItem>
                                <SelectItem value="BUTTONS">Botões (BUTTONS)</SelectItem>
                            </SelectContent>
                            </Select>
                        )} />
                        {componentFields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(componentIndex)} className="h-7 w-7 text-destructive neu-button"><Trash2 className="w-4 h-4"/></Button>}
                    </div>
                    {(componentErrors as any)?.type && <p className="text-xs text-destructive mt-1">{(componentErrors as any).type.message}</p>}

                    {currentComponentType === 'HEADER' && (
                        <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2 border-dashed">
                            <Label className="text-xs">Formato do Cabeçalho*</Label>
                            <Controller name={`${componentPathPrefix}.format` as Path<TemplateFormData>} control={control} render={({ field: formatField }) => (
                                <Select onValueChange={formatField.onChange} value={formatField.value as HeaderFormatType || 'TEXT'}>
                                <SelectTrigger className="w-full h-9 text-xs neu-input"><SelectValue placeholder="Formato do Cabeçalho" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TEXT">Texto</SelectItem><SelectItem value="IMAGE">Imagem</SelectItem>
                                    <SelectItem value="VIDEO">Vídeo</SelectItem><SelectItem value="DOCUMENT">Documento</SelectItem>
                                </SelectContent>
                                </Select>
                            )} />
                            {(componentErrors as any)?.format && <p className="text-xs text-destructive mt-1">{(componentErrors as any).format.message}</p>}

                            {currentHeaderFormat === 'TEXT' && (<>
                                <Label className="text-xs">Texto do Cabeçalho* (Máx 60)</Label>
                                <Input {...register(`${componentPathPrefix}.text` as const)} placeholder="Use {{1}} para variável" className="text-xs h-8 neu-input"/>
                                {(componentErrors as any)?.text && <p className="text-xs text-destructive mt-1">{(componentErrors as any).text.message}</p>}
                                <Label className="text-xs mt-1">Exemplo de Texto com Variável (para {{1}})</Label>
                                <Input {...register(`${componentPathPrefix}.example.header_text` as const)} placeholder="Ex: Olá Fulano" className="text-xs h-8 neu-input"/>
                            </>)}
                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(currentHeaderFormat || '') && (<>
                                <Label className="text-xs">Link da Mídia ou ID da Meta*</Label>
                                <Input {...register(`${componentPathPrefix}.example.header_handle.0` as const)} placeholder="https://url.com/midia.jpg ou ID" className="text-xs h-8 neu-input"/>
                                {(componentErrors as any)?.example?.header_handle?.[0] && <p className="text-xs text-destructive mt-1">{(componentErrors as any).example.header_handle[0].message}</p>}
                            </>)}
                        </div>
                    )}
                    {currentComponentType === 'BODY' && (
                        <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2 border-dashed">
                            <Label className="text-xs">Texto do Corpo* (Máx 1024)</Label>
                            <Textarea {...register(`${componentPathPrefix}.text` as const)} placeholder="Use {{1}}, {{2}} para variáveis." rows={4} className="text-xs neu-input"/>
                            {(componentErrors as any)?.text && <p className="text-xs text-destructive mt-1">{(componentErrors as any).text.message}</p>}
                            {/* TODO: UI para adicionar/editar examples.body_text (array de arrays de strings) */}
                        </div>
                    )}
                    {currentComponentType === 'FOOTER' && (
                         <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2 border-dashed">
                            <Label className="text-xs">Texto do Rodapé (Máx 60)</Label>
                            <Textarea {...register(`${componentPathPrefix}.text` as const)} rows={2} className="text-xs neu-input"/>
                            {(componentErrors as any)?.text && <p className="text-xs text-destructive mt-1">{(componentErrors as any).text.message}</p>}
                         </div>
                    )}
                    {currentComponentType === 'BUTTONS' && ( 
                        <TemplateButtonsSubForm 
                            componentIndex={componentIndex} 
                            control={control} 
                            register={register} 
                            watch={watch} 
                            errors={errors}
                        /> 
                    )}
                     {(componentErrors && typeof componentErrors !== 'boolean' && !Array.isArray(componentErrors) && (componentErrors as any).message) && 
                        <p className="text-xs text-destructive mt-1">{(componentErrors as any).message}</p>}
                     {(componentErrors && (componentErrors as any)?.root?.message) && 
                        <p className="text-xs text-destructive mt-1">{(componentErrors as any).root.message}</p>}
                </Card>
              );})}
              <Button type="button" variant="outline" size="sm" onClick={() => appendComponent({ idUi: `comp_${Date.now()}`, type: 'BODY', text: '', example: {}, buttons: [] })} className="text-xs neu-button mt-2"><Plus className="w-3.5 h-3.5 mr-1.5"/> Adicionar Componente</Button>
              {errors.components && typeof errors.components !== 'boolean' && !Array.isArray(errors.components) && <p className="text-xs text-destructive mt-1">{errors.components.message || (errors.components as any).root?.message}</p>}
            </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/30"> /* ... como antes ... */ </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default ZapTemplates;
