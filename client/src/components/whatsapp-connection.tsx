// client/src/components/whatsapp-connection.tsx
import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Smartphone, QrCode, CheckCircle, AlertCircle, RefreshCw, Loader2, Power, PowerOff } from 'lucide-react';

// Tipagem para o status vindo do backend
interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_code_needed' | 'auth_failure' | 'error' | 'disconnected_logged_out';
  qrCode: string | null;
  connectedPhoneNumber?: string;
  lastError?: string;
}

const WhatsAppConnection: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError, error, refetch } = useQuery<ConnectionStatus>({
    queryKey: ['whatsappConnectionStatus'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/whatsapp/status');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: "Não foi possível obter o status." }));
        throw new Error(errData.message || "Erro de comunicação com o servidor.");
      }
      return response.json();
    },
    refetchInterval: (data) => {
      // Se estiver esperando QR Code ou conectando, busca mais rápido.
      if (data?.status === 'qr_code_needed' || data?.status === 'connecting') {
        return 5000; // a cada 5 segundos
      }
      return 30000; // a cada 30 segundos
    },
    refetchOnWindowFocus: true,
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/connect'),
    onSuccess: () => {
      toast({ title: "Conexão Iniciada", description: "Aguardando QR code ou conexão..." });
      queryClient.invalidateQueries({ queryKey: ['whatsappConnectionStatus'] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao Conectar", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/disconnect'),
    onSuccess: () => {
      toast({ title: "Desconexão Solicitada", description: "Sua sessão do WhatsApp foi encerrada." });
      queryClient.invalidateQueries({ queryKey: ['whatsappConnectionStatus'] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao Desconectar", description: err.message, variant: "destructive" });
    },
  });

  const getStatusInfo = () => {
    switch (status?.status) {
      case 'connected': return { icon: <CheckCircle className="w-5 h-5 text-green-500" />, text: `Conectado como ${status.connectedPhoneNumber}`, color: "text-green-500" };
      case 'connecting': return { icon: <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />, text: 'Conectando...', color: "text-yellow-500" };
      case 'qr_code_needed': return { icon: <QrCode className="w-5 h-5 text-blue-500" />, text: 'Aguardando leitura do QR Code', color: "text-blue-500" };
      case 'disconnected_logged_out': return { icon: <AlertCircle className="w-5 h-5 text-red-500" />, text: 'Desconectado. Faça a leitura novamente.', color: "text-red-500" };
      case 'error': return { icon: <AlertCircle className="w-5 h-5 text-red-500" />, text: `Erro: ${status.lastError || 'Desconhecido'}`, color: "text-red-500" };
      default: return { icon: <AlertCircle className="w-5 h-5 text-gray-500" />, text: 'Desconectado', color: "text-gray-500" };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Conexão com WhatsApp</CardTitle>
            <CardDescription>Gerencie a conexão do seu número de WhatsApp com a plataforma.</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center gap-2 p-2 rounded-md bg-muted ${statusInfo.color}`}>
              {statusInfo.icon}
              <span className="font-semibold text-sm">{statusInfo.text}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {status?.status === 'connected' ? (
          <div className="text-center p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p>A plataforma está conectada ao número <strong>{status.connectedPhoneNumber}</strong>.</p>
            <Button className="mt-4" variant="destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PowerOff className="w-4 h-4 mr-2" />}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-card-foreground/5">
              {isLoading && <Loader2 className="w-16 h-16 animate-spin text-primary" />}
              {isError && <AlertTriangle className="w-16 h-16 text-destructive" />}
              {status?.status === 'qr_code_needed' && status.qrCode && (
                <img src={status.qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg shadow-lg" />
              )}
               {status?.status === 'connecting' && <p>Aguardando conexão...</p>}
               {status?.status === 'disconnected_logged_out' && <p>Sessão expirada. Conecte novamente.</p>}
            </div>
            <div>
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Como conectar</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Clique no botão "Conectar / Gerar QR Code".</li>
                    <li>Abra o WhatsApp Business no seu celular.</li>
                    <li>Vá em 'Configurações' &gt; 'Dispositivos conectados'.</li>
                    <li>Toque em "Conectar um dispositivo" e escaneie o código.</li>
                  </ol>
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full mt-4" 
                onClick={() => connectMutation.mutate()} 
                disabled={connectMutation.isPending || isLoading}
              >
                {connectMutation.isPending || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Power className="w-4 h-4 mr-2" />}
                Conectar / Gerar QR Code
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
