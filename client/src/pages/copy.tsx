import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { 
  Bot, 
  Copy as CopyIcon, 
  Save, 
  Edit, 
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  Search
} from 'lucide-react';

interface Copy {
  id: number;
  title: string;
  content: string;
  type: string;
  platform?: string;
  campaignId?: number;
  createdAt: string;
}

interface GeneratedCopy {
  type: string;
  content: string;
  platform: string;
}

export default function CopyPage() {
  const [generatorForm, setGeneratorForm] = useState({
    product: '',
    audience: '',
    objective: 'sales',
    tone: 'professional',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: copies = [], isLoading: copiesLoading } = useQuery<Copy[]>({
    queryKey: ['/api/copies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/copies');
      return response.json();
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['/api/campaigns'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      return response.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: typeof generatorForm) => {
      const response = await apiRequest('POST', '/api/copies/generate', data);
      return response.json();
    },
    onSuccess: (data: GeneratedCopy[]) => {
      toast({
        title: 'Copies geradas com sucesso!',
        description: `${data.length} versões foram criadas.`,
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao gerar copies',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const saveCopyMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; type: string; platform?: string }) => {
      const response = await apiRequest('POST', '/api/copies', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/copies'] });
      toast({
        title: 'Copy salva',
        description: 'A copy foi salva na sua biblioteca.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/copies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/copies'] });
      toast({
        title: 'Copy excluída',
        description: 'A copy foi removida da sua biblioteca.',
      });
    },
  });

  // Mock generated copies for demonstration
  const [generatedCopies, setGeneratedCopies] = useState<(GeneratedCopy & { timestamp: Date })[]>([]);

  const handleGenerate = async () => {
    if (!generatorForm.product || !generatorForm.audience) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha produto/serviço e público-alvo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync(generatorForm);
      
      // Add timestamp to generated copies
      const timestampedCopies = (result as GeneratedCopy[]).map(copy => ({
        ...copy,
        timestamp: new Date(),
      }));
      
      setGeneratedCopies(prev => [...timestampedCopies, ...prev]);
    } catch (error) {
      // Fallback to mock data if API fails
      const mockCopies: (GeneratedCopy & { timestamp: Date })[] = [
        {
          type: 'headline',
          content: `🚀 Transforme seu ${generatorForm.product} com nossa solução inovadora para ${generatorForm.audience}!`,
          platform: 'facebook',
          timestamp: new Date(),
        },
        {
          type: 'cta',
          content: `Clique aqui e descubra como ${generatorForm.audience} estão revolucionando seus resultados com ${generatorForm.product}!`,
          platform: 'google',
          timestamp: new Date(),
        },
        {
          type: 'description',
          content: `Solução perfeita para ${generatorForm.audience} que buscam ${generatorForm.objective === 'sales' ? 'aumentar vendas' : 'gerar leads'}. Com nosso ${generatorForm.product}, você alcança resultados extraordinários em tempo recorde.`,
          platform: 'instagram',
          timestamp: new Date(),
        },
      ];
      
      setGeneratedCopies(prev => [...mockCopies, ...prev]);
    }
  };

  const filteredCopies = copies.filter(copy => {
    const matchesSearch = copy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         copy.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || copy.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const getTypeConfig = (type: string) => {
    const typeConfigs = {
      headline: { label: 'Headline', className: 'bg-primary/10 text-primary' },
      cta: { label: 'CTA', className: 'bg-success/10 text-success' },
      description: { label: 'Descrição', className: 'bg-purple/10 text-purple-600' },
      body: { label: 'Corpo', className: 'bg-orange/10 text-orange-600' },
    };
    
    return typeConfigs[type as keyof typeof typeConfigs] || { label: type, className: 'bg-muted text-muted-foreground' };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Texto copiado para a área de transferência.',
    });
  };

  const saveCopy = (generatedCopy: GeneratedCopy) => {
    saveCopyMutation.mutate({
      title: `${getTypeConfig(generatedCopy.type).label} - ${generatedCopy.platform}`,
      content: generatedCopy.content,
      type: generatedCopy.type,
      platform: generatedCopy.platform,
    });
  };

  const deleteCopy = (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta copy?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Copy & Sugestões IA</h1>
          <p className="text-muted-foreground mt-2">
            Crie e gerencie textos persuasivos com ajuda da IA
          </p>
        </div>
        <Button className="bg-gradient-to-r from-purple-500 to-primary">
          <Sparkles className="w-4 h-4 mr-2" />
          Gerar com IA
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Copy Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              Gerador de Copy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Produto/Serviço *
              </label>
              <Input
                placeholder="Ex: Curso de Marketing Digital"
                value={generatorForm.product}
                onChange={(e) => setGeneratorForm({ ...generatorForm, product: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Público-Alvo *
              </label>
              <Input
                placeholder="Ex: Empreendedores iniciantes"
                value={generatorForm.audience}
                onChange={(e) => setGeneratorForm({ ...generatorForm, audience: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Objetivo
              </label>
              <Select 
                value={generatorForm.objective} 
                onValueChange={(value) => setGeneratorForm({ ...generatorForm, objective: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Gerar vendas</SelectItem>
                  <SelectItem value="leads">Gerar leads</SelectItem>
                  <SelectItem value="engagement">Aumentar engajamento</SelectItem>
                  <SelectItem value="awareness">Criar awareness</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tom da mensagem
              </label>
              <Select 
                value={generatorForm.tone} 
                onValueChange={(value) => setGeneratorForm({ ...generatorForm, tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="inspirational">Inspiracional</SelectItem>
                  <SelectItem value="educational">Educativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-500 to-primary hover:from-purple-600 hover:to-primary/90"
            >
              {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Copy com IA
            </Button>
          </CardContent>
        </Card>

        {/* Generated Copies */}
        <Card>
          <CardHeader>
            <CardTitle>Copies Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {generatedCopies.map((copy, index) => {
                const typeConfig = getTypeConfig(copy.type);
                
                return (
                  <div key={index} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={typeConfig.className}>
                        {typeConfig.label}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(copy.content)}
                          title="Copiar"
                        >
                          <CopyIcon className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => saveCopy(copy)}
                          disabled={saveCopyMutation.isPending}
                          title="Salvar"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground mb-2">
                      {copy.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{copy.platform}</span>
                      <span>Gerado há {Math.floor((Date.now() - copy.timestamp.getTime()) / 60000)} min</span>
                    </div>
                  </div>
                );
              })}
              
              {generatedCopies.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Use o gerador ao lado para criar copies com IA
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved Copies Library */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Biblioteca de Copies</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar copies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="headline">Headlines</SelectItem>
                  <SelectItem value="cta">CTAs</SelectItem>
                  <SelectItem value="description">Descrições</SelectItem>
                  <SelectItem value="body">Corpo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCopies.map((copy) => {
              const typeConfig = getTypeConfig(copy.type);
              
              return (
                <Card key={copy.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-foreground line-clamp-1">{copy.title}</h4>
                      <div className="flex space-x-1 ml-2">
                        <Button variant="ghost" size="sm" title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(copy.content)}
                          title="Copiar"
                        >
                          <CopyIcon className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteCopy(copy.id)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                      {copy.content}
                    </p>
                    <div className="flex justify-between items-center">
                      <Badge className={typeConfig.className}>
                        {typeConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(copy.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {filteredCopies.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma copy encontrada</h3>
              <p className="text-muted-foreground">
                {copies.length === 0 
                  ? 'Gere suas primeiras copies com IA para começar.'
                  : 'Tente ajustar os filtros ou termo de busca.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
