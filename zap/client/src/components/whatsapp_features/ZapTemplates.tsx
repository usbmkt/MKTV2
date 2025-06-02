import React, { ChangeEvent, FormEvent, useState } from 'react';
import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface MessageTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: { type: string; text?: string; url?: string }[];
}

interface TemplateFormData {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: { type: string; text?: string; url?: string }[];
}

// Mock API functions
const fetchTemplates = async (): Promise<MessageTemplate[]> => {
  // Replace with actual API call
  return [
    {
      id: '1',
      name: 'Welcome',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [{ type: 'TEXT', text: 'Hello {{1}}!' }],
    },
  ];
};

const createTemplate = async (template: TemplateFormData): Promise<MessageTemplate> => {
  // Replace with actual API call
  return { id: '2', ...template };
};

const deleteTemplate = async (id: string): Promise<void> => {
  // Replace with actual API call
  console.log(`Deleted template ${id}`);
};

export default function ZapTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplateData, setNewTemplateData] = useState<TemplateFormData>({
    name: '',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [],
  });
  const { toast } = useToast();

  const queryClient = new QueryClient();

  const { data: templates = [], isLoading, error } = useQuery<MessageTemplate[]>({
    queryKey: ['zapTemplates'],
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      setIsModalOpen(false);
      setNewTemplateData({
        name: '',
        category: 'UTILITY',
        language: 'pt_BR',
        components: [],
      });
      toast({ title: 'Template created successfully' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error creating template' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapTemplates'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error deleting template' });
    },
  });

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof TemplateFormData,
  ) => {
    setNewTemplateData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSelectChange = (value: string, field: keyof TemplateFormData) => {
    setNewTemplateData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleComponentChange = (
    index: number,
    field: 'type' | 'text' | 'url',
    value: string,
  ) => {
    setNewTemplateData((prev) => {
      const components = [...prev.components];
      components[index] = { ...components[index], [field]: value };
      return { ...prev, components };
    });
  };

  const addComponent = (type: string) => {
    setNewTemplateData((prev) => ({
      ...prev,
      components: [...prev.components, { type }],
    }));
  };

  const removeComponent = (index: number) => {
    setNewTemplateData((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMutation.mutate(newTemplateData);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditingTemplate(null);
      setNewTemplateData({
        name: '',
        category: 'UTILITY',
        language: 'pt_BR',
        components: [],
      });
    }
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (error) {
    return <div className="text-center text-red-500">Error loading templates</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Message Templates</h2>
          <p className="text-muted-foreground">Manage WhatsApp approved templates</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>{template.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingTemplate(template);
                              setNewTemplateData({
                                name: template.name,
                                category: template.category,
                                language: template.language,
                                components: template.components,
                              });
                              setIsModalOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(template.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Badge variant="outline">{template.category}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p><strong>Language:</strong> {template.language}</p>
                    <p><strong>Components:</strong></p>
                    {template.components.map((comp, idx) => (
                      <p key={idx}>
                        {comp.type}: {comp.text || comp.url}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                name="name"
                value={newTemplateData.name}
                onChange={(e) => handleInputChange(e, 'name')}
                placeholder="Enter template name"
                required
                pattern="[a-z0-9_]+"
              />
              <p className="text-sm text-muted-foreground">
                Only lowercase letters, numbers, and underscores
              </p>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                name="category"
                value={newTemplateData.category}
                onValueChange={(value: string) => handleSelectChange(value, 'category')}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                name="language"
                value={newTemplateData.language}
                onValueChange={(value: string) => handleSelectChange(value, 'language')}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Portuguese (Brazil)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es_ES">Spanish (Spain)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Template Components</Label>
              <p className="text-sm text-muted-foreground">Define your message content</p>
              {newTemplateData.components.length > 0 && (
                <div className="space-y-4 mt-4">
                  {newTemplateData.components.map((comp, index) => (
                    <div key={index} className="border p-4 rounded-md space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Component {index + 1}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComponent(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Select
                        value={comp.type}
                        onValueChange={(value: string) =>
                          handleComponentChange(index, 'type', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEXT">Text</SelectItem>
                          <SelectItem value="IMAGE">Image</SelectItem>
                          <SelectItem value="VIDEO">Video</SelectItem>
                          <SelectItem value="DOCUMENT">Document</SelectItem>
                        </SelectContent>
                      </Select>
                      {comp.type === 'TEXT' && (
                        <Textarea
                          placeholder="Enter text content (e.g., Hello {{1}})"
                          value={comp.text || ''}
                          onChange={(e) =>
                            handleComponentChange(index, 'text', e.target.value)
                          }
                          rows={4}
                          className="mt-2"
                        />
                      )}
                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.type) && (
                        <Input
                          type="url"
                          placeholder="Enter media URL"
                          value={comp.url || ''}
                          onChange={(e) =>
                            handleComponentChange(index, 'url', e.target.value)
                          }
                          className="mt-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex space-x-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addComponent('TEXT')}
                >
                  Add Text
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addComponent('IMAGE')}
                >
                  Add Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addComponent('VIDEO')}
                >
                  Add Video
                </Button>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Variables must be in <code>{'{{1}}'}</code> format. Follow WhatsApp
                guidelines. Approval may take minutes to hours.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleModalOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center"
              >
                {createMutation.isPending && (
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                )}
                {editingTemplate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
