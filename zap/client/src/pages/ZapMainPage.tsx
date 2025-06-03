// zap/client/src/pages/ZapMainPage.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zap_client/components/ui/tabs'; // Corrigido
import ZapWhatsAppConnection from '@zap_client/components/ZapWhatsAppConnection'; // Corrigido
import ZapConversations from '@zap_client/components/whatsapp_features/ZapConversations'; // Corrigido
import ZapFlowsList, { ZapFlowsListProps } from '@zap_client/components/whatsapp_features/ZapFlowsList'; // Corrigido, importado Props
import ZapFlowBuilderWrapper, { ZapFlowBuilderProps } from '@zap_client/components/ZapFlowBuilder';  // Corrigido, importado Props
import ZapTemplates from '@zap_client/components/whatsapp_features/ZapTemplates'; // Corrigido
import ZapAnalytics from '@zap_client/components/whatsapp_features/ZapAnalytics'; // Corrigido
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card'; // Corrigido
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
    <CardContent className="flex flex-col items-center justify-center text-center min-h-[300px]">
      {Icon && <Icon className="w-12 h-12 text-muted-foreground opacity-50 mb-4" />}
      <p className="text-muted-foreground">{description || `Conteúdo para ${title} aqui.`}</p>
    </CardContent>
  </Card>
);

interface FlowStructure {
    id: string;
    name: string;
}

// Adicionando props que estavam causando erro
interface ExtendedZapFlowsListProps extends ZapFlowsListProps {
  onSelectFlow: (flowId: string, flowName: string) => void;
  onEditFlow: (flowId: string, flowName: string) => void; 
}

interface ExtendedZapFlowBuilderProps extends ZapFlowBuilderProps {
  initialFlowName?: string | null; // Adicionado
}


export default function ZapMainPage() {
  const [activeTab, setActiveTab] = useState('connection');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null); 
  const [editingFlowName, setEditingFlowName] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentFlowStructure, setCurrentFlowStructure] = useState<FlowStructure | null>(null);

  const handleSelectFlow = (flowId: string, flowName: string) => {
    setEditingFlowId(flowId);
    setEditingFlowName(flowName);
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
            onSelectFlow={handleSelectFlow} 
            onEditFlow={(flowId: string, flowName: string) => handleSelectFlow(flowId, flowName)}
          />
        </TabsContent>
        <TabsContent value="editor" className="mt-2">
          {editingFlowId ? (
            <ZapFlowBuilderWrapper 
              key={editingFlowId} 
              flowId={String(editingFlowId)} // Assegura que é string
              initialFlowName={editingFlowName} // Prop adicionada
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
}