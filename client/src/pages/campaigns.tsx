// client/src/pages/campaigns.tsx
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import CampaignForm from '@/components/campaign-form';
import { Campaign as CampaignType } from '@shared/schema';
import {
  Plus,
  Search,
  Filter as FilterIcon,
  Edit,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Eye,
  Copy as CopyIcon, 
  Archive,
  BarChart3
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export default function CampaignsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignType | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: campaigns = [], isLoading, error: campaignsError } = useQuery<CampaignType[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/campaigns');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao buscar campanhas' }));
        throw new Error(errorData.error || errorData.message || 'Erro ao buscar campanhas');
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/campaigns/${id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao excluir campanha' }));
        throw new Error(errorData.error || errorData.message || 'Erro ao excluir campanha');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({
        title: 'Campanha excluída',
        description: 'A campanha foi excluída com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest('PUT', `/api/campaigns/${id}`, { status });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao atualizar status' }));
        throw new Error(errorData.error || errorData.message || 'Erro ao atualizar status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({
        title: 'Status atualizado',
        description: 'O status da campanha foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const nameMatch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
      const descriptionMatch = campaign.description && campaign.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = nameMatch || descriptionMatch;
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      const matchesPlatform = platformFilter === 'all' ||
                             (campaign.platforms && campaign.platforms.some(p => p === platformFilter));
      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [campaigns, searchTerm, statusFilter, platformFilter]);

  const getStatusBadgeConfig = (status: string) => {
    const statusConfig = {
      active: { variant: 'default' as const, label: 'Ativo', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      paused: { variant: 'secondary' as const, label: 'Pausado', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      completed: { variant: 'outline' as const, label: 'Finalizado', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      draft: { variant: 'outline' as const, label: 'Rascunho', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  };

  const getPlatformBadgeConfig = (platform: string) => {
    const platformConfig = {
      facebook: { className: 'bg-blue-600/20 text-blue-400 border-blue-600/30', label: 'Facebook' },
      google_ads: { className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Google Ads' },
      instagram: { className: 'bg-pink-500/20 text-pink-400 border-pink-500/30', label: 'Instagram' },
      linkedin: { className: 'bg-sky-700/20 text-sky-400 border-sky-700/30', label: 'LinkedIn' },
      tiktok: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'TikTok' },
    };
    return platformConfig[platform as keyof typeof platformConfig] || { className: 'bg-gray-400/20 text-gray-300 border-gray-400/30', label: platform };
  };

  const toggleCampaignStatus = (campaign: CampaignType) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    updateStatusMutation.mutate({ id: campaign.id, status: newStatus });
  };

  const handleDeleteCampaign = (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditCampaign = (campaign: CampaignType) => {
    setEditingCampaign(campaign);
    setShowForm(true);
  };

  const handleCreateCampaign = () => {
    setEditingCampaign(undefined);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-4 text-muted-foreground">Carregando campanhas...</p>
      </div>
    );
  }

  if (campaignsError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <FilterIcon className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Erro ao carregar campanhas</h2>
        <p className="text-muted-foreground mb-4">
          Não foi possível buscar os dados das campanhas. Tente novamente mais tarde.
        </p>
        <p className="text-sm text-red-400">Detalhe: {campaignsError.message}</p>
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ['campaigns'] })} className="mt-6 neu-button-primary">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie e analise suas campanhas de marketing digital.
          </p>
        </div>
        <Button onClick={handleCreateCampaign} className="w-full md:w-auto neu-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <Card className="neu-card">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="neu-input pl-10 w-full text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="neu-input text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="neu-card">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Finalizado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="neu-input text-xs">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent className="neu-card">
                <SelectItem value="all">Todas Plataformas</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="neu-button text-xs w-full lg:w-auto">
              <FilterIcon className="w-3.5 h-3.5 mr-1.5" />
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredCampaigns.map((campaign) => {
          const statusConfig = getStatusBadgeConfig(campaign.status);
          const budgetFormatted = campaign.budget ? `R$ ${parseFloat(campaign.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
          
          return (
            <Card key={campaign.id} className="neu-card flex flex-col">
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold mb-0.5">{campaign.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="neu-button w-8 h-8 p-0">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="neu-card w-48">
                      <DropdownMenuItem onClick={() => alert(`Ver detalhes: ${campaign.name}`)} className="text-xs">
                        <Eye className="mr-2 h-3.5 w-3.5" /> Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditCampaign(campaign)} className="text-xs">
                        <Edit className="mr-2 h-3.5 w-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alert(`Duplicar: ${campaign.name}`)} className="text-xs">
                        <CopyIcon className="mr-2 h-3.5 w-3.5" /> Duplicar
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => alert(`Métricas: ${campaign.name}`)} className="text-xs">
                        <BarChart3 className="mr-2 h-3.5 w-3.5" /> Ver Métricas
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                       <DropdownMenuItem 
                        onClick={() => toggleCampaignStatus(campaign)}
                        disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.id === campaign.id}
                        className="text-xs"
                       >
                        {campaign.status === 'active' ? (
                          <><Pause className="mr-2 h-3.5 w-3.5" /> Pausar</>
                        ) : (
                          <><Play className="mr-2 h-3.5 w-3.5" /> Ativar</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alert(`Arquivar: ${campaign.name}`)} className="text-xs">
                        <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border"/>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteCampaign(campaign.id)} 
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs"
                        disabled={deleteMutation.isPending && deleteMutation.variables === campaign.id}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="text-xs line-clamp-2 h-8 leading-tight">
                  {campaign.description || 'Sem descrição detalhada.'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 space-y-2.5 flex-grow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Status:</span>
                  <Badge variant={statusConfig.variant} className={cn("text-[0.7rem] px-1.5 py-0.5 neu-badge", statusConfig.className)}> {/* Adicionada classe neu-badge */}
                    {statusConfig.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Orçamento:</span>
                  <span className="text-xs font-semibold">{budgetFormatted}</span>
                </div>

                <div>
                  <span className="text-xs font-medium text-muted-foreground">Plataformas:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {campaign.platforms && campaign.platforms.length > 0 ? campaign.platforms.map((platform) => {
                      const platformConfig = getPlatformBadgeConfig(platform);
                      return (
                        <Badge key={platform} variant="outline" className={cn("text-[0.65rem] px-1.5 py-0.5 border neu-badge-sm", platformConfig.className)}> {/* Adicionada classe neu-badge-sm */}
                          {platformConfig.label}
                        </Badge>
                      );
                    }) : <span className="text-xs text-muted-foreground italic">Nenhuma</span>}
                  </div>
                </div>
                
                <div className="text-[0.7rem] text-muted-foreground pt-1.5">
                  <span>Criado: {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}</span>
                  {campaign.startDate && <span className="ml-1">| Início: {new Date(campaign.startDate).toLocaleDateString('pt-BR')}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CORREÇÃO DO ERRO DE BUILD: Comentário removido e JSX para empty state re-adicionado */}
      {filteredCampaigns.length === 0 && !isLoading && (
        <Card className="neu-card mt-6">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <FilterIcon className="w-16 h-16 text-muted-foreground mx-auto opacity-50" />
              <div>
                <h3 className="text-xl font-semibold">Nenhuma campanha encontrada</h3>
                <p className="text-muted-foreground">
                  {campaigns.length === 0
                    ? 'Você ainda não criou nenhuma campanha.'
                    : 'Tente ajustar os filtros ou o termo de busca.'}
                </p>
              </div>
              {campaigns.length === 0 && (
                <Button onClick={handleCreateCampaign} className="mt-4 neu-button-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Campanha
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {showForm && (
        <CampaignForm
          key={editingCampaign ? editingCampaign.id : 'new'}
          initialData={editingCampaign}
          onClose={() => {
            setShowForm(false);
            setEditingCampaign(undefined);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingCampaign(undefined);
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          }}
        />
      )}
    </div>
  );
}
