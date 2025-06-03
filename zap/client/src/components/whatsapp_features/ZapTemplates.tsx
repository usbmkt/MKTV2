import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { MoreHorizontal, PlusCircle, Search, Trash2, Edit, Eye, Loader2, Info } from 'lucide-react';
// CORRIGIDO: Path Aliases para @zap_client
import { Button, buttonVariants } from '@zap_client/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zap_client/components/ui/dropdown-menu';
import { Input } from '@zap_client/components/ui/input';
import { Badge } from '@zap_client/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@zap_client/components/ui/dialog';
import { Label } from '@zap_client/components/ui/label';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { WhatsAppTemplate, WhatsAppTemplateComponent, WhatsAppTemplateButton, WhatsAppTemplateCategory } from '@zap_client/features/types/whatsapp_flow_types'; // Assumindo que WhatsAppTemplateCategory está aqui
import { useToast } from '@zap_client/hooks/use-toast';
import { apiRequest } from '@zap_client/lib/api'; // Assumindo que apiRequest virá do lib do zap
import { cn } from '@zap_client/lib/utils';

// Mock data (substituir com chamadas de API reais)
const mockTemplates: WhatsAppTemplate[] = [
  {
    id: 'template1',
    name: 'pedido_confirmado_v2',
    language: 'pt_BR',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Confirmação do Pedido #{{1}}' },
      { type: 'BODY', text: 'Olá {{2}}, seu pedido #{{1}} foi confirmado e está sendo preparado. Agradecemos a sua preferência! Você pode acompanhar o status em: {{3}}' },
      { type: 'FOOTER', text: 'Atenciosamente, Equipe USB MKT' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver Pedido', url: 'https://usbmkt.com/pedido/{{1}}' }] }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
    {
    id: 'template2',
    name: 'lembrete_agendamento',
    language: 'pt_BR',
    status: 'PENDING',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Olá {{1}}, este é um lembrete do seu agendamento para {{2}} às {{3}}.' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirmar Presença' }, { type: 'QUICK_REPLY', text: 'Reagendar' }] }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

const initialNewTemplate: WhatsAppTemplate = {
  id: '', name: '', language: 'pt_BR', status: 'PENDING', category: 'UTILITY', components: [{ type: 'BODY', text: '' }]
};

const templateCategoriesList: WhatsAppTemplateCategory[] = [
    { id: 'UTILITY', name: 'UTILITY'}, 
    { id: 'MARKETING', name: 'MARKETING'}, 
    { id: 'AUTHENTICATION', name: 'AUTHENTICATION'}
];
// Simplificado para string array se WhatsAppTemplateCategory for apenas string
// const templateCategories = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];


const templateLanguages = [{ code: 'pt_BR', name: 'Português (Brasil)' }, { code: 'en_US', name: 'Inglês (EUA)' }, { code: 'es_ES', name: 'Espanhol (Espanha)' }];
const componentTypes: WhatsAppTemplateComponent['type'][] = ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'];
const headerFormats: Array<WhatsAppTemplateComponent['format'] | ''> = ['', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']; // '' para Nenhum
const buttonTypes: WhatsAppTemplateButton['type'][] = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'];


const ZapTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(mockTemplates);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // const response = await apiRequest('GET', '/api/whatsapp/templates'); // Usar endpoint do zap/server
      // setTemplates(response.data as WhatsAppTemplate[]);
      setTemplates(mockTemplates); 
    } catch (error) {
      toast({ title: 'Erro ao buscar templates', description: String(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleInputChange = <K extends keyof WhatsAppTemplate>(field: K, value: WhatsAppTemplate[K]) => {
    if (editingTemplate) {
      setEditingTemplate(prev => prev ? { ...prev, [field]: value } : null);
    }
  };
  
  const handleComponentChange = (compIndex: number, field: keyof WhatsAppTemplateComponent, value: any) => {
    if (editingTemplate) {
      const updatedComponents = [...editingTemplate.components];
      const targetComponent = { ...updatedComponents[compIndex] };
  
      if (field === 'format') {
        if (value === '') { // Representa "Nenhum" ou remoção do formato
          delete targetComponent.format;
          // Se o formato for removido, e era um formato de mídia, limpar o example de mídia
          if (targetComponent.example?.header_handle) {
            delete targetComponent.example.header_handle;
          }
        } else {
          targetComponent.format = value as WhatsAppTemplateComponent['format'];
        }
      } else {
        (targetComponent as any)[field] = value;
      }
      
      updatedComponents[compIndex] = targetComponent;
      setEditingTemplate(prev => prev ? { ...prev, components: updatedComponents } : null);
    }
  };
  
  const handleButtonChange = (compIndex: number, btnIndex: number, field: keyof WhatsAppTemplateButton, value: any) => {
     if (editingTemplate) {
      const updatedComponents = [...editingTemplate.components];
      const component = { ...updatedComponents[compIndex] }; // Clonar componente
      if (component.buttons) {
        const updatedButtons = [...component.buttons]; // Clonar array de botões
        updatedButtons[btnIndex] = { ...updatedButtons[btnIndex], [field]: value }; // Clonar e atualizar botão
        component.buttons = updatedButtons;
        updatedComponents[compIndex] = component;
        setEditingTemplate(prev => prev ? { ...prev, components: updatedComponents } : null);
      }
    }
  };

  const addComponent = () => {
    if (editingTemplate) {
      setEditingTemplate(prev => prev ? { ...prev, components: [...prev.components, { type: 'BODY', text: '' }] } : null);
    }
  };

  const removeComponent = (compIndex: number) => {
     if (editingTemplate && editingTemplate.components.length > 1) { 
        setEditingTemplate(prev => prev ? { ...prev, components: prev.components.filter((_: WhatsAppTemplateComponent, i: number) => i !== compIndex) } : null);
     } else {
        toast({ title: "Atenção", description: "O template deve ter pelo menos um componente.", variant: "default"});
     }
  };

  const addButton = (compIndex: number) => {
    if (editingTemplate) {
      setEditingTemplate((prev: WhatsAppTemplate | null) => {
        if (!prev) return null;
        const updatedComponents = [...prev.components];
        const targetComponent = { ...updatedComponents[compIndex] };
        if (!targetComponent.buttons) {
          targetComponent.buttons = [];
        }
        targetComponent.buttons = [...targetComponent.buttons, { type: 'QUICK_REPLY', text: 'Novo Botão' }];
        updatedComponents[compIndex] = targetComponent;
        return { ...prev, components: updatedComponents };
      });
    }
  };

  const removeButton = (compIndex: number, btnIndex: number) => {
     if (editingTemplate) {
        setEditingTemplate((prev: WhatsAppTemplate | null) => {
            if (!prev) return null;
            const updatedComponents = [...prev.components];
            const targetComponent = { ...updatedComponents[compIndex] };
            if (targetComponent.buttons) {
                targetComponent.buttons = targetComponent.buttons.filter((_: WhatsAppTemplateButton, i: number) => i !== btnIndex);
                updatedComponents[compIndex] = targetComponent;
                return { ...prev, components: updatedComponents };
            }
            return prev;
        });
     }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.category || !editingTemplate.language || editingTemplate.components.length === 0) {
      toast({ title: "Erro de Validação", description: "Preencha todos os campos obrigatórios do template.", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      if (editingTemplate.id && templates.find(t => t.id === editingTemplate.id)) { // Update
        // await apiRequest('PUT', `/api/whatsapp/templates/${editingTemplate.id}`, editingTemplate); // Usar endpoint do zap/server
        setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? editingTemplate! : t));
        toast({ title: "Template atualizado!", description: `O template "${editingTemplate.name}" foi salvo.` });
      } else { 
        const payload = { ...editingTemplate, id: `template-${Date.now()}`}; 
        // const response = await apiRequest('POST', '/api/whatsapp/templates', payload); // Usar endpoint do zap/server
        // setTemplates(prev => [...prev, response.data as WhatsAppTemplate]);
        setTemplates(prev => [...prev, payload as WhatsAppTemplate]);
        toast({ title: "Template criado!", description: `O template "${payload.name}" foi criado.` });
      }
      setIsFormOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast({ title: "Erro ao salvar template", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este template?")) return;
    try {
      setIsLoading(true);
      // await apiRequest('DELETE', `/api/whatsapp/templates/${templateId}`); // Usar endpoint do zap/server
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({ title: "Template excluído!", variant: "default" });
    } catch (error) {
      toast({ title: "Erro ao excluir template", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const openCreateForm = () => {
    setEditingTemplate(JSON.parse(JSON.stringify(initialNewTemplate))); 
    setIsFormOpen(true);
  };

  const openEditForm = (template: WhatsAppTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(template))); 
    setIsFormOpen(true);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const getStatusColor = (status: WhatsAppTemplate['status']) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500';
      case 'PENDING': return 'bg-yellow-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  if (isLoading && !templates.length) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
         <div className="relative w-full sm:w-auto">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10 neu-input w-full sm:w-64"
            />
        </div>
        <Button onClick={openCreateForm} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
          <PlusCircle className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      </div>

      {filteredTemplates.length === 0 && !isLoading ? (
         <div className="text-center py-10">
          <Info className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum template encontrado.</p>
          <p className="text-sm text-muted-foreground">Crie um novo template para enviar mensagens modelo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col neu-card">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                   <Badge className={cn("text-xs text-white", getStatusColor(template.status))}>{template.status}</Badge>
                </div>
                <CardDescription className="text-xs">
                  Categoria: {template.category} | Idioma: {template.language}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow text-xs text-muted-foreground space-y-1">
                <p className="line-clamp-3">
                 {template.components.find(c => c.type === 'BODY')?.text || 'Corpo não definido.'}
                </p>
                 <div className="text-right mt-2">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                            Ações <MoreHorizontal className="h-3 w-3 ml-1" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditForm(template)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { /* Lógica de visualização aqui */ }}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteTemplate(template.id)} className="text-destructive hover:!bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground border-t pt-3">
                Atualizado: {new Date(template.updatedAt || Date.now()).toLocaleDateString()}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(isOpen: boolean) => { setIsFormOpen(isOpen); if (!isOpen) setEditingTemplate(null); }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl neu-card max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate?.id && templates.some(t => t.id === editingTemplate.id) ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle>
            <DialogDescription>
              Defina os componentes e o conteúdo do seu template de mensagem. Siga as <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">diretrizes do WhatsApp</a>.
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <form onSubmit={handleFormSubmit} className="flex-grow overflow-y-auto p-1 pr-3 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input id="template-name" value={editingTemplate.name} onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)} placeholder="ex: pedido_confirmado" className="neu-input" />
                  <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas, números e underscores.</p>
                </div>
                <div>
                  <Label htmlFor="template-category">Categoria</Label>
                  <Select value={editingTemplate.category} onValueChange={(value: string) => handleInputChange('category', value as WhatsAppTemplate['category'])}>
                    <SelectTrigger id="template-category" className="neu-input"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{templateCategoriesList.map((cat: WhatsAppTemplateCategory) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template-language">Idioma</Label>
                  <Select value={editingTemplate.language} onValueChange={(value: string) => handleInputChange('language', value)}>
                    <SelectTrigger id="template-language" className="neu-input"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{templateLanguages.map(lang => <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <h3 className="text-md font-semibold mb-2 border-t pt-3">Componentes</h3>
              {editingTemplate.components.map((component: WhatsAppTemplateComponent, compIndex: number) => (
                <Card key={compIndex} className="mb-4 neu-card-inset p-0">
                  <CardHeader className="flex flex-row items-center justify-between p-3 bg-muted/30 rounded-t-md">
                    <Label className="font-medium">Componente: {component.type}</Label>
                    <div className='flex items-center gap-2'>
                    <Select value={component.type} onValueChange={(value: string) => handleComponentChange(compIndex, 'type', value as WhatsAppTemplateComponent['type'])}>
                        <SelectTrigger className="h-8 text-xs w-32"><SelectValue/></SelectTrigger>
                        <SelectContent>{componentTypes.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}</SelectContent>
                    </Select>
                    {editingTemplate.components.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeComponent(compIndex)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    {component.type === 'HEADER' && (
                      <div>
                        <Label>Formato do Cabeçalho</Label>
                        <Select value={component.format || ''} onValueChange={(value: string) => handleComponentChange(compIndex, 'format', value as WhatsAppTemplateComponent['format'] || undefined)}>
                           <SelectTrigger className="neu-input"><SelectValue placeholder="Nenhum / Texto" /></SelectTrigger>
                           <SelectContent>{headerFormats.map(hf => <SelectItem key={hf || 'none'} value={hf || ''}>{hf || 'Nenhum / Texto Simples'}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {(component.type === 'HEADER' && component.format === 'TEXT') || component.type === 'BODY' || component.type === 'FOOTER' ? (
                      <div>
                        <Label>Texto <span className="text-xs text-muted-foreground">(Use {"{{1}}"}, {"{{2}}"}... para variáveis)</span></Label>
                        <Textarea value={component.text || ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleComponentChange(compIndex, 'text', e.target.value)} className="neu-input" rows={component.type === 'BODY' ? 4: 2}/>
                      </div>
                    ) : null}
                    {component.type === 'HEADER' && (component.format === 'IMAGE' || component.format === 'VIDEO' || component.format === 'DOCUMENT') ? (
                        <div>
                           <Label>URL do Exemplo de Mídia (handle)</Label>
                           <Input value={component.example?.header_handle?.[0] || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleComponentChange(compIndex, 'example', { ...component.example, header_handle: [e.target.value] })} placeholder="https://..." className="neu-input" />
                        </div>
                    ): null}

                    {component.type === 'BUTTONS' && (
                      <div className="space-y-2">
                        <Label>Botões (Máximo 3)</Label>
                        {component.buttons?.map((button: WhatsAppTemplateButton, btnIndex: number) => (
                          <Card key={btnIndex} className="p-2 neu-card">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                              <Input value={button.text} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'text', e.target.value)} placeholder="Texto do Botão" className="neu-input" />
                              <Select value={button.type} onValueChange={(value: string) => handleButtonChange(compIndex, btnIndex, 'type', value as WhatsAppTemplateButton['type'])}>
                                <SelectTrigger className="neu-input"><SelectValue /></SelectTrigger>
                                <SelectContent>{buttonTypes.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeButton(compIndex, btnIndex)}><Trash2 className="h-4 w-4 mr-1"/>Remover Botão</Button>
                            </div>
                            {button.type === 'URL' && <Input value={button.url || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'url', e.target.value)} placeholder="https://exemplo.com/{{1}}" className="mt-2 neu-input"/>}
                            {button.type === 'PHONE_NUMBER' && <Input value={button.phoneNumber || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'phoneNumber', e.target.value)} placeholder="+5511999998888" className="mt-2 neu-input"/>}
                          </Card>
                        ))}
                        {(component.buttons?.length || 0) < 3 && 
                            <Button type="button" variant="outline" size="sm" onClick={() => addButton(compIndex)}><PlusCircle className="h-4 w-4 mr-1"/>Adicionar Botão</Button>
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={addComponent} className="mt-2 w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Componente
              </Button>
            <DialogFooter className="mt-6 sticky bottom-0 bg-background py-3 px-0 border-t">
                <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); setEditingTemplate(null); }}>Cancelar</Button>
                <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Template
                </Button>
            </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZapTemplates;
