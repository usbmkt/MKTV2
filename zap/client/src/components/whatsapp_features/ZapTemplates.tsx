import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Verify path
import { Button } from '@/components/ui/button'; // Verify path
import { Badge } from '@/components/ui/badge'; // Verify path
import { Input } from '@/components/ui/input'; // Verify path
import { Label } from '@/components/ui/label'; // Verify path
import { Textarea } from '@/components/ui/textarea'; // Verify path
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // Verify path
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'; // Verify path
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'; // Verify path
import { Alert, AlertDescription } from '@/components/ui/alert'; // Verify path
import { Plus, Edit2, Trash2, Search, MessageSquare, Loader2, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/toast'; // Verify path - Changed from use-toast

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
  example?: string[];
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
      { type: 'BODY', text: 'Olá {{1}}, obrigado por se registrar! Seu código de verificação é {{2}}. Use este código para ativar sua conta. Se precisar de ajuda, responda a esta mensagem.' },
      { type: 'FOOTER', text: 'Atenciosamente, Equipe USB MKT PRO' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Preciso de Ajuda' }] }
    ],
    qualityScore: { score: 'GREEN' }
  },
];

const fetchTemplates = async (): Promise<MessageTemplate[]> => {
  console.log("Buscando templates (simulado)...");
  await new Promise(resolve => setTimeout(resolve, 500));
  return JSON.parse(JSON.stringify(initialTemplatesFromMock));
};

const createTemplate = async (templateData: Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> => {
  console.log("Criando template (simulado):", templateData);
  await new Promise(resolve => setTimeout(resolve, 500));
  const newTemplate: MessageTemplate = {
    ...templateData,
    id: `template_${Date.now()}`,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  initialTemplatesFromMock.push(newTemplate);
  return newTemplate;
};

const deleteTemplateApi = async (templateId: string): Promise<void> => {
  console.log("Deletando template (simulado):", templateId);
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = initialTemplatesFromMock.findIndex(t => t.id === templateId);
  if (index > -1) {
    initialTemplatesFromMock.splice(index, 1);
  } else {
    throw new Error("Template não encontrado para exclusão.");
  }
};

const defaultNewTemplateDataState: Partial<MessageTemplate> = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  components: [
    { type: 'BODY', text: '' },
    // Ensure BUTTONS component is initialized if you always expect it,
    // or handle its potential absence more explicitly in the rendering logic.
    // For now, keeping it as per original logic where it might be added later.
    // { type: 'BUTTONS', buttons: [] }
  ]
};

export default function ZapTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplateData, setNewTemplateData] = useState<Partial<MessageTemplate>>(
    JSON.parse(JSON.stringify(defaultNewTemplateDataState)) // Deep copy for initial state
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery<MessageTemplate[]>({
    queryKey: ['zapTemplates'],
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation<MessageTemplate, Error, Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>>({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: "Template enviado para aprovação!", variant: "default" });
      setIsModalOpen(false);
      // Reset form after successful creation
      setNewTemplateData(JSON.parse(JSON.stringify(defaultNewTemplateDataState)));
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar template", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteTemplateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: "Template excluído!", variant: "default" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir template", description: err.message, variant: "destructive" });
    }
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { // Removed HTMLSelectElement as it's handled by onValueChange
    const { name, value } = e.target;
    setNewTemplateData(prev => ({ ...prev, [name]: value }));
  };

  const handleComponentChange = (index: number, field: keyof TemplateComponent, value: any) => {
    setNewTemplateData(prev => {
      const components = prev.components ? [...prev.components] : [];
      // Ensure component exists
      if (components[index]) {
        const targetComponent = { ...components[index] };
        (targetComponent as any)[field] = value;
        components[index] = targetComponent;
        return { ...prev, components };
      }
      return prev; // Should not happen if logic is correct
    });
  };

  const addComponent = (type: TemplateComponent['type']) => {
    let newComponent: TemplateComponent;
    switch (type) {
      case 'HEADER': newComponent = { type: 'HEADER', format: 'TEXT', text: '' }; break;
      case 'BODY': newComponent = { type: 'BODY', text: '' }; break; // Should always exist based on default state
      case 'FOOTER': newComponent = { type: 'FOOTER', text: '' }; break;
      case 'BUTTONS': newComponent = { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Resposta Rápida' }] }; break;
      default: return;
    }
    setNewTemplateData(prev => ({ ...prev, components: [...(prev.components || []), newComponent] }));
  };

  const removeComponent = (index: number) => {
    setNewTemplateData(prev => ({ ...prev, components: prev.components?.filter((_, i) => i !== index) }));
  };

  const handleButtonChange = (compIndex: number, btnIndex: number, field: keyof TemplateButton, value: string | TemplateButton['type']) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || []));
      if (components[compIndex]?.buttons && components[compIndex].buttons[btnIndex]) {
        (components[compIndex].buttons[btnIndex] as any)[field] = value;
      }
      return { ...prev, components };
    });
  };

  const addTemplateButton = (compIndex: number) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || []));
      if (components[compIndex]) {
        if (!components[compIndex].buttons) {
          components[compIndex].buttons = [];
        }
        // Ensure we don't exceed max buttons (typically 3 for WhatsApp)
        if (components[compIndex].buttons.length < 3) {
             components[compIndex].buttons.push({ type: 'QUICK_REPLY', text: 'Nova Resposta' });
        } else {
            toast({ title: "Limite de botões atingido", description: "Você pode adicionar no máximo 3 botões.", variant: "default"});
        }
      }
      return { ...prev, components };
    });
  };

  const removeTemplateButton = (compIndex: number, btnIndex: number) => {
    setNewTemplateData(prev => {
      const components = JSON.parse(JSON.stringify(prev.components || []));
      if (components[compIndex]?.buttons) {
        components[compIndex].buttons.splice(btnIndex, 1);
      }
      return { ...prev, components };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!newTemplateData.name?.trim() || !newTemplateData.category || !newTemplateData.language || !newTemplateData.components?.some(c => c.type === 'BODY' && c.text?.trim())) {
      toast({ title: "Campos obrigatórios", description: "Nome, categoria, idioma e corpo da mensagem são obrigatórios.", variant: "destructive" });
      return;
    }
    // Validate template name format (lowercase, numbers, underscores)
    if (newTemplateData.name && !/^[a-z0-9_]+$/.test(newTemplateData.name)) { // Added check for name existence
        toast({ title: "Nome do Template Inválido", description: "Use apenas letras minúsculas, números e underscores (sem espaços).", variant: "destructive" });
        return;
    }

    // Ensure components is not undefined before passing to mutation
    const templateToSubmit = {
        ...newTemplateData,
        components: newTemplateData.components || [] // Ensure components is an array
    } as Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>;


    createMutation.mutate(templateToSubmit);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeClass = (status: MessageTemplate['status']) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700 border-green-300';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getQualityScoreBadgeClass = (score?: MessageTemplate['qualityScore'] | null) => {
    if (!score || !score.score) return 'bg-gray-100 text-gray-700 border-gray-300';
    switch (score.score) {
      case 'GREEN': return 'bg-green-100 text-green-700 border-green-300';
      case 'YELLOW': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'RED': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const handleModalOpenChange = (isOpen: boolean) => {
    setIsModalOpen(isOpen);
    if (!isOpen) {
      setEditingTemplate(null);
      setNewTemplateData(JSON.parse(JSON.stringify(defaultNewTemplateDataState))); // Deep copy reset
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      if (editingTemplate) {
        // Deep copy editing template to avoid direct state mutation issues
        setNewTemplateData(JSON.parse(JSON.stringify(editingTemplate)));
      } else {
        // Deep copy default state when creating new
        setNewTemplateData(JSON.parse(JSON.stringify(defaultNewTemplateDataState)));
      }
    }
    // Not resetting when modal closes here, handleModalOpenChange does it.
  }, [editingTemplate, isModalOpen]);


  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Carregando templates...</div>;
  if (error) return <div className="p-4 text-center text-red-500"><AlertTriangle className="w-6 h-6 mx-auto mb-2" />Erro ao carregar templates: {(error as Error).message}</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Templates de Mensagem</h2>
          <p className="text-sm text-gray-500">Gerencie templates aprovados pelo WhatsApp</p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(null);
            // Ensure form is reset for new template
            setNewTemplateData(JSON.parse(JSON.stringify(defaultNewTemplateDataState)));
            setIsModalOpen(true);
          }}
          className="neu-button bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <Card className="neu-card shadow-md">
        <CardHeader className="border-b border-gray-200 p-4"> {/* Adjusted padding */}
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar templates por nome..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="neu-input max-w-sm text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum template encontrado.</p>
              <p className="text-sm">Tente ajustar sua busca ou crie um novo template.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="neu-card hover:shadow-lg transition-shadow duration-200 ease-in-out overflow-hidden"> {/* Added overflow-hidden */}
                  <CardHeader className="pb-3 border-b border-gray-100 p-4"> {/* Adjusted padding */}
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-semibold text-gray-700 truncate" title={template.name}>{template.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1 h-7 neu-button text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"> {/* Added hover bg and rounded */}
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="neu-card-dropdown w-40"> {/* Adjusted width */}
                          <DropdownMenuItem onClick={() => {
                            setEditingTemplate(template);
                            setIsModalOpen(true);
                          }} className="text-sm hover:bg-gray-100"> {/* Added text-sm and hover */}
                            <Edit2 className="mr-2 h-3.5 w-3.5 text-blue-500" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-sm text-red-500 hover:!text-red-600 hover:!bg-red-50" onClick={() => deleteMutation.mutate(template.id)} disabled={deleteMutation.isPending && deleteMutation.variables === template.id}>  {/* Added text-sm and hover */}
                            {deleteMutation.isPending && deleteMutation.variables === template.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                             Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center space-x-2 text-xs mt-1">
                      <Badge variant="outline" className={`${getStatusBadgeClass(template.status)} px-1.5 py-0.5 text-xs font-medium`}>{template.status}</Badge> {/* Added font-medium */}
                      {template.qualityScore && (
                        <Badge variant="outline" className={`${getQualityScoreBadgeClass(template.qualityScore)} px-1.5 py-0.5 text-xs font-medium`}> {/* Added font-medium */}
                          Qualidade: {template.qualityScore.score}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs pt-3 pb-4 px-4">
                    <p><strong className="font-medium text-gray-600">Categoria:</strong> <span className="text-gray-500">{template.category}</span></p>
                    <p><strong className="font-medium text-gray-600">Idioma:</strong> <span className="text-gray-500">{template.language}</span></p>
                    <div className="mt-2">
                      <p className="font-medium text-gray-600 mb-1">Corpo da Mensagem:</p>
                      <p className="text-gray-500 bg-gray-50 p-2 rounded text-xs line-clamp-3">
                        {template.components.find(c => c.type === 'BODY')?.text || <span className="italic">Corpo não definido</span>}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col neu-dialog bg-white rounded-lg shadow-xl"> {/* Enhanced Dialog Style */}
          <DialogHeader className="p-6 pb-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-800">{editingTemplate ? 'Editar Template' : 'Criar Novo Template de Mensagem'}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              {editingTemplate ? `Modificando o template "${editingTemplate.name}".` : 'Os templates precisam ser aprovados pelo WhatsApp antes do uso.'}
            </DialogDescription>
          </DialogHeader>
          {/* Form element with ID for external submit button */}
          <form id="template-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="template-name" className="text-xs font-medium text-gray-700">Nome do Template*</Label>
                <Input
                  id="template-name"
                  name="name"
                  value={newTemplateData.name || ''}
                  onChange={handleInputChange}
                  placeholder="Ex: promocao_natal_2024"
                  className="neu-input text-sm"
                  required
                  pattern="[a-z0-9_]+"
                  title="Apenas letras minúsculas, números e underscores."
                />
                <p className="text-xs text-gray-500">Apenas letras minúsculas, números e underscores.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-category" className="text-xs font-medium text-gray-700">Categoria*</Label>
                <Select
                  name="category"
                  value={newTemplateData.category || 'UTILITY'}
                  onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, category: value as MessageTemplate['category'] }))}
                >
                  <SelectTrigger id="template-category" className="neu-input text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="neu-select-content">
                    <SelectItem value="MARKETING" className="text-sm">Marketing</SelectItem>
                    <SelectItem value="UTILITY" className="text-sm">Utilitário</SelectItem>
                    <SelectItem value="AUTHENTICATION" className="text-sm">Autenticação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-language" className="text-xs font-medium text-gray-700">Idioma*</Label>
                <Select
                  name="language"
                  value={newTemplateData.language || 'pt_BR'}
                  onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger id="template-language" className="neu-input text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="neu-select-content">
                    <SelectItem value="pt_BR" className="text-sm">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US" className="text-sm">Inglês (EUA)</SelectItem>
                    <SelectItem value="es_ES" className="text-sm">Espanhol (Espanha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="neu-card-inset bg-gray-50 border border-gray-200">
              <CardHeader className="pb-2 pt-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-700">Componentes do Template</CardTitle>
                <CardDescription className="text-xs text-gray-500">Defina o conteúdo da sua mensagem.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(newTemplateData.components || []).map((comp, compIndex) => {
                  if (!comp) return null;
                  return (
                    <div key={compIndex} className="p-3 border border-gray-200 rounded-md bg-white space-y-2 shadow-sm">
                      <div className="flex justify-between items-center">
                        <Badge variant="secondary" className="text-xs font-medium">{comp.type}</Badge> {/* Added font-medium */}
                        {comp.type !== 'BODY' && ( // BODY component is mandatory and should not be removable
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full" /* Added hover bg and rounded-full */
                            onClick={() => removeComponent(compIndex)}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {comp.type === 'HEADER' && (
                        <Select
                          value={comp.format || 'TEXT'}
                          onValueChange={(value: string) => handleComponentChange(compIndex, 'format', value as TemplateComponent['format'])}
                        >
                          <SelectTrigger className="text-xs neu-input h-8"><SelectValue /></SelectTrigger>
                          <SelectContent className="neu-select-content">
                            <SelectItem value="TEXT" className="text-xs">Texto</SelectItem>
                            <SelectItem value="IMAGE" className="text-xs">Imagem</SelectItem>
                            <SelectItem value="VIDEO" className="text-xs">Vídeo</SelectItem>
                            <SelectItem value="DOCUMENT" className="text-xs">Documento</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {((comp.type === 'HEADER' && comp.format === 'TEXT') || comp.type === 'BODY' || comp.type === 'FOOTER') && (
                        <Textarea
                          placeholder={`Conteúdo para ${comp.type.toLowerCase()}`}
                          value={comp.text || ''}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleComponentChange(compIndex, 'text', e.target.value)}
                          rows={comp.type === 'BODY' ? 4 : (comp.type === 'HEADER' ? 2 : 1)}
                          className="text-sm neu-input"
                          maxLength={comp.type === 'BODY' ? 1024 : (comp.type === 'HEADER' ? 60 : (comp.type === 'FOOTER' ? 60 : undefined))}
                        />
                      )}
                      {comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT') && (
                        <div className="text-xs text-gray-500 p-2 border border-dashed border-gray-300 rounded bg-gray-50/50">
                          <Info className="w-3 h-3 inline mr-1 text-blue-500" />
                          {comp.format === 'IMAGE' ? 'Para Imagem: Forneça um link de exemplo (opcional) ou adicione via API ao enviar.' :
                            comp.format === 'VIDEO' ? 'Para Vídeo: Forneça um link de exemplo (opcional) ou adicione via API.' :
                              'Para Documento: Forneça um nome de arquivo de exemplo (opcional).'}
                          <Input
                            type="text"
                            placeholder="Link/nome de exemplo (opcional)"
                            value={(comp.example?.header_handle || [])[0] || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleComponentChange(compIndex, 'example', { ...comp.example, header_handle: [e.target.value] })}
                            className="text-xs mt-1 neu-input h-7"
                          />
                        </div>
                      )}
                      {comp.type === 'BUTTONS' && comp.buttons && (
                        <div className="space-y-2 pt-1">
                          {comp.buttons.map((btn, btnIndex) => (
                            <div key={btnIndex} className="p-2 border border-gray-200 rounded bg-gray-50/70 space-y-1.5 shadow-xs">
                              <div className="flex justify-between items-center">
                                <Select
                                  value={btn.type}
                                  onValueChange={(value: string) => handleButtonChange(compIndex, btnIndex, 'type', value as TemplateButton['type'])}
                                >
                                  <SelectTrigger className="text-xs neu-input h-8 w-auto sm:w-40 flex-grow sm:flex-grow-0"><SelectValue /></SelectTrigger>
                                  <SelectContent className="neu-select-content">
                                    <SelectItem value="QUICK_REPLY" className="text-xs">Resposta Rápida</SelectItem>
                                    <SelectItem value="URL" className="text-xs">Link (URL)</SelectItem>
                                    <SelectItem value="PHONE_NUMBER" className="text-xs">Ligar</SelectItem>
                                    <SelectItem value="COPY_CODE" className="text-xs">Copiar Código</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full" /* Added hover bg and rounded-full */
                                  onClick={() => removeTemplateButton(compIndex, btnIndex)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <Input
                                placeholder="Texto do Botão (max 25 chars)"
                                value={btn.text}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'text', e.target.value)}
                                className="text-xs neu-input h-8"
                                maxLength={25}
                              />
                              {btn.type === 'URL' && (
                                <Input
                                  placeholder="https://exemplo.com/{{1}}"
                                  value={btn.url || ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'url', e.target.value)}
                                  className="text-xs neu-input h-8"
                                />
                              )}
                              {btn.type === 'PHONE_NUMBER' && (
                                <Input
                                  placeholder="+5511999999999"
                                  value={btn.phoneNumber || ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'phoneNumber', e.target.value)}
                                  className="text-xs neu-input h-8"
                                />
                              )}
                              {btn.type === 'COPY_CODE' && (
                                <Input
                                  placeholder="CUPOMXYZ (valor do código)"
                                  value={btn.couponCode || ''}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'couponCode', e.target.value)}
                                  className="text-xs neu-input h-8"
                                />
                              )}
                            </div>
                          ))}
                          {(comp.buttons?.length || 0) < 3 && ( // Max 3 buttons for WhatsApp
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addTemplateButton(compIndex)}
                              className="text-xs h-7 neu-button-secondary w-full sm:w-auto hover:bg-gray-100" /* Added hover */
                            >
                              <Plus className="w-3 h-3 mr-1"/> Adicionar Botão
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 mt-2">
                  {!(newTemplateData.components || []).find(c => c.type === 'HEADER') && (
                     <Button type="button" variant="outline" size="sm" onClick={() => addComponent('HEADER')} className="text-xs h-7 neu-button-secondary hover:bg-gray-100">Adicionar Header</Button> /* Added hover */
                  )}
                  {!(newTemplateData.components || []).find(c => c.type === 'FOOTER') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addComponent('FOOTER')} className="text-xs h-7 neu-button-secondary hover:bg-gray-100">Adicionar Rodapé</Button> /* Added hover */
                  )}
                  {!(newTemplateData.components || []).find(c => c.type === 'BUTTONS') && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addComponent('BUTTONS')} className="text-xs h-7 neu-button-secondary hover:bg-gray-100">Adicionar Botões</Button> /* Added hover */
                  )}
                </div>
              </CardContent>
            </Card>
            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-700">
              <Info className="h-4 w-4 !text-amber-600" />
              <AlertDescription className="text-xs">
                <strong>Atenção:</strong> Todas as variáveis devem ser no formato <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>, etc.
                O conteúdo do template deve seguir as <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800 font-medium">diretrizes do WhatsApp</a>.
                A aprovação pode levar de alguns minutos a algumas horas.
              </AlertDescription>
            </Alert>
          </form>
          <DialogFooter className="p-6 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => handleModalOpenChange(false)} disabled={createMutation.isPending} className="neu-button-secondary hover:bg-gray-100"> {/* Added hover */}
              Cancelar
            </Button>
            <Button
              type="submit" // This button will now submit the form with id "template-form"
              form="template-form" // Associate with the form
              disabled={createMutation.isPending}
              className="neu-button-primary bg-green-500 hover:bg-green-600 text-white"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTemplate ? 'Salvar Alterações' : 'Enviar para Aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
