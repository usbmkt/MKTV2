// zap/client/src/components/whatsapp_features/ZapTemplates.tsx
// ... (importações como antes, incluindo useFieldArray, Controller de react-hook-form) ...

// ... (interfaces ZapMessageTemplate, TemplateComponent, TemplateButton como antes) ...

// Schema Zod para um único botão
const templateButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP']),
  text: z.string().min(1, "Texto do botão é obrigatório.").max(25, "Máx 25 chars."), // Limite do WhatsApp
  url: z.string().url("URL inválida.").optional().or(z.literal('')),
  phoneNumber: z.string().optional(), // Adicionar validação específica de telefone
  // Campos OTP, etc. podem ser adicionados aqui
  example: z.array(z.string()).optional(), // Para URL dinâmica
});

// Schema Zod para um único componente
const templateComponentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).optional(),
  text: z.string().optional(),
  // Validação para botões: no máximo 3 botões de resposta rápida OU (até 2 botões de call-to-action + 1 de resposta rápida)
  // Esta validação complexa é melhor feita com .superRefine ou .refine no schema principal.
  buttons: z.array(templateButtonSchema).max(3, "Máximo de 3 botões por grupo.").optional(),
  example: z.object({ // Objeto para exemplos, conforme API da Meta
    header_handle: z.array(z.string()).optional(), // Para HEADER IMAGE/VIDEO/DOCUMENT
    header_text: z.array(z.string()).optional(),   // Para HEADER TEXT com variáveis
    body_text: z.array(z.array(z.string())).optional(), // Array de arrays para variáveis no BODY
    // Adicionar outros exemplos de buttons aqui se necessário
  }).optional().default({}),
});

const templateFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter >= 3 chars.").regex(/^[a-z0-9_]+$/, "Nome: minúsculas, números, underscores."),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().min(2, "Código do idioma obrigatório (ex: pt_BR)."),
  components: z.array(templateComponentSchema)
    .min(1, "Pelo menos um componente (ex: BODY) é necessário.")
    .superRefine((components, ctx) => {
        const bodyComponent = components.find(c => c.type === 'BODY');
        if (!bodyComponent) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Um componente BODY é obrigatório.",
                path: ['components'], // Path geral para o array de componentes
            });
        }
        const buttonComponents = components.filter(c => c.type === 'BUTTONS');
        if (buttonComponents.length > 1) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas um grupo de BOTÕES é permitido.", path: ['components']});
        }
        buttonComponents.forEach((bc, index) => {
            const quickReplies = bc.buttons?.filter(b => b.type === 'QUICK_REPLY').length || 0;
            const callToActions = bc.buttons?.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER').length || 0;
            if (quickReplies > 0 && callToActions > 0) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Não misture botões de Resposta Rápida com Chamada para Ação.", path: [`components.${components.findIndex(c => c === bc)}.buttons`]});
            }
            if (quickReplies > 3) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo de 3 botões de Resposta Rápida.", path: [`components.${components.findIndex(c => c === bc)}.buttons`]});
            }
            if (callToActions > 2) { // Meta permite até 2 CTAs (URL/PHONE) OU até 10 botões de Marketing (com certas condições)
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo de 2 botões de Chamada para Ação (URL/Telefone).", path: [`components.${components.findIndex(c => c === bc)}.buttons`]});
            }
        });
    }),
});
type TemplateFormData = z.infer<typeof templateFormSchema>;


const ZapTemplates: React.FC = () => {
  // ... (useState, useQuery, mutations como antes) ...
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', category: 'UTILITY', language: 'pt_BR', components: [{ type: 'BODY', text: '', example: {} }] }
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: "components" });

  // ... (handleOpenFormModal, onFormSubmit, handleDeleteTemplate, getStatusMetaBadgeVariant como antes) ...
  
  // Lógica para adicionar um sub-botão a um componente de BOTÕES
  const addTemplateButton = (componentIndex: number) => {
    const currentComponent = watch(`components.${componentIndex}`);
    if (currentComponent.type === 'BUTTONS') {
        const currentButtons = currentComponent.buttons || [];
        // @ts-ignore - setValue aninhado
        setValue(`components.${componentIndex}.buttons`, [...currentButtons, { type: 'QUICK_REPLY', text: '' }], { shouldValidate: true });
    }
  };

  const removeTemplateButton = (componentIndex: number, buttonIndex: number) => {
    const currentComponent = watch(`components.${componentIndex}`);
    if (currentComponent.type === 'BUTTONS' && currentComponent.buttons) {
        const updatedButtons = currentComponent.buttons.filter((_, idx) => idx !== buttonIndex);
        // @ts-ignore
        setValue(`components.${componentIndex}.buttons`, updatedButtons, { shouldValidate: true });
    }
  };


  // Dentro do JSX do Modal (DialogContent), na seção de componentes:
  // {fields.map((field, index) => (
  //   <Card key={field.id} className="p-4 space-y-3 neu-inset-card">
  //     {/* ... (seleção de tipo de componente e botão de remover componente) ... */}
  //     {watch(`components.${index}.type`) === 'HEADER' && (
  //       <Controller name={`components.${index}.format`} control={control} render={({ field: formatField }) => (
  //         <Select onValueChange={formatField.onChange} value={formatField.value}> {/* ... Formatos HEADER ... */} </Select>
  //       )} />
  //     )}
  //     {(watch(`components.${index}.type`) === 'HEADER' && watch(`components.${index}.format`) === 'TEXT' || watch(`components.${index}.type`) === 'BODY' || watch(`components.${index}.type`) === 'FOOTER') && (
  //       <>
  //          <Textarea {...register(`components.${index}.text`)} placeholder="Texto do componente... Use {{1}}, {{2}} para variáveis." rows={3} className="text-xs neu-input mt-1"/>
  //          {errors.components?.[index]?.text && <p className="text-xs text-destructive mt-1">{errors.components?.[index]?.text?.message}</p>}
  //          {/* TODO: Input para example.body_text ou header_text se houver variáveis */}
  //       </>
  //     )}
  //     {watch(`components.${index}.type`) === 'BUTTONS' && (
  //       <div className="space-y-2 pl-2 border-l-2">
  //           <Label className="text-xxs text-muted-foreground">Botões:</Label>
  //           {watch(`components.${index}.buttons`)?.map((button, buttonIndex) => (
  //               <Card key={`comp-${index}-btn-${buttonIndex}`} className="p-2 space-y-1.5 bg-card/30">
  //                   <div className="flex justify-between items-center">
  //                       <Controller name={`components.${index}.buttons.${buttonIndex}.type`} control={control} render={({field: btnTypeField}) => (
  //                           <Select onValueChange={btnTypeField.onChange} value={btnTypeField.value}>
  //                               <SelectTrigger className="h-7 text-xxs w-[150px]"><SelectValue placeholder="Tipo Botão"/></SelectTrigger>
  //                               <SelectContent>
  //                                   <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
  //                                   <SelectItem value="URL">Link (URL)</SelectItem>
  //                                   <SelectItem value="PHONE_NUMBER">Ligar (Telefone)</SelectItem>
  //                                   <SelectItem value="COPY_CODE">Copiar Código</SelectItem>
  //                               </SelectContent>
  //                           </Select>
  //                       )}/>
  //                       <Button type="button" variant="ghost" size="icon" onClick={() => removeTemplateButton(index, buttonIndex)} className="h-6 w-6 text-destructive"><Trash2 className="w-3 h-3"/></Button>
  //                   </div>
  //                   <Input {...register(`components.${index}.buttons.${buttonIndex}.text`)} placeholder="Texto do Botão" className="h-7 text-xxs"/>
  //                   {errors.components?.[index]?.buttons?.[buttonIndex]?.text && <p className="text-xxs text-destructive">{errors.components?.[index]?.buttons?.[buttonIndex]?.text?.message}</p>}
  //                   {watch(`components.${index}.buttons.${buttonIndex}.type`) === 'URL' && (
  //                       <Input {...register(`components.${index}.buttons.${buttonIndex}.url`)} placeholder="https://exemplo.com" className="h-7 text-xxs"/>
  //                   )}
  //                   {watch(`components.${index}.buttons.${buttonIndex}.type`) === 'PHONE_NUMBER' && (
  //                       <Input {...register(`components.${index}.buttons.${buttonIndex}.phoneNumber`)} placeholder="+5511999998888" className="h-7 text-xxs"/>
  //                   )}
  //               </Card>
  //           ))}
  //           <Button type="button" variant="outline" size="xs" onClick={() => addTemplateButton(index)} className="text-xxs neu-button w-full">Adicionar Botão</Button>
  //           {errors.components?.[index]?.buttons && typeof errors.components?.[index]?.buttons !== 'boolean' && !Array.isArray(errors.components?.[index]?.buttons) && <p className="text-xs text-destructive mt-1">{(errors.components?.[index]?.buttons as any)?.message || (errors.components?.[index]?.buttons as any)?.root?.message}</p>}
  //       </div>
  //     )}
  //     {/* ... erros para o componente ... */}
  //   </Card>
  // ))}
  // {/* ... Botão Adicionar Componente e Erros gerais de componentes ... */}