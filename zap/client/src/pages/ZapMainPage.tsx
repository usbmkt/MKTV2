// zap/client/src/pages/ZapMainPage.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zap_client/components/ui/tabs';
import ZapWhatsAppConnection from '@zap_client/components/ZapWhatsAppConnection';
import ZapConversations from '@zap_client/components/whatsapp_features/ZapConversations';
import ZapFlowsList from '@zap_client/components/whatsapp_features/ZapFlowsList';
import ZapFlowBuilderWrapper from '@zap_client/components/ZapFlowBuilder'; // Usando o Wrapper
import ZapTemplates from '@zap_client/components/whatsapp_features/ZapTemplates';
import ZapAnalytics from '@zap_client/components/whatsapp_features/ZapAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { MessageCircle, Bot, ListChecks, Puzzle, BarChart2, Settings } from 'lucide-react';

const PlaceholderComponent: React.FC<{ title: string; icon?: React.ElementType; description?: string }> = ({ title, icon: Icon, description }) => (
  <Card className="shadow-md neu-card">
    <CardHeader>
      <CardTitle className="flex items-center text-lg text-foreground">
        {Icon && <Icon className="w-5 h-5 mr-2 text-primary" />}
        {title}
      </CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className="min-h-[calc(100vh-280px)] md:min-h-[calc(100vh-230px)] flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Conteúdo para "{title}" será implementado aqui.</p>
    </CardContent>
  </Card>
);

const ZapMainPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("connect");
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [editingFlowName, setEditingFlowName] = useState<string | undefined>(undefined);

  const handleEditFlowStructure = (flowId: number, flowName?: string) => {
    setEditingFlowId(flowId);
    setEditingFlowName(flowName || `Fluxo ${flowId}`);
    setActiveTab("editor"); 
  };
  
  const handleCloseEditor = () => {
    setEditingFlowId(null);
    setEditingFlowName(undefined);
    setActiveTab("flows"); // Volta para a lista de fluxos
  };

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Módulo WhatsApp Autônomo
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas comunicações e automações do WhatsApp.
        </p>
      </header>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 mb-6">
          <TabsTrigger value="connect" className="text-xs sm:text-sm neu-tab-trigger"><Settings className="w-4 h-4 mr-1 sm:mr-2"/>Conectar</TabsTrigger>
          <TabsTrigger value="conversations" className="text-xs sm:text-sm neu-tab-trigger"><MessageCircle className="w-4 h-4 mr-1 sm:mr-2"/>Conversas</TabsTrigger>
          <TabsTrigger value="flows" className="text-xs sm:text-sm neu-tab-trigger"><Bot className="w-4 h-4 mr-1 sm:mr-2"/>Fluxos</TabsTrigger>
          <TabsTrigger value="editor" className="text-xs sm:text-sm neu-tab-trigger" disabled={!editingFlowId}><Puzzle className="w-4 h-4 mr-1 sm:mr-2"/>Editor</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm neu-tab-trigger"><ListChecks className="w-4 h-4 mr-1 sm:mr-2"/>Templates</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm neu-tab-trigger"><BarChart2 className="w-4 h-4 mr-1 sm:mr-2"/>Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="connect" className="mt-2">
          <ZapWhatsAppConnection />
        </TabsContent>
        <TabsContent value="conversations" className="mt-2">
           <ZapConversations />
        </TabsContent>
        <TabsContent value="flows" className="mt-2">
          <ZapFlowsList 
            onEditFlowStructure={handleEditFlowStructure} 
          />
        </TabsContent>
        <TabsContent value="editor" className="mt-2">
          {editingFlowId ? (
            <ZapFlowBuilderWrapper 
              key={editingFlowId} 
              flowId={editingFlowId}
              initialFlowName={editingFlowName}
              onSaveSuccess={(savedFlowId, savedFlowName) => {
                setEditingFlowName(savedFlowName); 
              }}
              onCloseEditor={handleCloseEditor}
            />
          ) : (
            <Card className="neu-card shadow-md min-h-[calc(100vh-280px)] md:min-h-[calc(100vh-230px)]">
                <CardHeader><CardTitle className="flex items-center text-lg"><Puzzle className="w-5 h-5 mr-2 text-primary"/>Editor Visual de Fluxos</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                    <Puzzle className="w-16 h-16 text-muted-foreground opacity-30 mb-4"/>
                    <p className="text-muted-foreground">Selecione um fluxo na aba "Fluxos" para editar sua estrutura ou crie um novo.</p>
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
};

export default ZapMainPage;