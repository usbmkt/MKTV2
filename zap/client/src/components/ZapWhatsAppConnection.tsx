 
// zap/client/src/components/ZapWhatsAppConnection.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@zap_client/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zap_client/components/ui/tabs'; // Usando Tabs do Zap UI
import { Alert, AlertDescription, AlertTitle } from '@zap_client/components/ui/alert';
import { Badge } from '@zap_client/components/ui/badge';
import { Loader2, QrCode, CheckCircle, XCircle, AlertTriangle, Power, PowerOff, RefreshCw, Settings, Smartphone, Shield, Info as InfoIcon } from 'lucide-react';
import QRCode from 'qrcode.react';
import { apiRequest } from '@zap_client/lib/api';
import { type WhatsAppConnectionStatus, type ApiError } from '@zap_client/features/types/whatsapp_flow_types';
import { cn } from '@zap_client/lib/utils';

const ZapWhatsAppConnection: React.FC = () => {
  const queryClientHook = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('connect');

  const { data: connectionData, isLoading: isLoadingStatus, error: statusError, refetch: refetchStatus } = useQuery<WhatsAppConnectionStatus, ApiError>({
    queryKey: ['whatsappConnectionStatusZap'],
    queryFn: () => apiRequest({ url: '/whatsapp/connection/status', method: 'GET' }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'qr_code_needed' || status === 'loading' || status === 'connecting') ? 5000 : false;
    },
  });

  const connectMutation = useMutation<WhatsAppConnectionStatus, ApiError>({
    mutationFn: () => apiRequest({ url: '/whatsapp/connection/connect', method: 'POST' }),
    onSuccess: (data) => {
      queryClientHook.setQueryData(['whatsappConnectionStatusZap'], data); // Atualiza o cache imediatamente
      queryClientHook.invalidateQueries({ queryKey: ['whatsappConnectionStatusZap'] });
    },
    onError: (error) => {
      console.error("Connect mutation error:", error);
    }
  });

  const disconnectMutation = useMutation<WhatsAppConnectionStatus, ApiError>({
    mutationFn: () => apiRequest({ url: '/whatsapp/connection/disconnect', method: 'POST' }),
    onSuccess: (data) => {
      queryClientHook.setQueryData(['whatsappConnectionStatusZap'], data);
      queryClientHook.invalidateQueries({ queryKey: ['whatsappConnectionStatusZap'] });
    },
     onError: (error) => {
      console.error("Disconnect mutation error:", error);
    }
  });

  const handleConnectOrRefresh = () => {
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const renderConnectionStatusInfo = () => {
    if (isLoadingStatus && !connectionData) return <div className="flex items-center text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando status...</div>;
    if (statusError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>Falha ao buscar status: {statusError.message}</AlertDescription></Alert>;
    if (!connectionData) return <p className="text-sm text-muted-foreground">Status da conexão indisponível.</p>;

    switch (connectionData.status) {
      case 'connected':
        return (
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Conectado!</AlertTitle>
            <AlertDescription>
              WhatsApp conectado com o número: {connectionData.connectedPhoneNumber || 'N/A'}.
              {connectionData.lastError && <p className="mt-2 text-xs text-yellow-700">Último erro: {connectionData.lastError}</p>}
            </AlertDescription>
          </Alert>
        );
      case 'disconnected':
        return <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>Desconectado</AlertTitle><AlertDescription>O WhatsApp não está conectado. Clique em "Conectar".</AlertDescription></Alert>;
      case 'qr_code_needed':
        return <Alert variant="default"><QrCode className="h-4 w-4" /><AlertTitle>Aguardando QR Code</AlertTitle><AlertDescription>Escaneie o QR Code abaixo para conectar.</AlertDescription></Alert>;
      case 'loading':
      case 'connecting':
        return <Alert variant="warning"><Loader2 className="h-4 w-4 animate-spin" /><AlertTitle>Conectando...</AlertTitle><AlertDescription>Aguarde enquanto estabelecemos a conexão.</AlertDescription></Alert>;
      case 'auth_failure':
        return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Falha na Autenticação</AlertTitle><AlertDescription>Não foi possível autenticar. Tente gerar um novo QR Code.</AlertDescription></Alert>;
      case 'error':
        return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Erro de Conexão</AlertTitle><AlertDescription>{connectionData.lastError || 'Ocorreu um erro desconhecido.'}</AlertDescription></Alert>;
      default:
        return <p className="text-sm text-muted-foreground">Status: {connectionData.status}</p>;
    }
  };
  
  const isConnectionActive = connectionData?.status === 'connected';
  const showQrArea = connectionData?.status === 'qr_code_needed' && connectionData.qrCode;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Gerenciar Conexão WhatsApp</CardTitle>
        <CardDescription>Conecte sua conta do WhatsApp Business para automatizar conversas e fluxos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-md bg-card shadow-inner">
          {renderConnectionStatusInfo()}
        </div>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connect">Conexão QR Code</TabsTrigger>
            <TabsTrigger value="settings">Configurações Avançadas</TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="mt-4 space-y-4">
            {showQrArea && (
              <div className="flex flex-col items-center space-y-3 p-4 border rounded-md bg-background">
                <div className="p-2 bg-white inline-block rounded-lg shadow-md">
                  <QRCode value={connectionData.qrCode!} size={200} level="H" renderAs="svg" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular, vá em Dispositivos Conectados e escaneie este código.
                </p>
              </div>
            )}
            
            {!isConnectionActive && (
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Instruções</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Clique em "{connectionData?.status === 'qr_code_needed' ? 'Renovar QR Code' : 'Conectar'}".</li>
                    <li>Abra o WhatsApp no seu celular.</li>
                    <li>Vá em Configurações &gt; Dispositivos Conectados &gt; Conectar um dispositivo.</li>
                    <li>Escaneie o QR Code exibido.</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}
             {isConnectionActive && (
                <Alert variant="success">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Conectado com Sucesso!</AlertTitle>
                    <AlertDescription>
                        Seu WhatsApp está ativo e pronto para uso. Para desconectar, use o botão abaixo.
                    </AlertDescription>
                </Alert>
             )}


            <div className="flex flex-col sm:flex-row gap-3">
              {!isConnectionActive ? (
                <Button
                  onClick={handleConnectOrRefresh}
                  disabled={connectMutation.isPending || isLoadingStatus || connectionData?.status === 'connecting' || connectionData?.status === 'loading'}
                  className="w-full sm:w-auto"
                >
                  {(connectMutation.isPending || connectionData?.status === 'connecting' || connectionData?.status === 'loading') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {connectionData?.status === 'qr_code_needed' ? <RefreshCw className="mr-2 h-4 w-4"/> : <Power className="mr-2 h-4 w-4" />}
                  {connectionData?.status === 'qr_code_needed' ? 'Renovar QR Code' : 'Conectar WhatsApp'}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {disconnectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <PowerOff className="mr-2 h-4 w-4" /> Desconectar
                </Button>
              )}
                <Button
                    variant="outline"
                    onClick={() => refetchStatus()}
                    disabled={isLoadingStatus}
                    className="w-full sm:w-auto"
                >
                    {isLoadingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    <RefreshCw className={cn("mr-2 h-4 w-4", !isLoadingStatus && "group-hover:rotate-45 transition-transform")}/>
                    Verificar Status
                </Button>
            </div>
            {(connectMutation.isError || disconnectMutation.isError) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro na Operação</AlertTitle>
                <AlertDescription>
                  {connectMutation.error?.message || disconnectMutation.error?.message}
                </AlertDescription>
              </Alert>
            )}

          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="bg-card border">
                <CardHeader>
                    <CardTitle className="text-md flex items-center"><Settings className="mr-2 h-5 w-5 text-primary"/>Configurações Avançadas</CardTitle>
                    <CardDescription className="text-xs">
                        Parâmetros para otimizar a conexão Baileys (uso avançado).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-sm p-4 bg-muted/50 rounded-md text-muted-foreground">
                        <InfoIcon className="inline h-4 w-4 mr-2" />
                        Normalmente, a conexão via QR Code não requer configurações adicionais de API aqui.
                        Esta seção seria para configurações específicas do Baileys, se necessário.
                        <p className="mt-2">Por exemplo, configurações de proxy ou opções de navegador simulado, se aplicável e permitido pela sua implementação Baileys no backend.</p>
                    </div>
                     {/* Exemplo de campos de configuração (manter desabilitados ou remover se não aplicável) */}
                    <div className="space-y-2 hidden">
                        <Label htmlFor="browserName">Nome do Navegador (Simulado)</Label>
                        <Input id="browserName" placeholder="Ex: Chrome (Linux)" disabled />
                    </div>
                    <Button disabled className="w-full opacity-50">Salvar Configurações Avançadas (Desabilitado)</Button>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ZapWhatsAppConnection;