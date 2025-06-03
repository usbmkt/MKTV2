// zap/client/src/components/ZapWhatsAppConnection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zap_client/components/ui/card';
import { Button } from '@zap_client/components/ui/button';
import { Badge } from '@zap_client/components/ui/badge';
import { Input } from '@zap_client/components/ui/input';
import { Label } from '@zap_client/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zap_client/components/ui/tabs';
import { Alert, AlertDescription as UIAlertDescription } from '@zap_client/components/ui/alert';
import {
  Smartphone,
  QrCode,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Copy,
  Download,
  Shield,
  Zap as ZapIcon,
  Loader2,
  Unlink,
  Info
} from 'lucide-react';
import QRCodeReact from 'qrcode.react';

interface WhatsAppConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTED' | 'PENDING_QR' | 'ERROR' | 'INITIALIZING';
  qrCode?: string | null;
  connectedPhoneNumber?: string | null;
  deviceName?: string | null;
  batteryLevel?: number | null;
  lastSeen?: string | null;
  lastError?: string | null;
}

interface ApiError {
    message: string;
    details?: any;
}

// Simulação de chamada de API - esta parte será modificada depois
// para chamar o backend do "zap", que por sua vez chamará o WHATSAPP_BOT_URL
const mockApiCall = async (action: string, payload?: any): Promise<any> => {
  console.log(`[API Mock] Action: ${action}`, payload);
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  if (action === 'generate-qr') {
    if (Math.random() < 0.1) throw new Error("Falha simulada ao gerar QR");
    return { status: 'PENDING_QR', qrCode: `mock-qr-data-${Date.now()}` };
  }
  if (action === 'get-status') {
    const rand = Math.random();
    if (rand < 0.3) return { status: 'DISCONNECTED', lastError: null };
    if (rand < 0.6) return { status: 'PENDING_QR', qrCode: `mock-qr-data-${Date.now()}` };
    if (rand < 0.9) return { 
        status: 'CONNECTED', 
        connectedPhoneNumber: '+5511987654321', 
        deviceName: 'Galaxy S23', 
        batteryLevel: Math.floor(Math.random() * 70) + 30,
        lastSeen: new Date(Date.now() - Math.random() * 100000).toLocaleTimeString()
    };
    return { status: 'ERROR', lastError: 'Erro inesperado de conexão.' };
  }
  if(action === 'disconnect') {
    return { status: 'DISCONNECTED' };
  }
  return { status: 'INITIALIZING' };
};

interface ZapWhatsAppConnectionProps {
  onConnectionChange?: (status: WhatsAppConnectionStatus) => void;
}

export default function ZapWhatsAppConnection({ onConnectionChange }: ZapWhatsAppConnectionProps) {
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnectionStatus>({ status: 'INITIALIZING' });
  const [isLoading, setIsLoading] = useState(false);
  const [apiToken, setApiToken] = useState(''); // Mantido para a UI de exemplo

  // Esta função será ajustada para chamar o endpoint do backend do "zap"
  const fetchStatus = useCallback(async (showLoading = true) => {
    if(showLoading) setIsLoading(true);
    try {
      // No futuro: const data: WhatsAppConnectionStatus = await zapApi.get('/connection/status');
      const data: WhatsAppConnectionStatus = await mockApiCall('get-status'); // Usando mock por enquanto
      setConnectionStatus(data);
      if (onConnectionChange) onConnectionChange(data);
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      setConnectionStatus({ status: 'ERROR', lastError: (error as ApiError).message || "Erro de comunicação" });
    } finally {
      if(showLoading) setIsLoading(false);
    }
  }, [onConnectionChange]);

  // Esta função será ajustada para chamar o endpoint do backend do "zap"
  const generateAndSetQRCode = useCallback(async () => {
    setIsLoading(true);
    try {
      // No futuro: const data: WhatsAppConnectionStatus = await zapApi.post('/connection/connect');
      const data: WhatsAppConnectionStatus = await mockApiCall('generate-qr'); // Usando mock
      setConnectionStatus(data);
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      setConnectionStatus(prev => ({ ...prev, status: 'ERROR', lastError: (error as ApiError).message || "Falha ao gerar QR" }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Esta função será ajustada para chamar o endpoint do backend do "zap"
  const handleDisconnect = async () => {
    if (!window.confirm("Tem certeza que deseja desconectar sua sessão do WhatsApp?")) return;
    setIsLoading(true);
    try {
        // No futuro: await zapApi.post('/connection/disconnect');
        await mockApiCall('disconnect'); // Usando mock
        setConnectionStatus({ status: 'DISCONNECTED', qrCode: null });
        if (onConnectionChange) onConnectionChange({ status: 'DISCONNECTED' });
    } catch (error) {
        console.error("Erro ao desconectar:", error);
        setConnectionStatus(prev => ({...prev, status: 'ERROR', lastError: (error as ApiError).message || "Falha ao desconectar"}));
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(false), 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (connectionStatus.status === 'PENDING_QR' && !connectionStatus.qrCode) {
      generateAndSetQRCode();
    }
  }, [connectionStatus.status, connectionStatus.qrCode, generateAndSetQRCode]);


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copiado para a área de transferência!");
    }).catch(err => {
      console.error('Falha ao copiar: ', err);
    });
  };
  
  const webhookUrlToCopy = `${window.location.origin}/api/zap/webhooks/whatsapp`; // Este será o webhook do seu backend "zap"


  return (
    <Card className="neu-card shadow-xl">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
            <CardTitle className="flex items-center"><Smartphone className="mr-2 h-5 w-5 text-primary"/>Conexão WhatsApp</CardTitle>
            <Badge 
                variant={
                    connectionStatus.status === 'CONNECTED' ? 'default' : 
                    connectionStatus.status === 'PENDING_QR' || connectionStatus.status === 'INITIALIZING' ? 'secondary' : 
                    'destructive'
                } 
                className={`px-3 py-1 text-xs font-medium ${connectionStatus.status === 'CONNECTED' ? 'bg-green-500 text-white' : ''}`}
            >
                {connectionStatus.status === 'CONNECTED' && <CheckCircle className="w-3.5 h-3.5 mr-1.5"/>}
                {connectionStatus.status === 'ERROR' && <AlertCircle className="w-3.5 h-3.5 mr-1.5"/>}
                {connectionStatus.status === 'PENDING_QR' && <QrCode className="w-3.5 h-3.5 mr-1.5"/>}
                {connectionStatus.status === 'INITIALIZING' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/>}
                {connectionStatus.status === 'DISCONNECTED' && <Unlink className="w-3.5 h-3.5 mr-1.5"/>}
                {connectionStatus.status === 'CONNECTED' ? `Conectado (${connectionStatus.connectedPhoneNumber || ''})` : 
                 connectionStatus.status === 'PENDING_QR' ? 'Aguardando QR Code' : 
                 connectionStatus.status === 'ERROR' ? `Erro: ${connectionStatus.lastError || 'Desconhecido'}` :
                 connectionStatus.status === 'INITIALIZING' ? 'Inicializando...' :
                 'Desconectado'}
            </Badge>
        </div>
        <CardDescription>
          Gerencie a conexão da sua conta WhatsApp Business para automações e mensagens.
        </CardDescription>
      </CardHeader>
      <Tabs defaultValue="connect" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4">
          <TabsTrigger value="connect" className="neu-button text-xs"><ZapIcon className="mr-1.5 h-3.5 w-3.5"/>Conectar</TabsTrigger>
          <TabsTrigger value="status" className="neu-button text-xs"><Info className="mr-1.5 h-3.5 w-3.5"/>Status</TabsTrigger>
          <TabsTrigger value="settings" className="neu-button text-xs"><Settings className="mr-1.5 h-3.5 w-3.5"/>Avançado</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connect" className="p-6">
            {connectionStatus.status === 'PENDING_QR' && connectionStatus.qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <p className="text-center text-muted-foreground">Escaneie o QR Code abaixo com o app WhatsApp no seu celular para conectar.</p>
                <div className="p-2 border-4 border-primary rounded-lg bg-white inline-block neu-card">
                  <QRCodeReact value={connectionStatus.qrCode} size={256} level="M" />
                </div>
                <div className="flex space-x-2">
                    <Button onClick={generateAndSetQRCode} disabled={isLoading} variant="outline" className="neu-button">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Renovar QR
                    </Button>
                    <Button onClick={() => { const canvas = document.querySelector('canvas'); if(canvas) downloadQRCode(canvas.toDataURL()); }} variant="outline" className="neu-button">
                        <Download className="mr-2 h-4 w-4" /> Baixar QR
                    </Button>
                </div>
                <Alert className="mt-4 neu-card-inset">
                  <Smartphone className="h-4 w-4" />
                  <UIAlertDescription className="text-xs">
                    Abra WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho.
                  </UIAlertDescription>
                </Alert>
              </div>
            )}
            {connectionStatus.status === 'CONNECTED' && (
              <div className="text-center space-y-3">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                <h3 className="text-xl font-semibold">Conectado com Sucesso!</h3>
                <p className="text-muted-foreground">
                  Número: <span className="font-medium text-foreground">{connectionStatus.connectedPhoneNumber}</span><br/>
                  Dispositivo: <span className="font-medium text-foreground">{connectionStatus.deviceName}</span>
                </p>
                <Button onClick={handleDisconnect} variant="destructive" className="neu-button" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlink className="mr-2 h-4 w-4"/>}
                    Desconectar
                </Button>
              </div>
            )}
            {(connectionStatus.status === 'DISCONNECTED' || connectionStatus.status === 'INITIALIZING' || connectionStatus.status === 'ERROR') && !connectionStatus.qrCode && (
              <div className="text-center space-y-3">
                {isLoading && connectionStatus.status === 'INITIALIZING' &&  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />}
                {connectionStatus.status === 'ERROR' &&  <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />}
                <p className="text-muted-foreground">
                  {connectionStatus.status === 'ERROR' ? `Erro: ${connectionStatus.lastError}` : 'Clique para gerar o QR Code e iniciar a conexão.'}
                </p>
                <Button onClick={generateAndSetQRCode} disabled={isLoading} className="neu-button-primary">
                  <QrCode className="mr-2 h-4 w-4" /> Gerar QR Code
                </Button>
              </div>
            )}
        </TabsContent>

        <TabsContent value="status" className="p-6 space-y-4">
            <Card className="neu-card">
                <CardHeader><CardTitle className="text-base">Informações da Conexão</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between"><span>Status:</span> <Badge variant={connectionStatus.status === 'CONNECTED' ? 'default' : 'outline'} className={connectionStatus.status === 'CONNECTED' ? 'bg-green-500 text-white' : ''}>{connectionStatus.status}</Badge></div>
                    {connectionStatus.status === 'CONNECTED' && (
                        <>
                            <div className="flex justify-between"><span>Número Conectado:</span> <span>{connectionStatus.connectedPhoneNumber || '-'}</span></div>
                            <div className="flex justify-between"><span>Nome do Dispositivo:</span> <span>{connectionStatus.deviceName || '-'}</span></div>
                            <div className="flex justify-between"><span>Nível da Bateria:</span> <span>{connectionStatus.batteryLevel !== null && connectionStatus.batteryLevel !== undefined ? `${connectionStatus.batteryLevel}%` : '-'}</span></div>
                            <div className="flex justify-between"><span>Visto por último:</span> <span>{connectionStatus.lastSeen || '-'}</span></div>
                        </>
                    )}
                     {connectionStatus.status === 'ERROR' &&  <div className="flex justify-between text-destructive"><span>Último Erro:</span> <span>{connectionStatus.lastError || 'Desconhecido'}</span></div>}
                </CardContent>
            </Card>
            <Button onClick={() => fetchStatus()} variant="outline" className="w-full neu-button" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar Status
            </Button>
        </TabsContent>
        
        <TabsContent value="settings" className="p-6 space-y-6">
            <Card className="neu-card">
                <CardHeader><CardTitle className="text-base">Configurações de API (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label htmlFor="apiToken" className="text-xs">Seu Token de API (se usar provedor externo)</Label>
                    <Button className="neu-button text-xs" size="sm" type="button">
                        <Settings className="mr-1.5 h-3.5 w-3.5"/>
                        <span>Salvar Token</span>
                    </Button>
                </CardContent>
            </Card>
             <Card className="neu-card">
                <CardHeader><CardTitle className="text-base">Webhook para Mensagens Recebidas</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Configure esta URL no seu provedor WhatsApp para receber mensagens e eventos.</p>
                    <div className="flex items-center space-x-2">
                        <Input value={webhookUrlToCopy} readOnly className="neu-input text-xs"/>
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrlToCopy)} className="neu-button h-9 w-9"><Copy className="h-4 w-4"/></Button>
                    </div>
                     <Alert className="neu-card-inset">
                        <Shield className="h-4 w-4" />
                        <UIAlertDescription className="text-xs">
                            Este endpoint é seguro e espera dados específicos da API do WhatsApp.
                        </UIAlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function downloadQRCode(dataUrl: string) {
    const link = document.createElement('a');
    link.download = 'whatsapp-qr.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
