import React, { useState, useEffect, useCallback, ChangeEvent } from 'react'; // Adicionado ChangeEvent
import { PlusCircle, Edit3, Trash2, Search, Filter, Eye, Play, Pause, Copy } from 'lucide-react';
import { Button } from '@zap_client/components/ui/button';
import { Input } from '@zap_client/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { ScrollArea } from '@zap_client/components/ui/scroll-area';
import { Badge } from '@zap_client/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@zap_client/components/ui/table';
import { useToast } from '@zap_client/hooks/use-toast'; // Mantido
import { getFlows, deleteFlow, duplicateFlow, updateFlowStatus, FlowResponse } from '@zap_client/lib/api'; // Supondo que existam
import { ApiError, FlowElementData } from '@zap_client/features/types/whatsapp_flow_types'; // Importado FlowElementData

export interface ZapFlowsListProps {
  onSelectFlow: (flowId: string) => void; // Para abrir no editor
  onEditFlow: (flow: FlowElementData) => void; // Para edição de metadados ou abrir no editor
  // Adicione mais props conforme necessário, ex: para criar novo fluxo
  onLaunchNewFlowEditor: () => void;
}

const ZapFlowsList: React.FC<ZapFlowsListProps> = ({ onSelectFlow, onEditFlow, onLaunchNewFlowEditor }) => {
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowElementData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'draft', 'inactive'
  const [isLoading, setIsLoading] = useState(false);

  const fetchFlowsList = useCallback(async () => {
    setIsLoading(true);
    try {
      // A função getFlows em api.ts deve retornar FlowElementData[]
      const flowsData: FlowElementData[] = await getFlows({ searchTerm, status: statusFilter });
      setFlows(flowsData);
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Carregar Fluxos',
        description: apiError.message || 'Não foi possível buscar a lista de fluxos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, searchTerm, statusFilter]);

  useEffect(() => {
    fetchFlowsList();
  }, [fetchFlowsList]);

  const handleDeleteFlow = async (flowId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      await deleteFlow(flowId); // Implementar em lib/api.ts
      toast({
        title: 'Fluxo Excluído',
        description: 'O fluxo foi excluído com sucesso.',
      });
      fetchFlowsList(); // Recarrega a lista
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Excluir Fluxo',
        description: apiError.message || 'Não foi possível excluir o fluxo.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      await duplicateFlow(flowId); // Implementar em lib/api.ts
      toast({
        title: 'Fluxo Duplicado',
        description: 'O fluxo foi duplicado com sucesso.',
      });
      fetchFlowsList();
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Duplicar Fluxo',
        description: apiError.message || 'Não foi possível duplicar o fluxo.',
        variant: 'destructive',
      });
    }
  };

  const handleChangeStatus = async (flowId: string, newStatus: FlowElementData['status']) => {
     try {
      await updateFlowStatus(flowId, newStatus); // Implementar em lib/api.ts
      toast({
        title: 'Status do Fluxo Atualizado',
        description: `O fluxo agora está ${newStatus === 'active' ? 'ativo' : newStatus === 'draft' ? 'em rascunho' : 'inativo'}.`,
      });
      fetchFlowsList();
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        title: 'Erro ao Atualizar Status',
        description: apiError.message || 'Não foi possível atualizar o status do fluxo.',
        variant: 'destructive',
      });
    }
  };


  const getStatusBadgeVariant = (status: FlowElementData['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default'; // Geralmente verde/azul
      case 'draft': return 'secondary'; // Geralmente cinza/amarelo
      case 'inactive': return 'outline'; // Geralmente cinza claro
      case 'archived': return 'destructive'; // Pode ser usado para arquivado
      default: return 'secondary';
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-lg">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Fluxos de Automação</CardTitle>
          <Button onClick={onLaunchNewFlowEditor} size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>
        <div className="mt-4 flex space-x-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar fluxos por nome..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} // Corrigido
              className="pl-8"
            />
          </div>
          {/* TODO: Adicionar filtro por status se necessário */}
          {/* <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select> */}
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading && <p className="p-6 text-center text-gray-500">Carregando fluxos...</p>}
          {!isLoading && flows.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              <ZapIcon className="w-16 h-16 mx-auto text-gray-300 mb-2" />
              <p className="font-semibold">Nenhum fluxo encontrado.</p>
              <p className="text-sm">Crie um novo fluxo para começar a automatizar.</p>
            </div>
          )}
          {!isLoading && flows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Nome do Fluxo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Última Modificação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((flow) => (
                  <TableRow key={flow.id}>
                    <TableCell className="font-medium">
                        <span 
                            onClick={() => onSelectFlow(flow.id)} 
                            className="cursor-pointer hover:underline"
                            title="Abrir no editor de fluxos"
                        >
                            {flow.name}
                        </span>
                        {flow.description && <p className="text-xs text-gray-500 truncate max-w-xs">{flow.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(flow.status)}>
                        {flow.status === 'active' ? 'Ativo' :
                         flow.status === 'draft' ? 'Rascunho' :
                         flow.status === 'inactive' ? 'Inativo' :
                         flow.status === 'archived' ? 'Arquivado' :
                         flow.status.toString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{flow.triggerType || 'N/A'}</TableCell>
                    <TableCell className="text-xs">{new Date(flow.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onSelectFlow(flow.id)} title="Visualizar/Editar Fluxo">
                        <Eye className="w-4 h-4" />
                      </Button>
                       {flow.status === 'active' ? (
                        <Button variant="ghost" size="icon" onClick={() => handleChangeStatus(flow.id, 'inactive')} title="Pausar Fluxo">
                            <Pause className="w-4 h-4" />
                        </Button>
                        ) : (
                        <Button variant="ghost" size="icon" onClick={() => handleChangeStatus(flow.id, 'active')} title="Ativar Fluxo">
                            <Play className="w-4 h-4" />
                        </Button>
                        )}
                      <Button variant="ghost" size="icon" onClick={() => onEditFlow(flow)} title="Editar Detalhes">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicateFlow(flow.id)} title="Duplicar Fluxo">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteFlow(flow.id)} title="Excluir Fluxo">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ZapFlowsList;
