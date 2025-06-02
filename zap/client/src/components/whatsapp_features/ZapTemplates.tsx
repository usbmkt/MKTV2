// zap/client/src/components/whatsapp_features/ZapTemplates.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@zap_client/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Badge } from '@zap_client/components/ui/badge';
import { Input } from '@zap_client/components/ui/input';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@zap_client/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@zap_client/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@zap_client/components/ui/dropdown-menu';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Separator } from '@zap_client/components/ui/separator';
import { apiRequest } from '@zap_client/lib/api';
import { Loader2, Plus, Edit, Trash2, ListChecks, AlertTriangle, MoreVertical, Send, Eye, MessageSquare } from 'lucide-react';
import { type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';
import { z } from 'zod';
import { useForm, Controller, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type TemplateMetaStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'UNKNOWN';

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'; // Removido OTP por simplicidade inicial
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string[];
  // copyCodeText?: string; // Para COPY_CODE
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: { // Conforme estrutura da Meta
    header_handle?: string[];      // Para HEADER IMAGE/VIDEO/DOCUMENT (ID da mídia ou URL pública)
    header_text?: string;          // Para HEADER TEXT com UMA variável {{1}}
    body_text?: string[][];        // Array de arrays para variáveis no BODY (cada array interno é um exemplo de preenchimento)
    // TODO: Adicionar examples para buttons com variáveis de URL
  };
  buttons?: TemplateButton[];
}

interface ZapMessageTemplate {
  id: number;
  mktv2UserId: number;
  name: string;
  category?: TemplateCategory | null;
  language: string;
  components: TemplateComponent[];
  metaTemplateId?: string | null;
  statusMeta?: TemplateMetaStatus | null;
  createdAt: string;
  updatedAt: string;
}

const templateButtonFormSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']),
  text: z.string().min(1, "Texto do botão é obrigatório.").max(25, "Máx 25 caracteres."),
  url: z.string().url("URL inválida.").optional().or(z.literal('')),
  phoneNumber: z.string().optional(), // Idealmente, validar formato do telefone
  example: z.array(z.string()).optional(), // Para URLs dinâmicas
});

const templateComponentFormSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).optional(),
  text: z.string().optional(),
  example: z.object({
    header_handle: z.array(z.string().url("Deve ser uma URL válida para mídia.")).optional(),
    header_text: z.string().optional(),
    body_text: z.array(z.array(z.string())).optional(),
  }).optional().default({}),
  buttons: z.array(templateButtonFormSchema).max(3, "Máximo de 3 botões por grupo.").optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'HEADER' && data.format === 'TEXT' && data.text && data.text.length > 60) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cabeçalho de texto: máx 60 caracteres.", path: ['text'] });
    }
    if (data.type === 'BODY' && data.text && data.text.length > 1024) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Corpo: máx 1024 caracteres.", path: ['text'] });
    }
    if (data.type === 'FOOTER' && data.text && data.text.length > 60) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rodapé: máx 60 caracteres.", path: ['text'] });
    }
    if (data.type === 'BUTTONS' && (!data.buttons || data.buttons.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Adicione pelo menos um botão.", path: ['buttons'] });
    }
    if (data.type === 'BUTTONS' && data.buttons) {
        const quickReplies = data.buttons.filter(b => b.type === 'QUICK_REPLY').length;
        const callToActions = data.buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER').length;
        if (quickReplies > 0 && callToActions > 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Não misture botões de Resposta Rápida com Chamada para Ação.", path: ['buttons']});
        }
        if (quickReplies > 3) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo de 3 botões de Resposta Rápida.", path: ['buttons']});
        }
        if (callToActions > 2) { // Simplificado, a Meta tem regras mais complexas
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo de 2 botões de Chamada para Ação (URL/Telefone).", path: ['buttons']});
        }
    }
});


const templateFormSchema = z.object({
  name: z.string().min(3, "Mín 3 chars.").regex(/^[a-z0-9_]+$/, "Nome: minúsculas, números, underscores (_).").max(512, "Máx 512 chars."),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION'], {required_error: "Categoria é obrigatória."}),
  language: z.string().min(2, "Código do idioma obrigatório (ex: pt_BR).").max(15),
  components: z.array(templateComponentFormSchema)
    .min(1, "Pelo menos um componente (ex: BODY) é obrigatório.")
    .superRefine((components, ctx) => {
        if (!components.find(c => c.type === 'BODY')) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Um componente BODY é obrigatório.", path: ['components'] });
        }
        if (components.filter(c => c.type === 'BUTTONS').length > 1) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas um grupo de BOTÕES é permitido.", path: ['components']});
        }
    }),
});
type TemplateFormData = z.infer<typeof templateFormSchema>;

// Componente Aninhado para Editar Botões de um TemplateComponent
interface TemplateButtonsSubFormProps {
    componentIndex: number;
    control: any; register: any; watch: any; errors: FieldErrors<TemplateFormData>;
}
const TemplateButtonsSubForm: React.FC<TemplateButtonsSubFormProps> = ({ componentIndex, control, register, watch, errors }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `components.${componentIndex}.buttons`
    });
    const parentComponentType = watch(`components.${componentIndex}.type`);
    if (parentComponentType !== 'BUTTONS') return null;

    return (
        <div className="space-y-2 pl-3 border-l-2 ml-3 mt-2 pt-2 border-dashed">
            <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-medium">Botões:</Label>
                <Button type="button" variant="outline" size="xs" 
                    onClick={() => append({ type: 'QUICK_REPLY', text: '' })} 
                    className="text-xxs neu-button h-6 px-1.5"
                    disabled={fields.length >= 3} // Limite geral de botões
                > <Plus className="w-3 h-3 mr-1"/> Adicionar Botão </Button>
            </div>
            {fields.map((buttonField, buttonIndex) => {
                const buttonTypePath = `components.${componentIndex}.buttons.${buttonIndex}.type`;
                const currentButtonType = watch(buttonTypePath);
                const buttonErrors = errors?.components?.[componentIndex]?.buttons?.[buttonIndex];

                return (
                    <Card key={buttonField.id} className="p-2.5 space-y-2 bg-card/50 dark:bg-background/30 neu-inset-card-sm shadow-sm">
                        <div className="flex justify-between items-center">
                            <Controller name={buttonTypePath as any} control={control} render={({field: btnTypeField}) => (
                                <Select onValueChange={btnTypeField.onChange} value={btnTypeField.value}>
                                <SelectTrigger className="h-7 text-xxs w-[160px] neu-input"><SelectValue placeholder="Tipo de Botão"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                                    <SelectItem value="URL">Link (URL)</SelectItem>
                                    <SelectItem value="PHONE_NUMBER">Ligar (Telefone)</SelectItem>
                                    {/* <SelectItem value="COPY_CODE">Copiar Código</SelectItem> */}
                                </SelectContent>
                                </Select>
                            )}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(buttonIndex)} className="h-6 w-6 text-destructive neu-button"><Trash2 className="w-3 h-3"/></Button>
                        </div>
                        {(buttonErrors as any)?.type && <p className="text-xxs text-destructive mt-0.5">{(buttonErrors as any).type.message}</p>}
                        
                        <div>
                            <Label htmlFor={`btn-text-${componentIndex}-${buttonIndex}`} className="text-xxs">Texto do Botão* (Máx 25)</Label>
                            <Input id={`btn-text-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.text` as const)} className="h-7 text-xxs neu-input mt-0.5"/>
                            {(buttonErrors as any)?.text && <p className="text-xxs text-destructive mt-0.5">{(buttonErrors as any).text.message}</p>}
                        </div>
                        
                        {currentButtonType === 'URL' && (<>
                            <Label htmlFor={`btn-url-${componentIndex}-${buttonIndex}`} className="text-xxs">URL do Link*</Label>
                            <Input id={`btn-url-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.url` as const)} placeholder="https://www.exemplo.com" className="h-7 text-xxs neu-input mt-0.5"/>
                            {(buttonErrors as any)?.url && <p className="text-xxs text-destructive mt-0.5">{(buttonErrors as any).url.message}</p>}
                            {/* TODO: Add example field for dynamic URLs */}
                        </>)}
                        {currentButtonType === 'PHONE_NUMBER' && (<>
                            <Label htmlFor={`btn-phone-${componentIndex}-${buttonIndex}`} className="text-xxs">Número de Telefone* (Ex: +55119...)</Label>
                            <Input id={`btn-phone-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.phoneNumber` as const)} className="h-7 text-xxs neu-input mt-0.5"/>
                            {(buttonErrors as any)?.phoneNumber && <p className="text-xxs text-destructive mt-0.5">{(buttonErrors as any).phoneNumber.message}</p>}
                        </>)}
                    </Card>
                );
            })}
            {errors?.components?.[componentIndex]?.buttons && typeof errors.components?.[componentIndex]?.buttons !== 'boolean' && !Array.isArray(errors.components?.[componentIndex]?.buttons) && 
                <p className="text-xs text-destructive mt-1">{(errors.components?.[componentIndex]?.buttons as any)?.message || (errors.components?.[componentIndex]?.buttons as any)?.root?.message}</p>}
        </div>
    );
}


const ZapTemplates: React.FC = () => {
  const queryClientHook = useQueryClient();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ZapMessageTemplate | null>(null);

  const { control, register, handleSubmit, reset, watch, setValue, getValues, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', category: 'UTILITY', language: 'pt_BR', components: [{ type: 'BODY', text: '', example: { body_text: [['exemplo de variável']] } }] }
  });

  const { fields: componentFields, append: appendComponent, remove: removeComponent } = useFieldArray({ control, name: "components" });

  const { data: templates = [], isLoading: isLoadingTemplates, error: templatesError } = useQuery<ZapMessageTemplate[], ApiError>({ /* ... */ });
  const templateMutation = useMutation<ZapMessageTemplate, ApiError, { id?: number, data: TemplateFormData }>({ /* ... */ });
  const deleteTemplateMutation = useMutation<void, ApiError, number>({ /* ... */ });

  const handleOpenFormModal = (template?: ZapMessageTemplate) => { /* ... como antes, usando reset(formData) ... */ };
  const onFormSubmit = (data: TemplateFormData) => { /* ... como antes ... */ };
  const handleDeleteTemplate = (templateId: number) => { /* ... como antes ... */ };
  const getStatusMetaBadgeVariant = (status?: TemplateMetaStatus | null): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => { /* ... */ return 'secondary';};
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Modelos de Mensagem (HSM)</h2>
        <Button onClick={() => handleOpenFormModal()} className="neu-button"><Plus className="w-4 h-4 mr-2" /> Criar Template</Button>
      </div>

      {isLoadingTemplates && <div className="text-center p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> Carregando...</div>}
      {/* ... (Error e Nenhum template como antes) ... */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => ( /* ... Card do template como antes ... */ ))}
      </div>

      <Dialog open={isFormModalOpen} onOpenChange={(open) => { setIsFormModalOpen(open); if (!open) { setEditingTemplate(null); reset(); } }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl neu-card p-0">
          <DialogHeader className="p-6 pb-4 border-b"><DialogTitle className="text-xl">{editingTemplate ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle><DialogDescription>Configure os componentes e o conteúdo do seu modelo.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <ScrollArea className="max-h-[calc(80vh-150px)] p-1"> {/* Ajustar altura e adicionar padding */}
            <div className="p-6 space-y-4">
              <div><Label>Nome do Template*</Label><Input {...register("name")} className="neu-input mt-1"/><p className="text-xxs text-muted-foreground mt-0.5">Minúsculas, números, underscores (_).</p>{errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria*</Label><Controller name="category" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="neu-input mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="MARKETING">Marketing</SelectItem><SelectItem value="UTILITY">Utilidade</SelectItem><SelectItem value="AUTHENTICATION">Autenticação</SelectItem></SelectContent></Select> )}/>{errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}</div>
                <div><Label>Idioma*</Label><Input {...register("language")} className="neu-input mt-1"/>{errors.language && <p className="text-xs text-destructive mt-1">{errors.language.message}</p>}</div>
              </div>
              <Separator className="my-3"/>
              <Label className="text-md font-medium text-foreground block mb-2">Componentes do Template</Label>
              {componentFields.map((componentField, componentIndex) => {
                const currentComponentType = watch(`components.${componentIndex}.type`);
                const componentErrors = errors.components?.[componentIndex];
                return (
                <Card key={componentField.id} className="p-4 space-y-3 neu-inset-card mb-3 shadow-sm">
                    <div className="flex justify-between items-center">
                        <Controller name={`components.${componentIndex}.type`} control={control} render={({ field: typeField }) => (
                            <Select onValueChange={typeField.onChange} value={typeField.value}>
                            <SelectTrigger className="w-[190px] h-9 text-xs neu-input"><SelectValue placeholder="Tipo Componente" /></SelectTrigger>
                            <SelectContent><SelectItem value="HEADER">Cabeçalho</SelectItem><SelectItem value="BODY">Corpo*</SelectItem><SelectItem value="FOOTER">Rodapé</SelectItem><SelectItem value="BUTTONS">Botões</SelectItem></SelectContent>
                            </Select>
                        )} />
                        {componentFields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(componentIndex)} className="h-7 w-7 text-destructive neu-button"><Trash2 className="w-4 h-4"/></Button>}
                    </div>
                    {(componentErrors as any)?.type && <p className="text-xs text-destructive mt-1">{(componentErrors as any).type.message}</p>}

                    {currentComponentType === 'HEADER' && ( /* ... como antes, com inputs para text ou example.header_handle ... */ )}
                    {currentComponentType === 'BODY' && ( /* ... como antes, com Textarea para text e inputs para example.body_text ... */ )}
                    {currentComponentType === 'FOOTER' && ( /* ... como antes, com Textarea para text ... */ )}
                    {currentComponentType === 'BUTTONS' && ( <TemplateButtonsSubForm componentIndex={componentIndex} control={control} register={register} watch={watch} errors={(componentErrors as any)?.buttons} setValue={setValue} getValues={getValues} /> )}
                     {(componentErrors as any) && typeof (componentErrors as any) !== 'boolean' && !Array.isArray((componentErrors as any)) && <p className="text-xs text-destructive mt-1">{(componentErrors as any).message || (componentErrors as any).root?.message}</p>}
                </Card>
              );})}
              <Button type="button" variant="outline" size="sm" onClick={() => appendComponent({ type: 'BODY', text: '', example: {} })} className="text-xs neu-button mt-2"><Plus className="w-3.5 h-3.5 mr-1.5"/> Adicionar Componente</Button>
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