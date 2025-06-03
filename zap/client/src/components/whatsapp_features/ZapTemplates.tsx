import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { PlusCircle, Edit3, Trash2, Search, Filter, Eye, UploadCloud, FileText, Image as ImageIcon, Video, AlertTriangle } from 'lucide-react';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Textarea } from '@zap_client/components/ui/textarea';
import { Label } from '@zap_client/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Badge } from '@zap_client/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@zap_client/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zap_client/components/ui/select';
import { useToast } from '@zap_client/hooks/use-toast'; // Mantido
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, WhatsAppTemplate, TemplateComponent, TemplateParameter, TemplateExample, TemplateCategory, TemplateLanguage } from '@zap_client/lib/api'; // Supondo que existam
import { ApiError } from '@zap_client/features/types/whatsapp_flow_types';

// Exemplo de estrutura para um novo template ou edição
const initialTemplateFormData: Partial<WhatsAppTemplate> = {
  name: '',
  language: 'pt_BR', // Default language
  category: 'UTILITY', // Default category
  components: [],
  allow_category_change: false, // ou true, dependendo da política
};


const ZapTemplates: React.FC = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WhatsAppTemplate> | null>(null);
  const [currentFormData, setCurrentFormData] = useState<Partial<WhatsAppTemplate>>(initialTemplateFormData);

  // Supondo que as categorias e línguas venham de uma fonte (API ou constante)
  const templateCategories: TemplateCategory[] = ["UTILITY", "MARKETING", "AUTHENTICATION"];
  const templateLanguages: { code: TemplateLanguage; name: string }[] = [
    { code: 'pt_BR', name: 'Português (Brasil)' },
    { code: 'en_US', name: 'Inglês (EUA)' },
    { code: 'es_ES', name: 'Espanhol (Espanha)' },
  ];


  const fetchTemplatesList = useCallback(async () => {
    setIsLoading(true);
    try {
      const templatesData = await getTemplates({ searchTerm }); // Implementar em lib/api.ts
      setTemplates(templatesData);
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Carregar Templates',
        description: apiError.message || 'Não foi possível buscar a lista de templates.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, searchTerm]);

  useEffect(() => {
    fetchTemplatesList();
  }, [fetchTemplatesList]);

  const handleOpenDialog = (template?: WhatsAppTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setCurrentFormData({ ...template });
    } else {
      setEditingTemplate(null);
      setCurrentFormData(initialTemplateFormData);
    }
    setIsDialogOpen(true);
  };

  const handleFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSelectChange = (name: keyof WhatsAppTemplate, value: string) => {
    setCurrentFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleComponentChange = (compIndex: number, field: keyof TemplateComponent, value: any) => {
    const updatedComponents = [...(currentFormData.components || [])];
    if (updatedComponents[compIndex]) {
      (updatedComponents[compIndex] as any)[field] = value;
      // Se mudar o tipo de header, resetar format e example
      if (field === 'type' && updatedComponents[compIndex].type === 'HEADER') {
        (updatedComponents[compIndex] as any).format = undefined;
        (updatedComponents[compIndex] as any).example = undefined;
      }
      setCurrentFormData(prev => ({ ...prev, components: updatedComponents }));
    }
  };
  
  const addComponent = (type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS') => {
    const newComponent: Partial<TemplateComponent> = { type };
    if (type === 'HEADER') newComponent.format = 'TEXT'; // Default format for header
    if (type === 'BUTTONS') newComponent.buttons = [{ type: 'QUICK_REPLY', text: 'Resposta Rápida' }];

    setCurrentFormData(prev => ({
        ...prev,
        components: [...(prev.components || []), newComponent as TemplateComponent]
    }));
  };

  const removeComponent = (compIndex: number) => {
    setCurrentFormData(prev => ({
        ...prev,
        components: (prev.components || []).filter((_, index) => index !== compIndex)
    }));
  };


  const handleSaveTemplate = async () => {
    if (!currentFormData.name || !currentFormData.language || !currentFormData.category || !currentFormData.components?.length) {
      toast({ title: "Campos Obrigatórios", description: "Nome, língua, categoria e ao menos um componente são obrigatórios.", variant: "destructive" });
      return;
    }

    try {
      if (editingTemplate && editingTemplate.id) {
        await updateTemplate(editingTemplate.id, currentFormData as WhatsAppTemplate); // Implementar em lib/api.ts
        toast({ title: 'Template Atualizado', description: 'O template foi atualizado com sucesso.' });
      } else {
        await createTemplate(currentFormData as WhatsAppTemplate); // Implementar em lib/api.ts
        toast({ title: 'Template Criado', description: 'O template foi enviado para aprovação.' });
      }
      setIsDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplatesList();
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: `Erro ao ${editingTemplate ? 'Atualizar' : 'Criar'} Template`,
        description: apiError.message || `Não foi possível salvar o template. Verifique os dados e tente novamente.`,
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este template?')) return;
    try {
        await deleteTemplate(templateId);
        toast({ title: 'Template Excluído', description: 'O template foi excluído com sucesso.' });
        fetchTemplatesList();
    } catch (error) {
        const apiError = error as ApiError;
        toast({ title: 'Erro ao Excluir', description: apiError.message || 'Não foi possível excluir o template.', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
      case 'PENDING': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
      case 'REJECTED': return <Badge variant="destructive">Rejeitado</Badge>;
      default: return <Badge variant="outline">{status || 'Desconhecido'}</Badge>;
    }
  };
  
  // Função para renderizar o formulário de um componente específico
  const renderComponentForm = (component: TemplateComponent, compIndex: number) => {
    // Corrigido o erro TS2367: A comparação agora é feita com component.format que pode ser 'TEXT'.
    // O erro original comparava component.type (que seria 'HEADER', 'BODY', etc.) com 'TEXT'.
    if (component.type === 'HEADER') {
      return (
        <div className="space-y-2 border p-3 rounded-md">
          <div className="flex justify-between items-center">
            <Label className="font-semibold">Cabeçalho ({component.format})</Label>
            <Button variant="ghost" size="sm" onClick={() => removeComponent(compIndex)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
          </div>
          <Select
            value={component.format || 'TEXT'}
            onValueChange={(value) => handleComponentChange(compIndex, 'format', value as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT')}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Texto</SelectItem>
              <SelectItem value="IMAGE">Imagem</SelectItem>
              <SelectItem value="VIDEO">Vídeo</SelectItem>
              <SelectItem value="DOCUMENT">Documento</SelectItem>
            </SelectContent>
          </Select>
          {component.format === 'TEXT' && (
            <Input
              placeholder="Texto do cabeçalho (max 60 chars). Use {{1}} para variável."
              value={component.text || ''}
              onChange={(e) => handleComponentChange(compIndex, 'text', e.target.value)}
              maxLength={60}
            />
          )}
          {/* Para IMAGE, VIDEO, DOCUMENT, você precisaria de um campo para a URL de exemplo ou ID do handle */}
          {(component.format === 'IMAGE' || component.format === 'VIDEO' || component.format === 'DOCUMENT') && (
             <div>
                <Label className="text-xs">Exemplo de Mídia (Handle/Link)</Label>
                <Input 
                    placeholder="ID do handle da mídia ou URL de exemplo" 
                    value={component.example?.header_handle?.[0] || component.example?.header_url?.[0] || ''}
                    onChange={(e) => {
                        const example: TemplateExample = component.format === 'TEXT' ? { header_text: [e.target.value]} : 
                                                         (component.format === 'IMAGE' || component.format === 'VIDEO' || component.format === 'DOCUMENT') ? 
                                                         { [component.format === 'IMAGE' ? 'header_handle' : 'header_url'] : [e.target.value] } : {}; // Ajuste conforme API da Meta
                        handleComponentChange(compIndex, 'example', example);
                    }}
                />
             </div>
          )}
        </div>
      );
    }
    if (component.type === 'BODY') {
       return (
        <div className="space-y-2 border p-3 rounded-md">
            <div className="flex justify-between items-center">
                <Label className="font-semibold">Corpo</Label>
                 <Button variant="ghost" size="sm" onClick={() => removeComponent(compIndex)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
            </div>
            <Textarea
                placeholder="Texto do corpo (max 1024 chars). Use {{1}}, {{2}} para variáveis."
                value={component.text || ''}
                onChange={(e) => handleComponentChange(compIndex, 'text', e.target.value)}
                maxLength={1024}
                rows={3}
            />
            {/* Exemplo para body_text (variáveis) */}
        </div>
       );
    }
    // Adicionar lógica para FOOTER e BUTTONS similarmente
    return null;
  };


  return (
    <Card className="h-full flex flex-col shadow-lg">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Templates de Mensagem</CardTitle>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar templates por nome..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full">
           {isLoading && <p className="p-6 text-center text-gray-500">Carregando templates...</p>}
           {!isLoading && templates.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-2" />
              <p className="font-semibold">Nenhum template encontrado.</p>
              <p className="text-sm">Crie um novo template para usar em suas automações.</p>
            </div>
          )}
          {!isLoading && templates.length > 0 && (
            <ul className="divide-y">
              {templates.map(template => (
                <li key={template.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-blue-600">{template.name}</h3>
                      <p className="text-xs text-gray-500">
                        Língua: {templateLanguages.find(l => l.code === template.language)?.name || template.language} |
                        Categoria: {template.category}
                      </p>
                      <div className="mt-1">
                        {getStatusBadge(template.status)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                       <Button variant="outline" size="xs" onClick={() => handleOpenDialog(template)} title="Ver/Editar Template">
                         <Eye className="w-3 h-3 mr-1" /> Ver/Editar
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id!)} title="Excluir Template">
                         <Trash2 className="w-4 h-4 text-red-500" />
                       </Button>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                    {template.components.map((comp, idx) => (
                        <div key={idx}>
                           <strong>{comp.type}: </strong> 
                           {comp.text || comp.format || (comp.buttons && comp.buttons.map(b => b.text).join(', '))}
                        </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>

      {/* Dialog para Criar/Editar Template */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Criar Novo Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? `Editando o template "${editingTemplate.name}".` : 'Preencha os detalhes para um novo template de mensagem do WhatsApp.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-2"> {/* Adicionado ScrollArea aqui */}
            <div className="grid gap-4 py-4 ">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="template-name" className="text-right">Nome</Label>
                <Input id="template-name" name="name" value={currentFormData.name || ''} onChange={handleFormInputChange} className="col-span-3" placeholder="Ex: aviso_agendamento (letras minúsculas, números, underscores)" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="template-language" className="text-right">Língua</Label>
                <Select name="language" value={currentFormData.language} onValueChange={(val) => handleFormSelectChange('language', val)}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a língua" /></SelectTrigger>
                  <SelectContent>
                    {templateLanguages.map(lang => <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="template-category" className="text-right">Categoria</Label>
                <Select name="category" value={currentFormData.category} onValueChange={(val) => handleFormSelectChange('category', val)}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {templateCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <h4 className="font-semibold mt-2">Componentes do Template:</h4>
              {currentFormData.components?.map((component, compIndex) => (
                <div key={compIndex} className="mb-3">
                    {renderComponentForm(component, compIndex)}
                </div>
              ))}
              <div className="flex space-x-2 mt-2">
                <Button variant="outline" onClick={() => addComponent('HEADER')} size="sm">Add Cabeçalho</Button>
                <Button variant="outline" onClick={() => addComponent('BODY')} size="sm">Add Corpo</Button>
                {/* <Button variant="outline" onClick={() => addComponent('FOOTER')} size="sm">Add Rodapé</Button>
                <Button variant="outline" onClick={() => addComponent('BUTTONS')} size="sm">Add Botões</Button> */}
              </div>
               {currentFormData.components && currentFormData.components.length === 0 && (
                <p className="text-xs text-red-500 text-center p-2 border border-dashed border-red-300 rounded-md">
                    <AlertTriangle size={16} className="inline mr-1"/> Adicione ao menos um componente (ex: Corpo).
                </p>
              )}


            </div>
          </ScrollArea> {/* Fim do ScrollArea */}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" onClick={handleSaveTemplate}>
              {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
};

export default ZapTemplates;
