import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Info,
  XCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface MessageTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL';
  components: TemplateComponent[];
  qualityScore?: {
    score: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    lastUpdatedTime?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'CATALOG';
  text: string;
  url?: string;
  phoneNumber?: string;
  couponCode?: string;
}

const initialTemplatesFromMock: MessageTemplate[] = [
  {
    id: 'welcome_message_123',
    name: 'welcome_message_123',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Bem-vindo à {{1}}!' },
      {
        type: 'BODY',
        text: 'Olá {{1}}, obrigado por se registrar! Seu código de verificação é {{2}}.'
      },
      { type: 'FOOTER', text: 'Atenciosamente, Equipe USB MKT PRO' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Preciso de Ajuda' }] }
    ],
    qualityScore: { score: 'GREEN' }
  }
];

const fetchTemplates = async (): Promise<MessageTemplate[]> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return JSON.parse(JSON.stringify(initialTemplatesFromMock));
};

const createTemplate = async (
  templateData: Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>
): Promise<MessageTemplate> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const newTemplate: MessageTemplate = {
    ...templateData,
    id: `template_${Date.now()}`,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  initialTemplatesFromMock.push(newTemplate);
  return newTemplate;
};

const deleteTemplateApi = async (templateId: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const index = initialTemplatesFromMock.findIndex((t) => t.id === templateId);
  if (index > -1) {
    initialTemplatesFromMock.splice(index, 1);
  } else {
    throw new Error('Template não encontrado para exclusão.');
  }
};

const defaultNewTemplateDataState: Partial<MessageTemplate> = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  components: [{ type: 'BODY', text: '' }, { type: 'BUTTONS', buttons: [] }]
};

export default function ZapTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplateData, setNewTemplateData] = useState<Partial<MessageTemplate>>(
    defaultNewTemplateDataState
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['zapTemplates'],
    queryFn: fetchTemplates
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: 'Template enviado para aprovação!', variant: 'default' });
      setIsModalOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro ao criar template',
        description: err.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: 'Template excluído!', variant: 'default' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro ao excluir template',
        description: err.message,
        variant: 'destructive'
      });
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTemplateData((prev) => ({ ...prev, [name]: value }));
  };

  const handleComponentChange = (
    index: number,
    field: keyof TemplateComponent,
    value: any
  ) => {
    setNewTemplateData((prev) => {
      const components = [...(prev.components || [])];
      const targetComponent = { ...components[index] };
      (targetComponent as any)[field] = value;
      components[index] = targetComponent;
      return { ...prev, components };
    });
  };

  const addComponent = (type: TemplateComponent['type']) => {
    let newComponent: TemplateComponent;
    switch (type) {
      case 'HEADER':
        newComponent = { type: 'HEADER', format: 'TEXT', text: '' };
        break;
      case 'BODY':
        newComponent = { type: 'BODY', text: '' };
        break;
      case 'FOOTER':
        newComponent = { type: 'FOOTER', text: '' };
        break;
      case 'BUTTONS':
        newComponent = {
          type: 'BUTTONS',
          buttons: [{ type: 'QUICK_REPLY', text: 'Nova Resposta' }]
        };
        break;
      default:
        return;
    }
    setNewTemplateData((prev) => ({
      ...prev,
      components: [...(prev.components || []), newComponent]
    }));
  };

  const removeComponent = (index: number) => {
    setNewTemplateData((prev) => ({
      ...prev,
      components: prev.components?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newTemplateData.name ||
      !newTemplateData.category ||
      !newTemplateData.language ||
      !newTemplateData.components?.some((c) => c.type === 'BODY' && c.text?.trim())
    ) {
      toast({
        title: 'Campos obrigatórios',
        description:
          'Nome, categoria, idioma e corpo da mensagem são obrigatórios.',
        variant: 'destructive'
      });
      return;
    }
    createMutation.mutate(
      newTemplateData as Omit<
        MessageTemplate,
        'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'
      >
    );
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between mb-4">
        <Input
          placeholder="Buscar templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-1/3"
        />
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Template
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : error ? (
        <div className="text-red-500">
          <AlertTriangle className="inline mr-1" /> Erro ao carregar templates
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription>{template.status}</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{template.components.find((c) => c.type === 'BODY')?.text}</p>
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingTemplate(template);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit2 className="mr-1 h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(template.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Criar Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Modifique os campos necessários.'
                : 'Preencha os detalhes do novo template.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Nome"
              name="name"
              value={newTemplateData.name || ''}
              onChange={handleInputChange}
              required
            />
            <Select
              value={newTemplateData.category}
              onValueChange={(v) =>
                setNewTemplateData((prev) => ({ ...prev, category: v as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utilitário</SelectItem>
                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Corpo da mensagem"
              name="body"
              value={
                newTemplateData.components?.find((c) => c.type === 'BODY')?.text || ''
              }
              onChange={(e) =>
                handleComponentChange(
                  newTemplateData.components?.findIndex((c) => c.type === 'BODY') ?? 0,
                  'text',
                  e.target.value
                )
              }
              required
            />
            <DialogFooter>
              <Button type="button" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
