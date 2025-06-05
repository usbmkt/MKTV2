// client/src/components/whatsapp-connection.tsx
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Phone,
  MessageCircle,
  Shield,
  Zap,
  Copy,
  Download, // Mantido caso queira implementar download do QR do backend
  Power,
  PowerOff,
  Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/api'; // Supondo que apiRequest lida com autenticação
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';

interface BackendConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'disconnected_logged_out';
  qrCode?: string | null; // QR Code virá do backend
  connectedPhoneNumber?: string;
  deviceName?: string; // Pode não ser mais fornecido pelo Baileys da mesma forma
  batteryLevel?: number; // Pode não ser mais fornecido pelo Baileys da mesma forma
  lastError?: string;
  // userId não é necessário no frontend para este status, já que é por usuário
}

interface WhatsAppConnectionProps {
  // onConnectionChange?: (status: BackendConnectionStatus) => void; // Pode ser removido se o componente gerencia seu próprio estado via API
}

export default function WhatsAppConnection({}: WhatsAppConnectionProps) {
  const { toast } = useToast();
  const auth = useAuthStore();

  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>({
    status: 'disconnected',
    qrCode: null,
  });
  
  const [isLoading, setIsLoading] = useState(false); // Para ações do usuário (conectar, desconectar)
  const [isStatusLoading, setIsStatusLoading] = useState(true); // Para carregamento inicial do status
  const [activeTab, setActiveTab] = useState('connect');
  // const [webhookUrl, setWebhookUrl] = useState(''); // Mantido, mas a lógica de salvar/testar precisa de API
  // const [apiToken, setApiToken] = useState(''); // Mantido, mas a lógica de salvar/testar precisa de API

  const fetchConnectionStatus = useCallback(async (showToast = false) => {
    if (!auth.isAuthenticated) return;
    setIsStatusLoading(true);
    try {
      const response = await apiRequest('GET', '/api/whatsapp/status');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `Erro ${response.status} ao buscar status`}));
        throw new Error(errData.message || errData.error || `Falha ao buscar status: ${response.status}`);
      }
      const data: BackendConnectionStatus = await response.json();
      setConnectionStatus(data);
      if (showToast) {
        toast({ title: "Status Atualizado", description: `Conexão: ${data.status}` });
      }
    } catch (error: any) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionStatus({ status: 'error', lastError: error.message || 'Erro ao buscar status.', qrCode: null });
      if (showToast) {
        toast({ title: "Erro ao buscar status", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsStatusLoading(false);
    }
  }, [auth.isAuthenticated, toast]);

  useEffect(() => {
    fetchConnectionStatus(); // Busca o status inicial
    const interval = setInterval(() => fetchConnectionStatus(false), 10000); // Verifica status a cada 10s
    return () => clearInterval(interval);
  }, [fetchConnectionStatus]);


  const handleConnect = async () => {
    if (!auth.isAuthenticated) return;
    setIsLoading(true);
    setConnectionStatus(prev => ({ ...prev, status: 'connecting', qrCode: null }));
    try {
      const response = await apiRequest('POST', '/api/whatsapp/connect');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `Erro ${response.status} ao iniciar conexão`}));
        throw new Error(errData.message || errData.error || `Falha ao iniciar conexão: ${response.status}`);
      }
      const data: BackendConnectionStatus = await response.json();
      setConnectionStatus(data); // Backend deve retornar o status inicial (provavelmente qr_code_needed)
      toast({ title: "Iniciando Conexão", description: "Aguarde o QR Code ou a confirmação." });
      if (data.status === 'qr_code_needed' && data.qrCode) {
        setActiveTab('connect'); // Garante que a aba do QR code esteja visível
      }
    } catch (error: any) {
      console.error('Erro ao tentar conectar:', error);
      setConnectionStatus({ status: 'error', lastError: error.message || 'Erro ao conectar', qrCode: null });
      toast({ title: "Erro ao Conectar", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!auth.isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/whatsapp/disconnect');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `Erro ${response.status} ao desconectar`}));
        throw new Error(errData.message || errData.error || `Falha ao desconectar: ${response.status}`);
      }
      // O status será atualizado pelo fetchConnectionStatus periódico
      toast({ title: "Desconexão Solicitada", description: "Aguarde a atualização do status." });
      fetchConnectionStatus(true); // Força atualização imediata do status
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({ title: "Erro ao Desconectar", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhooks/whatsapp`; // Assume que esta é a URL correta do webhook
    navigator.clipboard.writeText(url)
      .then(() => toast({ title: "Webhook URL Copiada!", description: url }))
      .catch(err => toast({ title: "Erro ao copiar", description: "Não foi possível copiar a URL.", variant: "destructive" }));
  };

  // A função downloadQRCode pode ser mantida se o backend fornecer o QR como imagem que pode ser baixada,
  // ou removida se o QR é apenas para escaneamento na tela.
  // Por ora, vamos assumir que o QR code é apenas para display.

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Conexão WhatsApp Business</h2>
          <p className="text-muted-foreground">
            Configure e gerencie sua conexão com WhatsApp Business API
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isStatusLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Badge 
            variant={connectionStatus.status === 'connected' ? "default" : connectionStatus.status === 'qr_code_needed' || connectionStatus.status === 'connecting' ? "secondary" : "destructive"}
            className="flex items-center space-x-1"
          >
            {connectionStatus.status === 'connected' ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            <span>
              {connectionStatus.status === 'connected' && 'Conectado'}
              {connectionStatus.status === 'disconnected' && 'Desconectado'}
              {connectionStatus.status === 'disconnected_logged_out' && 'Deslogado'}
              {connectionStatus.status === 'connecting' && 'Conectando...'}
              {connectionStatus.status === 'qr_code_needed' && 'Aguardando QR Code'}
              {connectionStatus.status === 'auth_failure' && 'Falha na Autenticação'}
              {connectionStatus.status === 'error' && 'Erro na Conexão'}
            </span>
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connect">Conectar</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="connect" className="space-y-4">
          {connectionStatus.status !== 'connected' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="neu-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5" />
                    <span>Conectar via QR Code</span>
                  </CardTitle>
                  <CardDescription>
                    {connectionStatus.status === 'qr_code_needed' ? 'Escaneie o QR Code com seu WhatsApp Business.' : 'Clique em "Conectar/Gerar QR Code" para iniciar.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="neu-card p-4 bg-white">
                      {(isLoading || isStatusLoading) && connectionStatus.status !== 'qr_code_needed' && (
                        <div className="w-64 h-64 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      )}
                      {connectionStatus.status === 'qr_code_needed' && connectionStatus.qrCode && !isLoading && (
                        <img 
                          src={connectionStatus.qrCode} 
                          alt="WhatsApp QR Code" 
                          className="w-64 h-64"
                        />
                      )}
                      {connectionStatus.status !== 'qr_code_needed' && !isLoading && !isStatusLoading && (
                         <div className="w-64 h-64 flex flex-col items-center justify-center text-muted-foreground">
                            <QrCode className="w-16 h-16 mb-2"/>
                            <span>Pronto para gerar QR Code</span>
                         </div>
                      )}
                    </div>
                  </div>
                  
                  <Alert>
                    <Smartphone className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Como conectar:</strong>
                      <br />1. Abra o WhatsApp Business no seu celular
                      <br />2. Toque em Mais opções (⋮) → Dispositivos conectados
                      <br />3. Toque em "Conectar um dispositivo"
                      <br />4. Aponte seu celular para esta tela para escanear o código
                    </AlertDescription>
                  </Alert>

                  <Button 
                      variant="outline" 
                      onClick={handleConnect} // Anteriormente refreshQRCode
                      disabled={isLoading || connectionStatus.status === 'connecting'}
                      className="w-full neu-button"
                    >
                      {isLoading && connectionStatus.status === 'connecting' ? <Loader2 className={`w-4 h-4 mr-2 animate-spin`} /> : <RefreshCw className={`w-4 h-4 mr-2`} />}
                      {connectionStatus.status === 'qr_code_needed' ? 'Renovar QR Code' : 'Conectar / Gerar QR Code'}
                  </Button>
                </CardContent>
              </Card>
              {/* ... (Restante da seção de instruções) ... */}
              <Card className="neu-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Conexão Segura</span>
                  </CardTitle>
                  <CardDescription>
                    Sua conexão é protegida por criptografia end-to-end
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                      <div><p className="font-medium">Escaneie o QR Code</p><p className="text-sm text-muted-foreground">Use a câmera do WhatsApp Business</p></div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                      <div><p className="font-medium">Autorize a conexão</p><p className="text-sm text-muted-foreground">Confirme no seu dispositivo móvel</p></div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                      <div><p className="font-medium">Comece a usar</p><p className="text-sm text-muted-foreground">Envie e receba mensagens pelo painel</p></div>
                    </div>
                  </div>
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription><strong>Dica:</strong> Mantenha seu celular conectado à internet para sincronização.</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

            </div>
          ) : ( // Se conectado
            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-600">WhatsApp Conectado!</h3>
                    <p className="text-muted-foreground">
                      Número: {connectionStatus.connectedPhoneNumber || 'N/A'}
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab('conversations')} className="neu-button">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Ir para Conversas
                  </Button>
                  <Button onClick={handleDisconnect} variant="destructive" className="ml-2 neu-destructive-button" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PowerOff className="w-4 h-4 mr-2" />}
                     Desconectar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          {/* ... (Conteúdo da aba status, pode ser preenchido com dados reais do backend) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="neu-card">
              <CardHeader><CardTitle>Status da Conexão</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><Badge variant={connectionStatus.status === 'connected' ? "default" : "destructive"}>{connectionStatus.status}</Badge></div>
                {connectionStatus.status === 'connected' && (
                  <>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Número</span><span className="font-mono">{connectionStatus.connectedPhoneNumber || 'N/A'}</span></div>
                    {/* Outros detalhes como deviceName, batteryLevel podem ser removidos se a API Baileys não os fornecer facilmente */}
                  </>
                )}
                {connectionStatus.status === 'error' && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>{connectionStatus.lastError || "Erro desconhecido"}</AlertDescription></Alert>}
                <Button onClick={() => fetchConnectionStatus(true)} variant="outline" className="w-full neu-button" disabled={isStatusLoading}><RefreshCw className={`w-4 h-4 mr-2 ${isStatusLoading ? 'animate-spin':''}`}/> Atualizar Status</Button>
              </CardContent>
            </Card>
            <Card className="neu-card">
              <CardHeader><CardTitle>Estatísticas (Exemplo)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Mensagens enviadas</span><span className="font-semibold">--</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Mensagens recebidas</span><span className="font-semibold">--</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
           {/* ... (Conteúdo da aba configurações, precisa de APIs para salvar) ... */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="neu-card">
              <CardHeader><CardTitle>Configurações da API (Exemplo)</CardTitle><CardDescription>Parâmetros da sua instância WhatsApp Business API.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="api-token">Token da API (Exemplo)</Label><Input id="api-token" type="password" placeholder="Seu token da API" className="neu-input"/></div>
                <Button className="w-full neu-button" disabled>Salvar Configurações (API Pendente)</Button>
              </CardContent>
            </Card>
            <Card className="neu-card">
              <CardHeader><CardTitle>Webhook</CardTitle><CardDescription>URL para receber eventos do WhatsApp.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>URL do Webhook (Gerada pela plataforma)</Label><div className="flex space-x-2"><Input value={`${window.location.origin}/api/webhooks/whatsapp`} readOnly className="neu-input"/><Button variant="outline" size="sm" onClick={copyWebhookUrl} className="neu-button"><Copy className="w-4 h-4" /></Button></div></div>
                <div className="space-y-2"><Label htmlFor="verify-token">Verify Token (Gerado pela plataforma)</Label><Input id="verify-token" value="USB_MKT_PRO_WEBHOOK_TOKEN" readOnly className="neu-input"/></div>
                <Alert><Shield className="h-4 w-4" /><AlertDescription>Configure esta URL e o Verify Token no seu App Meta.</AlertDescription></Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
