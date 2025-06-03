// zap/client/src/pages/ZapMainPage.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zap_client/components/ui/tabs';
import ZapWhatsAppConnection from '@zap_client/components/ZapWhatsAppConnection';
import ZapConversations from '@zap_client/components/whatsapp_features/ZapConversations';
import ZapFlowsList, { ZapFlowsListProps } from '@zap_client/components/whatsapp_features/ZapFlowsList'; // Importado ZapFlowsListProps
import ZapFlowBuilderWrapper, { ZapFlowBuilderProps } from '@zap_client/components/ZapFlowBuilder'; 
import ZapTemplates from '@zap_client/components/whatsapp_features/ZapTemplates';
import ZapAnalytics from '@zap_client/components/whatsapp_features/ZapAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { MessageCircle, Bot, ListChecks, Puzzle, BarChart2, Settings } from 'lucide-react';

// Interface FlowStructure pode ser movida para whatsapp_flow_types.ts se usada em mais lugares
interface FlowStructure {
    id: string;
    name: string;
    // Adicione mais campos se o ZapFlowBuilderWrapper precisar da estrutura completa ao iniciar
}

export default function ZapMainPage() {
  const [activeTab, setActiveTab] = useState('connection');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null); 
  const [editingFlowName, setEditingFlowName] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentFlowStructure, setCurrentFlowStructure] = useState<FlowStructure | null>(null); // Pode ser usado para carregar dados do fluxo no editor

  const handleSelectFlowToEdit = (flowId: string, flowName: string) => {
    setEditingFlowId(flowId);
    setEditingFlowName(flowName);
    // Aqui você poderia buscar a estrutura detalhada do fluxo se o editor precisar dela ao iniciar
    // Por exemplo: fetchFlowDetails(flowId).then(data => setCurrentFlowStructure(data));
    setActiveTab('editor'); 
  };

  const handleCloseEditor = () => {
    setEditingFlowId(null);
    setEditingFlowName(null);
    setCurrentFlowStructure(null);
    setActiveTab('flows'); 
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Módulo WhatsApp Business</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas conversas, automações e templates do WhatsApp.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 neu-card p-1">
          <TabsTrigger value="connection" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Settings className="w-3.5 h-3.5 mr-1.5"/>Conexão</TabsTrigger>
          <TabsTrigger value="conversations" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><MessageCircle className="w-3.5 h-3.5 mr-1.5"/>Conversas</TabsTrigger>
          <TabsTrigger value="flows" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bot className="w-3.5 h-3.5 mr-1.5"/>Fluxos</TabsTrigger>
          <TabsTrigger value="editor" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Puzzle className="w-3.5 h-3.5 mr-1.5"/>Editor</TabsTrigger>
          <TabsTrigger value="templates" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ListChecks className="w-3.5 h-3.5 mr-1.5"/>Templates</TabsTrigger>
          <TabsTrigger value="analytics" className="neu-button text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BarChart2 className="w-3.5 h-3.5 mr-1.5"/>Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="mt-2">
          <ZapWhatsAppConnection />
        </TabsContent>
        <TabsContent value="conversations" className="mt-2">
          <ZapConversations />
        </TabsContent>
        <TabsContent value="flows" className="mt-2">
          <ZapFlowsList 
            onSelectFlow={handleSelectFlowToEdit} 
            onEditFlow={handleSelectFlowToEdit} // Usando a mesma função para abrir no editor
          />
        </TabsContent>
        <TabsContent value="editor" className="mt-2">
          {editingFlowId ? (
            <ZapFlowBuilderWrapper 
              key={editingFlowId} 
              flowId={editingFlowId} // Já é string ou null
              initialFlowName={editingFlowName}
              // As props onSaveFlow e onLoadFlow seriam implementadas aqui para interagir com sua API
              // onSaveFlow={async (id, nodes, edges, name) => { console.log('Save flow', id, name, nodes, edges); /* ... sua lógica de salvar ... */ }}
              // onLoadFlow={async (id) => { console.log('Load flow', id); /* ... sua lógica de carregar ... */; return null; }}
              onSaveSuccess={(savedFlowId: string, savedFlowName: string) => {
                console.log("Fluxo salvo com ID:", savedFlowId, "e Nome:", savedFlowName);
                setEditingFlowName(savedFlowName); 
              }}
              onCloseEditor={handleCloseEditor}
            />
          ) : (
            <Card className="neu-card shadow-md min-h-[calc(100vh-280px)] md:min-h-[calc(100vh-230px)]">
                <CardHeader><CardTitle className="flex items-center text-lg"><Puzzle className="w-5 h-5 mr-2 text-primary"/>Editor Visual de Fluxos</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center h-full pt-10">
                    <Puzzle className="w-16 h-16 text-muted-foreground opacity-30 mb-4"/>
                    <p className="text-muted-foreground">Selecione um fluxo na aba "Fluxos" para editar ou crie um novo.</p>
                </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="templates" className="mt-2">
          <ZapTemplates />
        </TabsContent>
        <TabsContent value="analytics" className="mt-2">
          <ZapAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
