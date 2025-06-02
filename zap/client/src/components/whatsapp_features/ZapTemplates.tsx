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

import { Alert, AlertDescription } from '@/components/ui/alert'; // Add import for Alert (verify path)

import { Plus, Edit2, Trash2, Search, MessageSquare, Loader2, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast'; // Verify path



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

    { type: 'BUTTONS', buttons: [] }

  ]

};



export default function ZapTemplates() {

  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const [newTemplateData, setNewTemplateData] = useState<Partial<MessageTemplate>>(defaultNewTemplateDataState);

  

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



  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {

    const { name, value } = e.target;

    if (name === "category" || name === "language") {

        setNewTemplateData(prev => ({ ...prev, [name]: value as MessageTemplate['category'] | MessageTemplate['language'] }));

    } else {

        setNewTemplateData(prev => ({ ...prev, [name]: value }));

    }

  };

  

  const handleComponentChange = (index: number, field: keyof TemplateComponent, value: any) => {

    setNewTemplateData(prev => {

      const components = [...(prev.components || [])];

      const targetComponent = { ...components[index] }; 

      (targetComponent as any)[field] = value; 

      components[index] = targetComponent; 

      return { ...prev, components };

    });

  };



  const addComponent = (type: TemplateComponent['type']) => {

    let newComponent: TemplateComponent;

    switch(type) {

      case 'HEADER': newComponent = { type: 'HEADER', format: 'TEXT', text: ''}; break;

      case 'BODY': newComponent = { type: 'BODY', text: ''}; break;

      case 'FOOTER': newComponent = { type: 'FOOTER', text: ''}; break;

      case 'BUTTONS': newComponent = { type: 'BUTTONS', buttons: [{type: 'QUICK_REPLY', text: 'Resposta Rápida'}]}; break;

      default: return;

    }

    setNewTemplateData(prev => ({...prev, components: [...(prev.components || []), newComponent]}));

  };

  

  const removeComponent = (index: number) => {

    setNewTemplateData(prev => ({...prev, components: prev.components?.filter((_, i) => i !== index)}));

  };



  const handleButtonChange = (compIndex: number, btnIndex: number, field: keyof TemplateButton, value: string) => {

    setNewTemplateData(prev => {

      const components = JSON.parse(JSON.stringify(prev.components || [])); 

      if (components[compIndex]?.buttons) {

        (components[compIndex].buttons[btnIndex] as any)[field] = value;

      }

      return { ...prev, components };

    });

  };



  const addTemplateButton = (compIndex: number) => {

    setNewTemplateData(prev => {

      const components = JSON.parse(JSON.stringify(prev.components || []));

      if (components[compIndex]?.buttons) {

        components[compIndex].buttons.push({ type: 'QUICK_REPLY', text: 'Nova Resposta' });

      } else if (components[compIndex]) {

        components[compIndex].buttons = [{ type: 'QUICK_REPLY', text: 'Nova Resposta' }];

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



  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault();

    if (!newTemplateData.name || !newTemplateData.category || !newTemplateData.language || !newTemplateData.components?.some(c => c.type === 'BODY' && c.text?.trim())) {

      toast({ title: "Campos obrigatórios", description: "Nome, categoria, idioma e corpo da mensagem são obrigatórios.", variant: "destructive" });

      return;

    }

    createMutation.mutate(newTemplateData as Omit<MessageTemplate, 'id' | 'status' | 'qualityScore' | 'createdAt' | 'updatedAt'>);

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

      setNewTemplateData(defaultNewTemplateDataState); 

    }

  };



  useEffect(() => {

    if (isModalOpen) { 

      if (editingTemplate) {

        setNewTemplateData(editingTemplate);

      } else {

        setNewTemplateData(defaultNewTemplateDataState); 

      }

    } else {

        setNewTemplateData(defaultNewTemplateDataState);

    }

  }, [editingTemplate, isModalOpen]);



  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Carregando templates...</div>;

  if (error) return <div className="p-4 text-center text-red-500"><AlertTriangle className="w-6 h-6 mx-auto mb-2"/>Erro ao carregar templates: {(error as Error).message}</div>;



  return (

    <div className="space-y-6">

      <div className="flex justify-between items-center">

        <div>

          <h2 className="text-2xl font-bold">Templates de Mensagem</h2>

          <p className="text-muted-foreground">Gerencie templates aprovados pelo WhatsApp</p>

        </div>

        <Button 

          onClick={() => { 

            setEditingTemplate(null); 

            setIsModalOpen(true); 

          }} 

          className="neu-button"

        >

          <Plus className="w-4 h-4 mr-2" />

          Novo Template

        </Button>

      </div>



      <Card className="neu-card">

        <CardHeader>

          <div className="flex items-center space-x-2">

            <Search className="w-5 h-5 text-muted-foreground" />

            <Input

              placeholder="Buscar templates..."

              value={searchTerm}

              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}

              className="neu-input max-w-sm"

            />

          </div>

        </CardHeader>

        <CardContent>

          {filteredTemplates.length === 0 ? (

            <div className="text-center py-8 text-muted-foreground">

              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />

              <p>Nenhum template encontrado.</p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {filteredTemplates.map((template) => (

                <Card key={template.id} className="neu-card hover:shadow-lg transition-shadow">

                  <CardHeader className="pb-3">

                    <div className="flex justify-between items-start">

                      <CardTitle className="text-base font-semibold truncate">{template.name}</CardTitle>

                      <DropdownMenu>

                        <DropdownMenuTrigger asChild>

                          <Button variant="ghost" size="sm" className="p-1 h-7 neu-button">

                            <Edit2 className="w-3.5 h-3.5" />

                          </Button>

                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">

                          <DropdownMenuItem onClick={() => {

                            setEditingTemplate(template); 

                            setIsModalOpen(true); 

                          }}>

                            <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar

                          </DropdownMenuItem>

                          <DropdownMenuItem className="text-red-500" onClick={() => deleteMutation.mutate(template.id)} disabled={deleteMutation.isPending && deleteMutation.variables === template.id}>

                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir

                          </DropdownMenuItem>

                        </DropdownMenuContent>

                      </DropdownMenu>

                    </div>

                    <div className="flex items-center space-x-2 text-xs mt-1">

                      <Badge variant="outline" className={getStatusBadgeClass(template.status)}>{template.status}</Badge>

                      {template.qualityScore && (

                        <Badge variant="outline" className={getQualityScoreBadgeClass(template.qualityScore)}>

                          Qualidade: {template.qualityScore.score}

                        </Badge>

                      )}

                    </div>

                  </CardHeader>

                  <CardContent className="space-y-2 text-xs">

                    <p><strong>Categoria:</strong> {template.category}</p>

                    <p><strong>Idioma:</strong> {template.language}</p>

                    <div className="mt-2">

                      <p className="font-medium mb-1">Corpo da Mensagem:</p>

                      <p className="text-muted-foreground bg-muted/50 p-2 rounded line-clamp-3">

                        {template.components.find(c => c.type === 'BODY')?.text || 'Corpo não definido'}

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

        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">

          <DialogHeader className="p-6 pb-4 border-b">

            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Criar Novo Template de Mensagem'}</DialogTitle>

            <DialogDescription>

              {editingTemplate ? `Modificando o template "${editingTemplate.name}".` : 'Os templates precisam ser aprovados pelo WhatsApp antes do uso.'}

            </DialogDescription>

          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="space-y-1.5">

                    <Label htmlFor="template-name">Nome do Template*</Label>

                    <Input

                      id="template-name"

                      name="name"

                      value={newTemplateData.name || ''}

                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(e)}

                      placeholder="Ex: promocao_natal_2024"

                      className="neu-input"

                      required

                    />

                    <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e underscores.</p>

                </div>

                <div className="space-y-1.5">

                    <Label htmlFor="template-category">Categoria*</Label>

                    <Select

                      name="category"

                      value={newTemplateData.category || 'UTILITY'}

                      onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, category: value as MessageTemplate['category'] }))}

                    >

                        <SelectTrigger id="template-category" className="neu-input"><SelectValue /></SelectTrigger>

                        <SelectContent>

                            <SelectItem value="MARKETING">Marketing</SelectItem>

                            <SelectItem value="UTILITY">Utilitário</SelectItem>

                            <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>

                        </SelectContent>

                    </Select>

                </div>

                <div className="space-y-1.5">

                    <Label htmlFor="template-language">Idioma*</Label>

                    <Select

                      name="language"

                      value={newTemplateData.language || 'pt_BR'}

                      onValueChange={(value: string) => setNewTemplateData(prev => ({ ...prev, language: value }))}

                    >

                        <SelectTrigger id="template-language" className="neu-input"><SelectValue /></SelectTrigger>

                        <SelectContent>

                            <SelectItem value="pt_BR">Português (Brasil)</SelectItem>

                            <SelectItem value="en_US">Inglês (EUA)</SelectItem>

                            <SelectItem value="es_ES">Espanhol (Espanha)</SelectItem>

                        </SelectContent>

                    </Select>

                </div>

            </div>

            

            <Card className="neu-card-inset">

              <CardHeader className="pb-2 pt-3">

                <CardTitle className="text-base">Componentes do Template</CardTitle>

                <CardDescription className="text-xs">Defina o conteúdo da sua mensagem.</CardDescription>

              </CardHeader>

              <CardContent className="space-y-3">

                {(newTemplateData.components || []).map((comp, compIndex) => {

                  if (!comp) return null;

                  return (

                    <div key={compIndex} className="p-3 border rounded bg-card space-y-2">

                      <div className="flex justify-between items-center">

                        <Badge variant="secondary">{comp.type}</Badge>

                        {comp.type !== 'BODY' && (

                          <Button

                            type="button"

                            variant="ghost"

                            size="sm"

                            className="h-6 p-1 text-red-500"

                            onClick={() => removeComponent(compIndex)}

                          >

                            <XCircle className="w-3.5 h-3.5"/>

                          </Button>

                        )}

                      </div>

                      {comp.type === 'HEADER' && (

                        <Select

                          value={comp.format || 'TEXT'}

                          onValueChange={(value: string) => handleComponentChange(compIndex, 'format', value)}

                        >

                            <SelectTrigger className="text-xs neu-input h-8"><SelectValue/></SelectTrigger>

                            <SelectContent>

                              <SelectItem value="TEXT">Texto</SelectItem>

                              <SelectItem value="IMAGE">Imagem</SelectItem>

                              <SelectItem value="VIDEO">Vídeo</SelectItem>

                              <SelectItem value="DOCUMENT">Documento</SelectItem>

                            </SelectContent>

                        </Select>

                      )}

                      {((comp.type === 'HEADER' && comp.format === 'TEXT') || comp.type === 'BODY' || comp.type === 'FOOTER') && (

                        <Textarea

                          placeholder={`Conteúdo para ${comp.type.toLowerCaseimmune(1).tsx

                          value={comp.text || ''}}

                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleComponentChange(compIndex, 'text', e.target.value)}

                          rows={comp.type === 'BODY' ? 4 : 2}

                          className="text-sm neu-input"

                        />

                      )}

                      {comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT') && (

                        <div className="text-xs text-muted-foreground p-2 border border-dashed rounded bg-muted/50">

                          <Info className="w-3 h-3 inline mr-1"/>

                          {comp.format === 'IMAGE' ? 'Para Imagem: Forneça um link de exemplo ou deixe em branco para adicionar via API ao enviar.' :

                           comp.format === 'VIDEO' ? 'Para Vídeo: Forneça um link de exemplo ou deixe em branco para adicionar via API.' :

                           'Para Documento: Forneça um nome de arquivo de exemplo ou deixe em branco.'}

                          <Input

                            type="text"

                            placeholder="Link de exemplo (opcional)"

                            value={(comp.example?.header_handle || [])[0] || ''}

                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleComponentChange(compIndex, 'example', { ...comp.example, header_handle: [e.target.value] })}

                            className="text-xs mt-1 neu-input h-7"

                          />

                        </div>

                      )}

                      {comp.type === 'BUTTONS' && comp.buttons && (

                        <div className="space-y-2">

                          {comp.buttons.map((btn, btnIndex) => (

                            <div key={btnIndex} className="p-2 border rounded bg-background space-y-1">

                              <div className="flex justify-between items-center">

                                <Select

                                  value={btn.type}

                                  onValueChange={(value: string) => handleButtonChange(compIndex, btnIndex, 'type', value as TemplateButton['type'])}

                                >

                                  <SelectTrigger className="text-xs neu-input h-8 w-40"><SelectValue/></SelectTrigger>

                                  <SelectContent>

                                    <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>

                                    <SelectItem value="URL">Link (URL)</SelectItem>

                                    <SelectItem value="PHONE_NUMBER">Ligar</SelectItem>

                                    <SelectItem value="COPY_CODE">Copiar Código</SelectItem>

                                  </SelectContent>

                                </Select>

                                <Button

                                  type="button"

                                  variant="ghost"

                                  size="icon"

                                  className="h-6 w-6 p-0"

                                  onClick={() => removeTemplateButton(compIndex, btnIndex)}

                                >

                                  <Trash2 className="w-3 h-3 text-red-500"/>

                                </Button>

                              </div>

                              <Input

                                placeholder="Texto do Botão"

                                value={btn.text}

                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'text', e.target.value)}

                                className="text-xs neu-input h-8"

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

                                  placeholder="CUPOMXYZ"

                                  value={btn.couponCode || ''}

                                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleButtonChange(compIndex, btnIndex, 'couponCode', e.target.value)}

                                  className="text-xs neu-input h-8"

                                />

                              )}

                            </div>

                          ))}

                          {(comp.buttons?.length || 0) < 3 && (

                            <Button

                              type="button"

                              variant="outline"

                              size="sm"

                              onClick={() => addTemplateButton(compIndex)}

                              className="text-xs h-7"

                            >

                              + Botão

                            </Button>

                          )}

                        </div>

                      )}

                    </div>

                  );

                })}

                <div className="flex gap-2 mt-2">

                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('HEADER')} className="text-xs h-7">Header</Button>

                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('FOOTER')} className="text-xs h-7">Rodapé</Button>

                  {!(newTemplateData.components || []).find(c => c.type === 'BUTTONS') && (

                    <Button type="button" variant="outline" size="sm" onClick={() => addComponent('BUTTONS')} className="text-xs h-7">Botões</Button>

                  )}

                </div>

              </CardContent>

            </Card>

            <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-700">

              <Info className="h-4 w-4 !text-amber-600" />

              <AlertDescription className="text-xs">

                <strong>Atenção:</strong> Todas as variáveis devem ser no formato <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>, etc.

                O conteúdo do template deve seguir as <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800">diretrizes do WhatsApp</a>.

                A aprovação pode levar de alguns minutos a algumas horas.

              </AlertDescription>

            </Alert>

          </form>

          <DialogFooter className="p-6 pt-4 border-t">

            <Button variant="outline" onClick={() => handleModalOpenChange(false)} disabled={createMutation.isPending}>

              Cancelar

            </Button>

            <Button

              type="submit"

              onClick={(e: MouseEvent<HTMLButtonElement>) => handleSubmit(e as any)} // Cast to any to match form event

              disabled={createMutation.isPending}

              className="neu-button-primary"

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
