// client/src/pages/creatives.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import UploadModal from '@/components/upload-modal';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  Video,
  FileText,
  Edit,
  Download,
  Trash2,
  Play,
  AlertTriangle,
} from 'lucide-react';

interface Creative {
  id: number;
  name: string;
  type: 'image' | 'video' | 'text' | 'carousel';
  fileUrl?: string | null; // Pode ser null
  content?: string;
  status: string;
  platforms: string[]; // JSONB agora é string[] no schema, então está ok
  campaignId?: number | null; // Pode ser number ou null
  createdAt: string;
}

interface CreativeEditData {
  id?: number;
  name: string;
  type: 'image' | 'video' | 'text' | 'carousel';
  campaignId?: number | null; // Pode ser number ou null
  content?: string;
  platforms?: string[];
  fileUrl?: string | null; // Pode ser null
}


export default function Creatives() {
  const [showUploadOrEditModal, setShowUploadOrEditModal] = useState(false);
  const [editingCreative, setEditingCreative] = useState<CreativeEditData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0);

  const { data: creatives = [], isLoading, error: creativesError } = useQuery<Creative[], Error>({
    queryKey: ['/api/creatives'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/creatives');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || `Failed to fetch creatives: ${response.status}`);
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/creatives/${id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || `Failed to delete creative: ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
      toast({
        title: 'Criativo excluído',
        description: 'O criativo foi excluído com sucesso.',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir o criativo.',
        variant: 'destructive',
      });
    },
  });

  const filteredCreatives = creatives.filter(creative => {
    const matchesSearch = creative.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || creative.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || creative.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ElementType> = {
      image: ImageIcon, video: Video, text: FileText, carousel: ImageIcon,
    };
    return icons[type] || FileText;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, className: string }> = {
      approved: { variant: 'default', label: 'Aprovado', className: 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700' },
      pending: { variant: 'secondary', label: 'Pendente', className: 'bg-yellow-500 hover:bg-yellow-600 text-black dark:bg-yellow-600 dark:hover:bg-yellow-700' },
      rejected: { variant: 'destructive', label: 'Rejeitado', className: 'bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700' },
    };
    return statusConfig[status] || { variant: 'outline', label: status, className: 'border-gray-500 text-gray-700 dark:text-gray-300' };
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { className: string, label: string }> = {
      image: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Imagem' },
      video: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Vídeo' },
      text: { className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', label: 'Copy' },
      carousel: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Carrossel' },
    };
    return typeConfig[type] || { className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: type };
  };

  const deleteCreative = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este criativo?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenNewCreativeModal = () => {
    setEditingCreative(null);
    setErrorBoundaryKey(prevKey => prevKey + 1);
    setShowUploadOrEditModal(true);
  };

  const handleEditCreative = (creative: Creative) => {
    const editData: CreativeEditData = {
      id: creative.id,
      name: creative.name,
      type: creative.type,
      campaignId: creative.campaignId, // Usar diretamente o tipo number | null
      content: creative.content,
      platforms: creative.platforms,
      fileUrl: creative.fileUrl, // Usar diretamente o tipo string | null
    };
    setEditingCreative(editData);
    setErrorBoundaryKey(prevKey => prevKey + 1);
    setShowUploadOrEditModal(true);
  };

  const closeModal = () => {
    setShowUploadOrEditModal(false);
    setEditingCreative(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-4 text-muted-foreground">Carregando criativos...</p>
      </div>
    );
  }
  if (creativesError) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Erro ao carregar criativos</h2>
        <p className="text-muted-foreground mb-4">{creativesError.message}</p>
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ['/api/creatives'] })}>
          Tentar Novamente
        </Button>
      </div>
    );
   }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Criativos</h1>
          <p className="text-muted-foreground mt-1 md:mt-2">
            Gerencie seus ativos de mídia e conteúdo.
          </p>
        </div>
        <Button onClick={handleOpenNewCreativeModal}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Criativo
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar criativos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="text">Copy</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="hidden md:flex">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredCreatives.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCreatives.map((creative) => {
            const TypeSpecificIcon = getTypeIcon(creative.type);
            const statusConfig = getStatusBadge(creative.status);
            const typeConfig = getTypeBadge(creative.type);

            return (
              <Card key={creative.id} className="creative-card flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-card">
                 <div className="aspect-[16/10] bg-muted/30 relative overflow-hidden">
                  {creative.type === 'image' && creative.fileUrl ? (
                    <img
                      src={creative.fileUrl}
                      alt={creative.name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Imagem+Indisponível')}
                    />
                  ) : creative.type === 'video' && creative.fileUrl ? (
                    <div className="w-full h-full bg-black/80 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  ) : creative.type === 'text' ? (
                    <div className="w-full h-full bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 flex items-center justify-center p-4">
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
                        <p className="text-sm text-primary/80 dark:text-primary/70 font-medium line-clamp-4">
                          {creative.content?.substring(0, 150) || creative.name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <TypeSpecificIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={statusConfig.variant} className={`${statusConfig.className} text-xs`}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${typeConfig.className}`}>
                      <TypeSpecificIcon className="w-3 h-3 mr-1.5" />
                      {typeConfig.label}
                    </span>
                  </div>
                </div>
                <CardContent className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-foreground mb-1 line-clamp-2 leading-tight">
                      {creative.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Criado em: {new Date(creative.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      ID: {creative.id}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => handleEditCreative(creative)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {creative.fileUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" asChild>
                          <a href={creative.fileUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteCreative(creative.id)}
                        disabled={deleteMutation.isPending}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Nenhum criativo encontrado</h3>
                <p className="text-muted-foreground">
                  {creatives.length === 0 && !searchTerm && typeFilter === 'all' && statusFilter === 'all'
                    ? 'Faça upload do seu primeiro criativo para começar.'
                    : 'Tente ajustar os filtros ou o termo de busca.'
                  }
                </p>
              </div>
              {creatives.length === 0 && !searchTerm && typeFilter === 'all' && statusFilter === 'all' && (
                <Button onClick={handleOpenNewCreativeModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Fazer primeiro upload
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )
      }

      {showUploadOrEditModal && (
        <ErrorBoundary
          key={errorBoundaryKey}
          fallbackRender={(error, errorInfo, resetErrorBoundary) => (
            <div role="alert" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full">
                 <div className="flex items-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-destructive mr-3" />
                  <h3 className="text-lg font-semibold text-destructive">Erro no Formulário</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Ocorreu um erro ao processar as informações.</p>
                <p className="text-xs text-destructive mb-3">{error.message}</p>
                <details className="mb-4 text-xs bg-muted p-2 rounded max-h-32 overflow-auto">
                  <summary className="cursor-pointer">Detalhes técnicos</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all">
                    {errorInfo.componentStack}
                  </pre>
                </details>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => { resetErrorBoundary(); closeModal(); }}>
                        Fechar
                    </Button>
                </div>
              </div>
            </div>
          )}
        >
          <UploadModal
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              queryClient.invalidateQueries({ queryKey: ['/api/creatives'] });
              toast({
                title: editingCreative ? 'Criativo Atualizado!' : 'Upload Concluído!',
                description: editingCreative ? 'As alterações foram salvas.' : 'Seu criativo foi enviado com sucesso.',
                variant: 'default',
              });
            }}
            onError={(errorMsg) => {
              toast({
                title: 'Falha na Operação',
                description: errorMsg || 'Não foi possível completar a ação.',
                variant: 'destructive',
              });
            }}
            initialData={editingCreative || undefined}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
