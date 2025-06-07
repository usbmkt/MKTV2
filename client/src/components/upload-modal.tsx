// client/src/components/upload-modal.tsx
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, uploadFile } from '@/lib/api';
import {
  X,
  Loader2,
  Upload,
  FileImage,
  FileVideo,
  FileTextIcon as FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

// Schema para validação do formulário
const creativeSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  type: z.enum(['image', 'video', 'text', 'carousel'], {
    required_error: "Tipo é obrigatório",
  }),
  campaignId: z.preprocess(
    (val) => (val === "NONE" || val === null || val === undefined ? null : parseInt(String(val))), // Converter para null se 'NONE'
    z.number().nullable().optional() // Pode ser number ou null
  ),
  content: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  fileUrl: z.string().nullable().optional(), // Pode ser string, null ou undefined
}).refine(data => {
  if (data.type === 'text' && !data.content?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Conteúdo é obrigatório para criativos de texto.",
  path: ["content"],
});


// Interface para os dados do formulário
interface CreativeFormData {
  id?: number;
  name: string;
  type: 'image' | 'video' | 'text' | 'carousel';
  campaignId?: number | null; // Pode ser number ou null
  content?: string;
  platforms?: string[];
  fileUrl?: string | null; // Pode ser string ou null
}

interface Campaign {
  id: number; // ID da campanha é number no schema
  name: string;
}

interface UploadModalProps {
  onClose: () => void;
  onSuccess: (data: any) => void;
  onError?: (errorMessage: string) => void;
  initialData?: CreativeFormData;
}

const platformOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
];

export default function UploadModal({ onClose, onSuccess, onError, initialData }: UploadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.fileUrl || null);
  const [dragActive, setDragActive] = useState(false);

  const isEditing = !!initialData?.id;

  const form = useForm<CreativeFormData>({
    resolver: zodResolver(creativeSchema),
    defaultValues: {
      id: initialData?.id,
      name: initialData?.name || '',
      type: initialData?.type || 'image',
      campaignId: initialData?.campaignId === undefined ? null : initialData.campaignId, // Definir para null se undefined
      content: initialData?.content || '',
      platforms: initialData?.platforms || [],
      fileUrl: initialData?.fileUrl,
    },
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(form.getValues('platforms') || []);

  useEffect(() => {
    const currentType = form.getValues('type');
    if (selectedFile && currentType === 'image') {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (selectedFile && currentType === 'video') {
        // Não há preview de vídeo fácil, apenas limpar a URL do preview
        setPreviewUrl(null);
    } else if (!selectedFile && initialData?.fileUrl && currentType === 'image') {
        setPreviewUrl(initialData.fileUrl); // Manter preview do arquivo existente se nenhum novo for selecionado
    } else {
        setPreviewUrl(null); // Limpar preview em outros casos
    }
  }, [selectedFile, form.watch('type'), initialData?.fileUrl, initialData?.type]);


  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[], Error>({
    queryKey: ['campaignsForSelect'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || 'Falha ao buscar campanhas');
      }
      return response.json();
    },
  });

  const mutation = useMutation<any, Error, CreativeFormData>({
    mutationFn: async (data: CreativeFormData) => {
      // O Zod já validou a maioria dos campos, mas a lógica de arquivo é separada.

      // Construir payload que será enviado como campos do FormData
      const payload: Record<string, any> = {
        name: data.name,
        type: data.type,
        platforms: selectedPlatforms,
        // campaignId precisa ser string para FormData, ou null
        campaignId: data.campaignId === null ? "null" : (data.campaignId !== undefined ? String(data.campaignId) : undefined),
      };

      if (data.type === 'text') {
        payload.content = data.content;
        payload.fileUrl = null; // Criativos de texto não têm fileUrl
      } else {
        // Se o usuário removeu o arquivo existente (fileUrl = null no form), envie explicitamente null
        if (data.fileUrl === null) {
          payload.fileUrl = null;
        }
      }

      const apiPath = isEditing ? `/api/creatives/${data.id}` : '/api/creatives';
      let response;

      if (selectedFile) {
        // Se um novo arquivo foi selecionado, use uploadFile com o método apropriado
        response = await uploadFile(apiPath, selectedFile, payload, isEditing ? 'PUT' : 'POST');
      } else {
        // Se nenhum novo arquivo, ou é um criativo de texto, use apiRequest para JSON
        response = await apiRequest(isEditing ? 'PUT' : 'POST', apiPath, payload);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.statusText || response.status}` }));
        throw new Error(errorData.message || 'Erro ao salvar criativo');
      }
      return response.json();
    },
    onSuccess: (responseData) => {
      toast({
        title: 'Sucesso!',
        description: `O criativo foi ${isEditing ? 'atualizado' : 'salvo'} com sucesso.`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      onSuccess(responseData);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Salvar',
        description: error.message || `Não foi possível ${isEditing ? 'atualizar' : 'salvar'} o criativo.`,
        variant: 'destructive',
      });
      if (onError) {
        onError(error.message);
      }
      form.setError('root.serverError', { type: 'custom', message: error.message });
    },
  });

  const onSubmit = (data: CreativeFormData) => {
    const watchedType = form.getValues('type');
    const isFileBased = watchedType === 'image' || watchedType === 'video' || watchedType === 'carousel';

    // Validação para criativos baseados em arquivo
    if (isFileBased) {
      if (!isEditing && !selectedFile) { // Criando novo e precisa de arquivo
        form.setError('root.serverError', { type: 'custom', message: 'Por favor, selecione um arquivo para este tipo de criativo.' });
        toast({ title: 'Arquivo Faltando', description: 'Selecione um arquivo para o novo criativo.', variant: 'destructive' });
        return;
      }
      if (isEditing && !selectedFile && data.fileUrl === null) { // Editando, não selecionou novo, e marcou para remover o existente
        form.setError('root.serverError', { type: 'custom', message: 'Criativos baseados em arquivo devem ter um arquivo. Por favor, selecione um novo arquivo ou não remova o existente.' });
        toast({ title: 'Arquivo Faltando', description: 'Criativos baseados em arquivo precisam de um arquivo.', variant: 'destructive' });
        return;
      }
    }

    mutation.mutate(data);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const currentType = form.getValues('type');
      const fileMimeType = file.type;

      // Inferir tipo do criativo baseado no arquivo, se o tipo atual for 'text' ou genérico
      if (currentType === 'text' || !['image', 'video', 'carousel'].includes(currentType)) {
        if (fileMimeType.startsWith('image/')) {
          form.setValue('type', 'image', { shouldValidate: true });
        } else if (fileMimeType.startsWith('video/')) {
          form.setValue('type', 'video', { shouldValidate: true });
        } else {
          form.setValue('type', 'image', { shouldValidate: true }); // Fallback
        }
      } else { // Se já é um tipo de mídia, apenas confirmar se a inferência é necessária
        if (fileMimeType.startsWith('image/') && currentType !== 'image' && currentType !== 'carousel') {
          form.setValue('type', 'image', { shouldValidate: true });
        } else if (fileMimeType.startsWith('video/') && currentType !== 'video') {
          form.setValue('type', 'video', { shouldValidate: true });
        }
      }

      if (!form.getValues('name')) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        form.setValue('name', nameWithoutExt, { shouldValidate: true });
      }
      form.setValue('fileUrl', initialData?.fileUrl || null); // Redefinir fileUrl no formulário para o original ou null
    } else {
        // Se o arquivo foi deselecionado (clear), e estamos editando um criativo baseado em arquivo,
        // marque o fileUrl como null para que o backend remova o arquivo existente.
        const currentType = form.getValues('type');
        if (isEditing && (currentType === 'image' || currentType === 'video' || currentType === 'carousel')) {
            form.setValue('fileUrl', null, { shouldValidate: true });
            setPreviewUrl(null);
        }
    }
  };


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const getFileIcon = (type: string | undefined, hasFile: boolean) => {
    if (!hasFile) return <Upload className="w-10 h-10 text-muted-foreground"/>;
    switch(type) {
      case 'image': return <FileImage className="w-10 h-10 text-primary" />;
      case 'video': return <FileVideo className="w-10 h-10 text-primary" />;
      case 'text': return <FileText className="w-10 h-10 text-primary" />;
      case 'carousel': return <FileImage className="w-10 h-10 text-primary" />;
      default: return <Upload className="w-10 h-10 text-muted-foreground"/>;
    }
  };

  const watchedType = form.watch('type');
  // Determina se um arquivo é *necessário* para este tipo de criativo (não texto)
  // E se não estamos em modo de edição COM um arquivo existente, OU estamos criando um novo.
  const isFileNowRequired = (watchedType === 'image' || watchedType === 'video' || watchedType === 'carousel') &&
                           (!isEditing || (isEditing && form.getValues('fileUrl') === null)); // Se fileUrl foi setado para null, é necessário um novo


  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? 'Editar Criativo' : 'Novo Criativo'}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <DialogDescription>
            {isEditing ? 'Atualize os detalhes do seu criativo.' : 'Preencha os detalhes e faça upload do seu ativo.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 flex-grow overflow-y-auto pr-2 py-2 pl-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Nome *</FormLabel> <FormControl><Input placeholder="Ex: Banner V1" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="type" render={({ field }) => ( <FormItem> <FormLabel>Tipo *</FormLabel> <Select value={field.value} onValueChange={(value) => { field.onChange(value); if (value === 'text') { setSelectedFile(null); form.setValue('fileUrl', null); } else if (initialData?.fileUrl && !selectedFile) { form.setValue('fileUrl', initialData.fileUrl); } }} > <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="image">Imagem</SelectItem> <SelectItem value="video">Vídeo</SelectItem> <SelectItem value="text">Texto/Copy</SelectItem> <SelectItem value="carousel">Carrossel</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            </div>
            <FormField control={form.control} name="campaignId" render={({ field }) => ( <FormItem> <FormLabel>Campanha (Opcional)</FormLabel> <Select value={field.value === null || field.value === undefined ? "NONE" : String(field.value)} onValueChange={(value) => field.onChange(value === "NONE" ? null : parseInt(value))} > <FormControl><SelectTrigger disabled={isLoadingCampaigns}><SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Nenhuma"} /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="NONE">Nenhuma campanha</SelectItem> {campaigns.map((c: Campaign) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            <div> <FormLabel>Plataformas</FormLabel> <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 p-3 border rounded-md"> {platformOptions.map(p => (<label key={p.value} className="flex items-center"><input type="checkbox" checked={selectedPlatforms.includes(p.value)} onChange={e => { const newP = e.target.checked ? [...selectedPlatforms, p.value] : selectedPlatforms.filter(i => i !== p.value); setSelectedPlatforms(newP); form.setValue('platforms', newP, {shouldValidate: true});}} className="form-checkbox" /> <span className="ml-2 text-sm">{p.label}</span></label>))} </div> {form.formState.errors.platforms && <FormMessage>{form.formState.errors.platforms.message}</FormMessage>} </div>

            {watchedType === 'text' && ( <FormField control={form.control} name="content" render={({ field }) => ( <FormItem> <FormLabel>Conteúdo *</FormLabel> <FormControl><Textarea placeholder="Seu texto..." rows={5} {...field} /></FormControl> <FormMessage /> </FormItem> )} /> )}

            {/* Área de Upload de Arquivo */}
            {(watchedType === 'image' || watchedType === 'video' || watchedType === 'carousel') && (
              <div>
                <FormLabel>
                  Arquivo {isFileNowRequired ? '*' : '(Opcional: selecione para substituir)'}
                </FormLabel>
                {isEditing && initialData?.fileUrl && !selectedFile && form.getValues('fileUrl') !== null && (
                  <div className="mt-2 mb-2 text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                    <p className="font-semibold">Arquivo existente:</p>
                    <a href={initialData.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                      {initialData.fileUrl.split('/').pop()}
                    </a>
                    {initialData.type === 'image' && <img src={initialData.fileUrl} alt="Preview existente" className="mt-2 max-h-20 rounded"/>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-red-500 hover:bg-red-500/10"
                      onClick={() => {
                        setSelectedFile(null);
                        form.setValue('fileUrl', null, { shouldValidate: true }); // Marcar para remoção
                        setPreviewUrl(null);
                        toast({ title: 'Arquivo removido', description: 'O arquivo existente será removido ao salvar.', variant: 'destructive' });
                      }}
                    >
                      <X className="w-4 h-4 mr-1" /> Remover Arquivo Existente
                    </Button>
                  </div>
                )}
                <div
                  className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onClick={() => (document.getElementById('file-input-creative-edit') as HTMLInputElement)?.click()}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <input id="file-input-creative-edit" type="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    accept={ watchedType === 'image' || watchedType === 'carousel' ? 'image/*' : watchedType === 'video' ? 'video/*' : '*/*' }
                  />
                   <div className="flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                    {previewUrl && watchedType === 'image' ? (
                        <img src={previewUrl} alt="Preview" className="max-h-24 rounded-md"/>
                    ) : getFileIcon(watchedType, !!selectedFile || (isEditing && !!initialData?.fileUrl && form.getValues('fileUrl') !== null))}

                    {selectedFile ? (
                      <>
                        <p className="font-medium text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (isEditing && initialData?.fileUrl && form.getValues('fileUrl') !== null) ? (
                       <p className="text-sm">Arraste ou clique para <span className="font-semibold text-primary">substituir</span> o arquivo existente</p>
                    ) : (
                      <p className="text-sm">Arraste ou <span className="font-semibold text-primary">clique para selecionar</span></p>
                    )}
                    </div>
                </div>
                {isFileNowRequired && !selectedFile && form.getValues('fileUrl') === null && (
                    <FormMessage className="mt-1">Arquivo é obrigatório para este tipo.</FormMessage>
                )}
              </div>
            )}

            {form.formState.errors.root?.serverError && (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {form.formState.errors.root.serverError.message}
                </div>
            )}

            <DialogFooter className="flex-shrink-0 pt-5 sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  // Desabilitar se for necessário um arquivo e ele não foi selecionado nem existe um existente
                  (isFileNowRequired && !selectedFile && form.getValues('fileUrl') === null) ||
                  // Desabilitar se o formulário tem erros e já foi tentado submeter
                  (!form.formState.isValid && form.formState.isSubmitted)
                }
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Adicionar Criativo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
