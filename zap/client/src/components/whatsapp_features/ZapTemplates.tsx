// zap/client/src/components/whatsapp_features/ZapTemplates.tsx
// ... (importações, tipos, schemas Zod como na rodada anterior) ...
// As interfaces TemplateComponent, TemplateButton, ZapMessageTemplate já foram definidas.
// O templateFormSchema com superRefine já foi definido.

const ZapTemplates: React.FC = () => {
  const queryClientHook = useQueryClient();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ZapMessageTemplate | null>(null);

  const { control, register, handleSubmit, reset, watch, setValue, getValues, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', category: 'UTILITY', language: 'pt_BR', components: [{ type: 'BODY', text: '', example: {} }] }
  });

  const { fields: componentFields, append: appendComponent, remove: removeComponent } = useFieldArray({
    control, name: "components"
  });
  
  // Função para lidar com um array de botões aninhado DENTRO de um componente do tipo 'BUTTONS'
  // Você chamaria useFieldArray novamente para `components[componentIndex].buttons`
  // Esta é uma abordagem simplificada para o painel, a lógica real com useFieldArray aninhado é mais verbosa

  const { data: templates = [], isLoading: isLoadingTemplates, error: templatesError } = useQuery<ZapMessageTemplate[], ApiError>({ /* ... como antes ... */ });
  const templateMutation = useMutation<ZapMessageTemplate, ApiError, { id?: number, data: TemplateFormData }>({ /* ... como antes ... */ });
  const deleteTemplateMutation = useMutation<void, ApiError, number>({ /* ... como antes ... */ });

  const handleOpenFormModal = (template?: ZapMessageTemplate) => { /* ... como antes ... */ };
  const onFormSubmit = (data: TemplateFormData) => { /* ... como antes ... */ };
  const handleDeleteTemplate = (templateId: number) => { /* ... como antes ... */ };
  const getStatusMetaBadgeVariant = (status?: TemplateMetaStatus | null): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => { /* ... como antes ... */ return 'secondary' };
  
  return (
    <div className="space-y-6">
      {/* ... (Título da página e botão Criar Novo Template como antes) ... */}
      {/* ... (Loading, Erro, Nenhum template como antes) ... */}
      {/* ... (Grid de templates como antes) ... */}

      <Dialog open={isFormModalOpen} onOpenChange={(open) => { setIsFormModalOpen(open); if (!open) setEditingTemplate(null); }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl neu-card p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl">{editingTemplate ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle>
            <DialogDescription>Defina os componentes do seu modelo de mensagem.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <ScrollArea className="max-h-[70vh] p-1"> {/* Adicionado p-1 ao ScrollArea */}
            <div className="p-6 space-y-4">
              {/* ... (Campos Nome, Categoria, Idioma como antes) ... */}
              
              <Separator className="my-4"/>
              <Label className="text-md font-medium text-foreground block mb-2">Componentes do Template</Label>
              {componentFields.map((componentField, componentIndex) => {
                const currentComponentType = watch(`components.${componentIndex}.type`);
                return (
                <Card key={componentField.id} className="p-4 space-y-3 neu-inset-card mb-3 shadow-sm">
                    <div className="flex justify-between items-center">
                        <Controller name={`components.${componentIndex}.type`} control={control} render={({ field: typeField }) => (
                            <Select onValueChange={typeField.onChange} value={typeField.value}>
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
                    {errors.components?.[componentIndex]?.type && <p className="text-xs text-destructive mt-1">{errors.components?.[componentIndex]?.type?.message}</p>}

                    {/* Campos específicos por tipo de componente */}
                    {currentComponentType === 'HEADER' && (
                        <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2">
                            <Controller name={`components.${componentIndex}.format`} control={control} render={({ field: formatField }) => (
                                <Select onValueChange={formatField.onChange} value={formatField.value || 'TEXT'}>
                                <SelectTrigger className="w-full h-9 text-xs neu-input"><SelectValue placeholder="Formato do Cabeçalho" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TEXT">Texto</SelectItem><SelectItem value="IMAGE">Imagem</SelectItem>
                                    <SelectItem value="VIDEO">Vídeo</SelectItem><SelectItem value="DOCUMENT">Documento</SelectItem>
                                    {/* <SelectItem value="LOCATION">Localização</SelectItem> */}
                                </SelectContent>
                                </Select>
                            )} />
                            {watch(`components.${componentIndex}.format`) === 'TEXT' && (
                                <Textarea {...register(`components.${componentIndex}.text`)} placeholder="Texto do Cabeçalho (Max 60 chars). Use {{1}} para variável." rows={2} className="text-xs neu-input"/>
                            )}
                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(watch(`components.${componentIndex}.format`) || '') && (
                                <>
                                <Input {...register(`components.${componentIndex}.example.header_handle.0`)} placeholder="ID da Mídia (Ex: id_da_midia_pre_aprovada_ou_link)" className="text-xs h-8 neu-input"/>
                                <p className="text-xxs text-muted-foreground">Para mídias, forneça um link ou um ID de mídia previamente carregado e aprovado pela Meta.</p>
                                </>
                            )}
                        </div>
                    )}
                    {currentComponentType === 'BODY' && (
                        <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2">
                            <Textarea {...register(`components.${componentIndex}.text`)} placeholder="Texto do Corpo (Max 1024 chars). Use {{1}}, {{2}} para variáveis." rows={4} className="text-xs neu-input"/>
                            {errors.components?.[componentIndex]?.text && <p className="text-xs text-destructive mt-1">{errors.components?.[componentIndex]?.text?.message}</p>}
                            {/* TODO: Interface para adicionar 'example.body_text' se houver variáveis */}
                        </div>
                    )}
                    {currentComponentType === 'FOOTER' && (
                         <div className="pl-2 border-l-2 ml-2 space-y-2 pt-2">
                            <Textarea {...register(`components.${componentIndex}.text`)} placeholder="Texto do Rodapé (Max 60 chars)." rows={2} className="text-xs neu-input"/>
                         </div>
                    )}
                    {currentComponentType === 'BUTTONS' && (
                        <TemplateButtonsEditor componentIndex={componentIndex} control={control} register={register} watch={watch} setValue={setValue} getValues={getValues} errors={errors.components?.[componentIndex]?.buttons as any} />
                    )}
                </Card>
              );
            })}
              <Button type="button" variant="outline" size="sm" onClick={() => appendComponent({ type: 'BODY', text: '', example: {} })} className="text-xs neu-button mt-2">
                <Plus className="w-3.5 h-3.5 mr-1.5"/> Adicionar Componente
              </Button>
              {errors.components && typeof errors.components === 'object' && !Array.isArray(errors.components) && <p className="text-xs text-destructive mt-1">{(errors.components as any).message || (errors.components as any).root?.message}</p>}
            </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/30">
              <DialogClose asChild><Button type="button" variant="outline" className="neu-button">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={templateMutation.isPending} className="neu-button-primary">
                {templateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTemplate ? 'Salvar Template' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente aninhado para editar botões
interface TemplateButtonsEditorProps {
    componentIndex: number;
    control: any; register: any; watch: any; setValue: any; getValues: any; errors: any;
}
const TemplateButtonsEditor: React.FC<TemplateButtonsEditorProps> = ({ componentIndex, control, register, watch, setValue, getValues, errors }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `components.${componentIndex}.buttons`
    });

    return (
        <div className="space-y-2 pl-2 border-l-2 ml-2 pt-2">
            <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-medium text-muted-foreground">Botões (Máx. 3 Resposta Rápida OU 1-2 Ação)</Label>
                <Button type="button" variant="outline" size="xs" 
                    onClick={() => append({ type: 'QUICK_REPLY', text: '' })} 
                    className="text-xxs neu-button h-6 px-1.5"
                    disabled={fields.length >= 3}
                >
                    <Plus className="w-3 h-3 mr-1"/> Adicionar Botão
                </Button>
            </div>
            {fields.map((buttonField, buttonIndex) => {
                const buttonTypePath = `components.${componentIndex}.buttons.${buttonIndex}.type`;
                const currentButtonType = watch(buttonTypePath);
                return (
                    <Card key={buttonField.id} className="p-2.5 space-y-2 bg-card/60 dark:bg-background/60 neu-inset-card-sm">
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
                        <div>
                            <Label htmlFor={`btn-text-${componentIndex}-${buttonIndex}`} className="text-xxs">Texto do Botão* (Máx 25 chars)</Label>
                            <Input id={`btn-text-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.text` as const)} className="h-7 text-xxs neu-input mt-0.5"/>
                            {errors?.[buttonIndex]?.text && <p className="text-xxs text-destructive mt-0.5">{errors[buttonIndex].text.message}</p>}
                        </div>
                        
                        {currentButtonType === 'URL' && ( <>
                            <Label htmlFor={`btn-url-${componentIndex}-${buttonIndex}`} className="text-xxs">URL do Link*</Label>
                            <Input id={`btn-url-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.url` as const)} placeholder="https://..." className="h-7 text-xxs neu-input mt-0.5"/>
                            {errors?.[buttonIndex]?.url && <p className="text-xxs text-destructive mt-0.5">{errors[buttonIndex].url.message}</p>}
                            {/* TODO: Input para exemplo de URL dinâmica, se aplicável */}
                        </>)}
                        {currentButtonType === 'PHONE_NUMBER' && (<>
                            <Label htmlFor={`btn-phone-${componentIndex}-${buttonIndex}`} className="text-xxs">Número de Telefone*</Label>
                            <Input id={`btn-phone-${componentIndex}-${buttonIndex}`} {...register(`components.${componentIndex}.buttons.${buttonIndex}.phoneNumber` as const)} placeholder="+55119..." className="h-7 text-xxs neu-input mt-0.5"/>
                            {errors?.[buttonIndex]?.phoneNumber && <p className="text-xxs text-destructive mt-0.5">{errors[buttonIndex].phoneNumber.message}</p>}
                        </>)}
                    </Card>
                );
            })}
            {errors && typeof errors !== 'boolean' && !Array.isArray(errors) && <p className="text-xs text-destructive mt-1">{errors.message || errors.root?.message}</p>}
        </div>
    );
}

export default ZapTemplates;