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
import { api } from '@/lib/api'; // ✅ CORREÇÃO: Importando o objeto 'api'
import {
  X,
  Loader2,
  Upload,
  FileImage,
  FileVideo,
  FileTextIcon as FileText,
  AlertCircle,
} from 'lucide-react';

// ... (schemas e interfaces permanecem os mesmos) ...
const creativeSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  type: z.enum(['image', 'video', 'text', 'carousel'], {
    required_error: "Tipo é obrigatório",
  }),
  campaignId: z.preprocess(
    (val) => (val === "NONE" || val === null || val === undefined ? null : parseInt(String(val))),
    z.number().nullable().optional()
  ),
  content: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  fileUrl: z.string().nullable().optional(),
}).refine(data => {
  if (data.type === 'text' && !data.content?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Conteúdo é obrigatório para criativos de texto.",
  path: ["content"],
});

interface CreativeFormData {
  id?: number;
  name: string;
  type: 'image' | 'video' | 'text' | 'carousel';
  campaignId?: number | null;
  content?: string;
  platforms?: string[];
  fileUrl?: string | null;
}

interface Campaign {
  id: number;
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
      campaignId: initialData?.campaignId === undefined ? null : initialData.campaignId,
      content: initialData?.content || '',
      platforms: initialData?.platforms || [],
      fileUrl: initialData?.fileUrl,
    },
  });
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(form.getValues('platforms') || []);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [selectedFile]);

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[], Error>({
    queryKey: ['campaignsForSelect'],
     queryFn: () => api.get<Campaign[]>('/api/campaigns'), // ✅ CORREÇÃO: Usando api.get
  });

  const mutation = useMutation<any, Error, { data: CreativeFormData, file?: File | null }>({
    mutationFn: async ({ data, file }) => {
      const payload: Record<string, any> = {
        name: data.name,
        type: data.type,
        platforms: data.platforms,
        campaignId: data.campaignId,
        content: data.content,
      };

      const endpoint = isEditing ? `/api/creatives/${data.id}` : '/api/creatives';
      const method = isEditing ? 'PUT' : 'POST';
      
      if (file) {
        // ✅ CORREÇÃO: Usando api.upload
        return api.upload(endpoint, file, payload, method);
      } else {
        // Enviar como JSON se não houver arquivo novo
        return api.request(method, endpoint, { ...payload, fileUrl: data.fileUrl });
      }
    },
    onSuccess: (responseData) => {
      toast({
        title: 'Sucesso!',
        description: `O criativo foi ${isEditing ? 'atualizado' : 'salvo'} com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['creatives'] });
      onSuccess(responseData);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Salvar',
        description: error.message,
        variant: 'destructive',
      });
       if (onError) onError(error.message);
    },
  });

  const onSubmit = (data: CreativeFormData) => {
    mutation.mutate({ data, file: selectedFile });
  };
  
  // O resto do componente (lógica de UI, etc.) permanece o mesmo...
  // ... (Cole aqui o restante do seu componente UploadModal.tsx) ...
  // Como o restante do arquivo é grande e não muda, vou omiti-lo por brevidade,
  // mas as mudanças principais estão na importação e nas chamadas de query/mutation.
  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const currentType = form.getValues('type');
      if (currentType === 'text') {
        if (file.type.startsWith('image/')) form.setValue('type', 'image');
        else if (file.type.startsWith('video/')) form.setValue('type', 'video');
      }
      if (!form.getValues('name')) {
        form.setValue('name', file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
      }
    }
  };
   const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true); else if (e.type === 'dragleave') setDragActive(false); };
   const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]); };
   const getFileIcon = (type: string | undefined, hasFile: boolean) => { if (!hasFile) return <Upload className="w-10 h-10 text-muted-foreground"/>; switch(type) { case 'image': return <FileImage className="w-10 h-10 text-primary" />; case 'video': return <FileVideo className="w-10 h-10 text-primary" />; case 'text': return <FileText className="w-10 h-10 text-primary" />; case 'carousel': return <FileImage className="w-10 h-10 text-primary" />; default: return <Upload className="w-10 h-10 text-muted-foreground"/>; } };
   const watchedType = form.watch('type');
  
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
              <FormField control={form.control} name="type" render={({ field }) => ( <FormItem> <FormLabel>Tipo *</FormLabel> <Select value={field.value} onValueChange={field.onChange} > <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="image">Imagem</SelectItem> <SelectItem value="video">Vídeo</SelectItem> <SelectItem value="text">Texto/Copy</SelectItem> <SelectItem value="carousel">Carrossel</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            </div>
            <FormField control={form.control} name="campaignId" render={({ field }) => ( <FormItem> <FormLabel>Campanha (Opcional)</FormLabel> <Select value={field.value === null || field.value === undefined ? "NONE" : String(field.value)} onValueChange={(value) => field.onChange(value === "NONE" ? null : parseInt(value))} > <FormControl><SelectTrigger disabled={isLoadingCampaigns}><SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Nenhuma"} /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="NONE">Nenhuma campanha</SelectItem> {campaigns.map((c: Campaign) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            <div> <FormLabel>Plataformas</FormLabel> <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 p-3 border rounded-md"> {platformOptions.map(p => (<label key={p.value} className="flex items-center"><input type="checkbox" checked={selectedPlatforms.includes(p.value)} onChange={e => { const newP = e.target.checked ? [...selectedPlatforms, p.value] : selectedPlatforms.filter(i => i !== p.value); setSelectedPlatforms(newP); form.setValue('platforms', newP, {shouldValidate: true});}} className="form-checkbox" /> <span className="ml-2 text-sm">{p.label}</span></label>))} </div> {form.formState.errors.platforms && <FormMessage>{form.formState.errors.platforms.message}</FormMessage>} </div>

            {watchedType === 'text' && ( <FormField control={form.control} name="content" render={({ field }) => ( <FormItem> <FormLabel>Conteúdo *</FormLabel> <FormControl><Textarea placeholder="Seu texto..." rows={5} {...field} /></FormControl> <FormMessage /> </FormItem> )} /> )}

            {(watchedType === 'image' || watchedType === 'video' || watchedType === 'carousel') && (
              <div>
                <FormLabel>Arquivo {isEditing && initialData?.fileUrl ? '(Opcional: selecione para substituir)' : '*'}</FormLabel>
                <div
                  className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onClick={() => (document.getElementById('file-input-creative') as HTMLInputElement)?.click()}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <input id="file-input-creative" type="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    accept={ watchedType === 'image' || watchedType === 'carousel' ? 'image/*' : 'video/*' }
                  />
                   <div className="flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="max-h-24 rounded-md"/>
                    ) : getFileIcon(watchedType, !!selectedFile || (isEditing && !!initialData?.fileUrl))}

                    {selectedFile ? (
                      <>
                        <p className="font-medium text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <p className="text-sm">Arraste ou <span className="font-semibold text-primary">clique para selecionar</span></p>
                    )}
                    </div>
                </div>
              </div>
            )}
             {form.formState.errors.root?.serverError && ( <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{form.formState.errors.root.serverError.message}</div> )}
            <DialogFooter className="flex-shrink-0 pt-5 sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
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
