import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, LayoutTemplate, Eye, Edit2, Trash2, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import StudioEditorComponent from '@/components/StudioEditorComponent';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { LandingPage as LandingPageItem } from '@shared/schema';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function LandingPagesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showStudioEditor, setShowStudioEditor] = useState(false);
  const [editingLp, setEditingLp] = useState<LandingPageItem | null>(null);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isNewLpModalOpen, setIsNewLpModalOpen] = useState(false);
  const [newLpName, setNewLpName] = useState("");

  const { data: landingPages = [], isLoading: isLoadingLps, error: lpsError, refetch: refetchLps } = useQuery<LandingPageItem[], Error>({
    queryKey: ['myStudioLandingPages'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/landingpages');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Falha ao carregar landing pages.' }));
        throw new Error(errData.error || errData.message);
      }
      return response.json();
    }
  });

  const saveLpMutation = useMutation<LandingPageItem, Error, Partial<Omit<LandingPageItem, 'id' | 'createdAt' | 'updatedAt'>> & { id?: number, grapesJsData?: any, studioProjectId?: string }>({
    mutationFn: async (lpData) => {
        const method = lpData.id ? 'PUT' : 'POST';
        const endpoint = lpData.id ? `/api/landingpages/${lpData.id}` : '/api/landingpages';

        const payload = {
            name: lpData.name,
            studioProjectId: lpData.studioProjectId,
            status: lpData.status || 'draft',
            slug: lpData.slug || lpData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            grapesJsData: lpData.grapesJsData,
        };
        
        const response = await apiRequest(method, endpoint, payload);
        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({ error: 'Erro desconhecido ao salvar' }));
            throw new Error(errorResult.error || "Falha ao salvar a landing page");
        }
        return response.json();
    },
    onSuccess: (savedLp) => {
        queryClient.invalidateQueries({ queryKey: ['myStudioLandingPages'] });
        if (showStudioEditor) {
            setEditingLp(savedLp); // Atualiza o estado de edição com a LP salva (importante para obter o ID)
        } else {
            setEditingLp(null);
        }
        toast({ title: "Sucesso", description: `Landing page "${savedLp.name}" salva.` });
    },
    onError: (error) => {
        toast({ title: "Erro ao Salvar LP", description: error.message, variant: "destructive" });
    }
  });

  const handleProjectSave = async (projectData: any, studioProjectIdFromEditor: string): Promise<{ id: string } | void > => {
    setIsEditorLoading(true);
    const lpNameToSave = editingLp?.name || newLpName;
    const lpIdToSave = editingLp?.id;

    if (!lpNameToSave) {
        toast({ title: "Nome é obrigatório", variant: "destructive" });
        setIsEditorLoading(false);
        throw new Error("Nome da Landing Page é obrigatório.");
    }

    try {
      const savedLp = await saveLpMutation.mutateAsync({ 
          id: lpIdToSave,
          name: lpNameToSave, 
          studioProjectId: studioProjectIdFromEditor, 
          grapesJsData: projectData,
      });
      setIsEditorLoading(false);
      
      if (!editingLp) { // Se era uma nova LP, agora temos o objeto completo
        setEditingLp(savedLp);
      }

      if (!savedLp.studioProjectId) {
        console.error("Backend não retornou studioProjectId.", savedLp);
        throw new Error("Falha ao obter ID do projeto do Studio do backend.");
      }
      return { id: savedLp.studioProjectId };
    } catch (error) {
      setIsEditorLoading(false);
      console.error("Falha na mutação saveLpMutation:", error);
      throw error; 
    }
  };
  
  const handleProjectLoad = async (projectIdToLoad: string): Promise<{ project: any }> => {
    setIsEditorLoading(true);
    try {
      const response = await apiRequest('GET', `/api/landingpages/studio-project/${projectIdToLoad}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `Projeto ${projectIdToLoad} não encontrado.` }));
        throw new Error(errData.error || errData.message);
      }
      const lpData : { project: any } = await response.json();
      setIsEditorLoading(false);
      return { project: lpData.project || {} };
    } catch (error) {
        setIsEditorLoading(false);
        toast({title: "Erro ao Carregar Projeto", description: (error as Error).message, variant: "destructive"})
        throw error;
    }
  };

   const handleAssetsUpload = async (files: File[]): Promise<{ src: string }[]> => {
    setIsEditorLoading(true);
    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        return apiRequest('POST', '/api/assets/lp-upload', formData, true);
      });
      const responses = await Promise.all(uploadPromises);
      const results = await Promise.all(responses.map(res => res.json()));
      const urls = results.flat().map(r => ({ src: r.src })); // A API retorna [{src: 'url'}]
      toast({ title: "Upload Concluído", description: `${files.length} arquivo(s) enviado(s).`});
      return urls;
    } catch (error) {
      toast({ title: "Erro no Upload", description: (error as Error).message, variant: "destructive" });
      return [];
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleAssetsDelete = async (assets: { src: string }[]): Promise<void> => {
     try {
       await apiRequest('POST', '/api/assets/lp-delete', { assets });
       toast({ title: "Assets Deletados", description: `${assets.length} asset(s) removido(s).` });
     } catch (error) {
       toast({ title: "Erro ao Deletar Assets", description: (error as Error).message, variant: "destructive" });
     }
  };
  
  const handleEditorError = (error: any) => {
    console.error("[LP_PAGE] Studio Editor - Erro:", error);
    toast({ title: "Erro no Editor", description: error?.message || "Ocorreu um problema com o editor.", variant: "destructive"});
  };

  const handleOpenNewModal = () => {
    setNewLpName("");
    setIsNewLpModalOpen(true);
  };
  
  const handleConfirmNewLp = () => {
    if (!newLpName.trim()) {
      toast({ title: "Nome inválido", description: "Por favor, insira um nome para a nova landing page.", variant: "destructive" });
      return;
    }
    setEditingLp(null); // Garante que estamos criando uma nova
    setIsNewLpModalOpen(false);
    setShowStudioEditor(true);
  };

  const handleEdit = (page: LandingPageItem) => {
    setEditingLp(page);
    setShowStudioEditor(true);
  };

  const deleteLpMutation = useMutation<void, Error, number>({
    mutationFn: (pageId) => apiRequest('DELETE', `/api/landingpages/${pageId}`),
    onSuccess: () => {
        queryClient.invalidateQueries({queryKey: ['myStudioLandingPages']});
        toast({title: "Excluído", description: "Landing page excluída com sucesso."});
    },
    onError: (error) => {
        toast({title: "Erro ao Excluir", description: error.message, variant: "destructive"});
    }
  });

  const handleDelete = (page: LandingPageItem) => {
    if (window.confirm(`Tem certeza que deseja excluir a landing page "${page.name}"?`)) {
      deleteLpMutation.mutate(page.id);
    }
  };

  if (isLoadingLps) {
    return (
        <div className="p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-150px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            Carregando landing pages...
        </div>
    );
  }

  if (lpsError) {
    return (
      <div className="p-8 text-center text-destructive">
          <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
          Erro ao carregar landing pages: {lpsError.message}
          <Button variant="link" className="p-0 h-auto text-destructive-foreground hover:underline ml-7 mt-1" onClick={() => refetchLps()}>Tentar novamente</Button>
      </div>
    );
  }

  if (showStudioEditor) {
    return (
      <div className="p-0 md:p-0 h-screen flex flex-col bg-background relative">
        {(isEditorLoading || saveLpMutation.isPending) && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-white"/>
            </div>
        )}
        <div className="flex items-center justify-between mb-0 p-3 border-b bg-card flex-shrink-0">
          <Button onClick={() => { setShowStudioEditor(false); setEditingLp(null); }} variant="outline" size="sm" disabled={isEditorLoading || saveLpMutation.isPending}>
            ← Voltar para Lista
          </Button>
          <h2 className="text-lg font-semibold truncate px-2">
            {editingLp ? `Editando: ${editingLp.name}` : `Nova: ${newLpName}`}
          </h2>
          <div className="w-24"></div>
        </div>
        <div className="flex-grow min-h-0">
          <StudioEditorComponent
            key={editingLp?.id || newLpName}
            onProjectSave={handleProjectSave}
            onProjectLoad={handleProjectLoad}
            onAssetsUpload={handleAssetsUpload}
            onAssetsDelete={handleAssetsDelete}
            onEditorError={handleEditorError}
            onEditorLoad={() => console.log("[LP_PAGE] Studio Editor Carregado!")}
            initialProjectData={editingLp?.grapesJsData}
            projectId={editingLp?.studioProjectId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* ... (código da lista de LPs, sem alterações) ... */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
            <LayoutTemplate className="w-7 h-7 mr-3 text-primary" />
            Landing Pages
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2">
            Crie e gerencie suas páginas de destino com o GrapesJS Studio.
          </p>
        </div>
        <Button onClick={handleOpenNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Nova Landing Page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suas Landing Pages</CardTitle>
          <CardDescription>
            Visualize e gerencie todas as suas landing pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoadingLps && landingPages.length === 0 && !lpsError ? (
            <div className="text-center py-12">
              <LayoutTemplate className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma Landing Page Criada</h3>
              <p className="text-muted-foreground mb-4">Comece criando sua primeira página de destino.</p>
              <Button onClick={handleOpenNewModal}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Landing Page
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {landingPages.map((page) => (
                <Card key={page.id} className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 hover:shadow-md transition-shadow">
                  <div className="flex-grow">
                    <h4 className="font-semibold text-lg text-foreground">{page.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Criada em: {new Date(page.createdAt).toLocaleDateString()} - Status: 
                      <span className={`ml-1 font-medium ${page.status === 'published' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(page)}>
                      <Edit2 className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(page)}>
                      <Trash2 className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Excluir</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isNewLpModalOpen} onOpenChange={setIsNewLpModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Landing Page</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="lp-name">Nome da Landing Page</Label>
            <Input 
              id="lp-name"
              value={newLpName}
              onChange={(e) => setNewLpName(e.target.value)}
              placeholder="Ex: Lançamento de Inverno"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewLpModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmNewLp}>Abrir Editor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
