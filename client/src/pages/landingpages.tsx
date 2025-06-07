// client/src/pages/landingpages.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, LayoutTemplate, Edit2, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { LandingPage as LandingPageItem } from '@shared/schema';
import GrapesJsEditor from '@/components/grapesjs-editor'; // Usando o editor mais simples e estável

export default function LandingPagesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEditor, setShowEditor] = useState(false);
  const [editingLp, setEditingLp] = useState<LandingPageItem | null>(null);

  const { data: landingPages = [], isLoading, error } = useQuery<LandingPageItem[], Error>({
    queryKey: ['landingPages'],
    queryFn: () => api.get('/api/landingpages'),
  });

  const saveLpMutation = useMutation<LandingPageItem, Error, Partial<LandingPageItem>>({
    mutationFn: async (lpData) => {
      const method = lpData.id ? 'PUT' : 'POST';
      const endpoint = lpData.id ? `/api/landingpages/${lpData.id}` : '/api/landingpages';
      return api[method.toLowerCase() as 'put' | 'post'](endpoint, lpData);
    },
    onSuccess: (savedLp) => {
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      toast({ title: "Sucesso!", description: `Landing page "${savedLp.name}" salva.` });
      setShowEditor(false);
      setEditingLp(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
    }
  });

  const deleteLpMutation = useMutation<void, Error, number>({
    mutationFn: (id) => api.delete(`/api/landingpages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      toast({ title: "Excluído", description: "Landing page excluída com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro ao Excluir", description: error.message, variant: "destructive" });
    }
  });

  const handleSave = (jsonData: string, htmlData: string, cssData: string) => {
    const name = editingLp?.name || prompt("Digite o nome da Landing Page:", "Nova Página");
    if (!name) return;

    const dataToSave: Partial<LandingPageItem> = {
      id: editingLp?.id,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      grapesJsData: JSON.parse(jsonData), // GrapesJS Data
      status: 'draft',
    };
    saveLpMutation.mutate(dataToSave);
  };
  
  const handleEdit = (page: LandingPageItem) => {
    setEditingLp(page);
    setShowEditor(true);
  };
  
  const handleCreateNew = () => {
    setEditingLp(null);
    setShowEditor(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta landing page?")) {
      deleteLpMutation.mutate(id);
    }
  };

  // ✅ CORREÇÃO: Layout da tela de edição
  if (showEditor) {
    return (
      <div className="h-screen w-full flex flex-col bg-background">
        <header className="p-4 border-b flex-shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold">{editingLp ? `Editando: ${editingLp.name}` : "Nova Landing Page"}</h2>
          <Button onClick={() => setShowEditor(false)} variant="outline">
            Voltar para a Lista
          </Button>
        </header>
        <main className="flex-grow min-h-0">
          <GrapesJsEditor
            key={editingLp?.id || 'new'}
            initialData={editingLp?.grapesJsData}
            onSave={handleSave}
          />
        </main>
      </div>
    );
  }

  // Layout principal da lista de landing pages (sem alterações significativas)
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
            <LayoutTemplate className="w-7 h-7 mr-3 text-primary" />
            Landing Pages
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2">Crie e gerencie suas páginas de destino.</p>
        </div>
        <Button onClick={handleCreateNew}><Plus className="w-4 h-4 mr-2" />Criar Nova Landing Page</Button>
      </div>

      {isLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 text-primary mx-auto animate-spin"/> Carregando...</div>}
      {error && <div className="text-center py-8 text-destructive"><AlertTriangle className="w-8 h-8 mx-auto mb-2"/>Erro: {error.message}</div>}
      
      {!isLoading && !error && (
        <Card>
          <CardHeader><CardTitle>Suas Landing Pages</CardTitle><CardDescription>Gerencie todas as suas páginas.</CardDescription></CardHeader>
          <CardContent>
            {landingPages.length === 0 ? (
              <div className="text-center py-12"><LayoutTemplate className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">Nenhuma Landing Page</h3><p className="text-muted-foreground mb-4">Crie sua primeira página.</p><Button onClick={handleCreateNew}><Plus className="w-4 h-4 mr-2" />Criar Primeira Página</Button></div>
            ) : (
              <div className="space-y-4">
                {landingPages.map((page) => (
                  <Card key={page.id} className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 hover:shadow-md transition-shadow">
                    <div className="flex-grow"><h4 className="font-semibold text-lg">{page.name}</h4><p className="text-sm text-muted-foreground">Criada em: {new Date(page.createdAt).toLocaleDateString()}</p></div>
                    <div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={() => handleEdit(page)}><Edit2 className="w-4 h-4 mr-2"/>Editar</Button><Button variant="destructive" size="sm" onClick={() => handleDelete(page.id)}><Trash2 className="w-4 h-4 mr-2" />Excluir</Button></div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
